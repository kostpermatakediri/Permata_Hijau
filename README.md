# Kos Manager

Landing page + manajemen penyewa kos dalam satu app (Next.js 16, Supabase, Vercel).

- `/` landing page publik: unit, foto, harga, kamar kosong/terisi, tombol tanya via WhatsApp.
- `/bayar/<token>` link tagihan per penyewa (tanpa akun): rincian sewa + galon, upload bukti transfer.
- `/admin` khusus pengelola (login): ringkasan, penyewa, verifikasi bayar, unit & kamar.

## Cara kerja tagihan

- Setiap penyewa punya satu sewa (`leases`) dengan tanggal masuk dan durasi. Jatuh tempo tiap bulan mengikuti tanggal masuk.
- Cron harian (`/api/cron/charges`) menerbitkan tagihan sewa bulanan 3 hari sebelum jatuh tempo. Aman dijalankan berulang (tidak ada tagihan dobel).
- Galon dan biaya lain dicatat sebagai tagihan terpisah (`charges`).
- Pembayaran dialokasikan ke tagihan terlama dulu. Tunggakan = tagihan jatuh tempo yang belum tertutup pembayaran **yang sudah disetujui**.
- Penyewa upload bukti, status "menunggu dicek". Pengelola setujui dengan 1 tap (nominal bisa dikoreksi) atau tolak dengan alasan.

## Setup

### 1. Supabase

1. Buat project di supabase.com.
2. SQL Editor: jalankan isi `supabase/migrations/20261017000000_init.sql`.
3. Authentication > Sign In / Providers: **matikan "Allow new users to sign up"**.
4. Authentication > Users > Add user: buat akun Bu Kustrini (email + password), dan akun anak/suami kalau perlu.
5. Jadikan mereka admin (SQL Editor):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email in ('email-bukus@example.com', 'email-anak@example.com');
   ```

   Akun yang tidak ada di tabel `admins` tidak bisa melihat data apa pun, walau berhasil login.

### 2. Lokal

```bash
cp .env.example .env.local   # isi semua nilainya
npm install
npm run dev
```

Isi `.env.local` dari Supabase > Project Settings > API: URL, anon/publishable key, dan service role key.
`SUPABASE_SERVICE_ROLE_KEY` hanya untuk server, jangan diberi prefix `NEXT_PUBLIC_` dan jangan di-commit.

### 3. GitHub + Vercel

1. Push ke repo **private** di GitHub.
2. Vercel > Add New Project > import repo.
3. Isi semua environment variable dari `.env.example` (ganti `NEXT_PUBLIC_SITE_URL` dengan domain asli, `CRON_SECRET` dengan string acak panjang).
4. Deploy. Cron di `vercel.json` jalan otomatis tiap hari pukul 03:00 WIB.

### 4. Isi data

Login di `/login`, lalu menu **Kamar**: tambah unit, foto, dan kamar. Setelah itu **Penyewa > Tambah penyewa**.
Di detail penyewa, tombol "Kirim link bayar" membuka WhatsApp dengan pesan yang sudah terisi.

## Supabase free tier tetap nyala

Project free tier di-pause kalau tidak ada aktivitas sekitar seminggu. Cron harian memanggil database, jadi project tetap aktif selama deploy di Vercel hidup. Cek juga di Vercel > Project > Cron Jobs bahwa jobnya terdaftar.

## Backup

Free tier tidak punya backup otomatis. Minimal sebulan sekali:

```bash
supabase db dump --db-url "<connection string dari Supabase>" -f backup.sql
```

Atau upgrade ke Pro kalau datanya sudah penting.

## Keamanan

- Semua tabel memakai Row Level Security: hanya user di tabel `admins` yang bisa akses lewat API. `anon` tidak punya akses apa pun.
- Landing page dan `/bayar/<token>` membaca data lewat server (service role) dan hanya mengambil kolom yang perlu ditampilkan.
- Token link bayar 144 bit acak, tidak bisa ditebak. Kalau link bocor, buat sewa baru atau ganti token (`update leases set token = encode(gen_random_bytes(18), 'hex') where id = '...'`).
- Bukti bayar disimpan di bucket **private**, dibuka admin lewat link sementara (1 jam).
- Setiap server action admin mengecek login dan keanggotaan admin sendiri.

## Belum ada (sengaja ditunda)

- Kirim WhatsApp otomatis (sekarang lewat tombol `wa.me`: tinggal pencet kirim).
- Verifikasi otomatis lewat QRIS dinamis / Virtual Account (Midtrans, Xendit).
- Pembatasan laju upload per IP di halaman bayar (sekarang dibatasi maksimal 5 bukti menunggu per sewa).
- Edit penyewa / sewa setelah dibuat (akhiri sewa lalu buat baru, atau edit di tabel Supabase).
- Info rekening dan nama kos masih dari environment variable, bukan dari halaman pengaturan.
