-- Galeri foto per unit (maks 8 di aplikasi). photo_url lama tetap dipertahankan sebagai foto pertama.
alter table public.units add column if not exists photos text[] not null default '{}';

update public.units
set photos = array[photo_url]
where photo_url is not null and cardinality(photos) = 0;
