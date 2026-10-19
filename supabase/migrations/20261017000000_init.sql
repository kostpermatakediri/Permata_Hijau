-- =====================================================================
-- Kos Manager: skema awal
-- Jalankan di Supabase SQL Editor (atau `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- helper ----------
create or replace function public.today_wib()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- ---------- tabel ----------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  description text,
  photo_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  name text not null,
  monthly_price integer not null check (monthly_price > 0),
  facilities text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_id, name)
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,            -- format 62812xxxx
  notes text,
  created_at timestamptz not null default now()
);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  tenant_id uuid not null references public.tenants (id),
  -- token untuk link bayar penyewa (/bayar/<token>). 144 bit acak, tidak bisa ditebak.
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  start_date date not null,
  duration_months int not null check (duration_months between 1 and 60),
  end_date date not null,
  monthly_price integer not null check (monthly_price > 0),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

-- satu kamar hanya boleh punya satu sewa aktif
create unique index leases_one_active_per_room on public.leases (room_id) where status = 'active';
create index leases_tenant_idx on public.leases (tenant_id);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  type text not null check (type in ('rent', 'galon', 'other')),
  description text not null,
  amount integer not null check (amount > 0),
  due_date date not null,
  created_at timestamptz not null default now()
);

-- cron boleh jalan berkali-kali tanpa bikin tagihan sewa dobel
create unique index charges_rent_unique on public.charges (lease_id, due_date) where type = 'rent';
create index charges_lease_idx on public.charges (lease_id, due_date);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  amount integer not null check (amount > 0),
  paid_date date not null default public.today_wib(),
  proof_path text,                -- path di bucket private "payment-proofs"
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'tenant' check (source in ('tenant', 'admin')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index payments_lease_idx on public.payments (lease_id, status);
create index payments_pending_idx on public.payments (status) where status = 'pending';

-- ---------- generator tagihan sewa bulanan ----------
-- Dipanggil cron harian (service role). Membuat tagihan sewa untuk setiap bulan
-- yang jatuh tempo dalam `lookahead_days` ke depan. Aman dijalankan berulang.
create or replace function public.generate_rent_charges(lookahead_days int default 3)
returns integer
language plpgsql
set search_path = public
as $$
declare
  inserted integer;
begin
  with due as (
    select l.id as lease_id,
           l.monthly_price,
           k,
           (l.start_date + make_interval(months => k))::date as due_date
    from public.leases l
    cross join lateral generate_series(0, l.duration_months - 1) as k
    where l.status = 'active'
  ),
  ins as (
    insert into public.charges (lease_id, type, description, amount, due_date)
    select lease_id, 'rent', 'Sewa kos bulan ke-' || (k + 1), monthly_price, due_date
    from due
    where due_date <= public.today_wib() + lookahead_days
    on conflict (lease_id, due_date) where type = 'rent' do nothing
    returning 1
  )
  select count(*) into inserted from ins;

  return inserted;
end;
$$;

revoke all on function public.generate_rent_charges(int) from public, anon, authenticated;
grant execute on function public.generate_rent_charges(int) to service_role;

-- ---------- Row Level Security ----------
-- Hanya user yang terdaftar di tabel admins yang boleh baca/tulis lewat API.
-- Halaman publik (landing, link bayar) diakses lewat server dengan service role,
-- jadi anon tidak punya akses langsung ke tabel apa pun.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.admins   enable row level security;
alter table public.units    enable row level security;
alter table public.rooms    enable row level security;
alter table public.tenants  enable row level security;
alter table public.leases   enable row level security;
alter table public.charges  enable row level security;
alter table public.payments enable row level security;

create policy "admin baca diri sendiri" on public.admins
  for select to authenticated using (user_id = auth.uid());

create policy "admin full" on public.units    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full" on public.rooms    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full" on public.tenants  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full" on public.leases   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full" on public.charges  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage ----------
-- Bukti bayar: PRIVATE. Tidak ada policy => hanya service role (server) yang bisa akses.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Foto unit: publik (dibaca landing page). Upload tetap lewat server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('unit-photos', 'unit-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------- Setelah daftar user pertama di Supabase Auth ----------
-- Jadikan dia admin (ganti email):
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'bukustrini@example.com';
