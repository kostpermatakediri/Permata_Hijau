// Teks statis landing page.
//
// TODO(konfirmasi pemilik kos): `bookingSteps` masih teks generik, belum dikonfirmasi ke pemilik.
// Tanyakan: apakah ada survei/lihat kamar dulu? Berapa DP atau pembayaran pertama, dan kapan dibayar?
// Apakah ada syarat (KTP, kontrak minimal)? Jangan tambah janji (daftar tunggu, booking online, dsb.)
// yang belum benar-benar dijalankan pengelola.

export const bookingSteps = [
  {
    title: "Tanya lewat WhatsApp",
    body: "Pilih kamar yang kosong, ketuk tombolnya, lalu kirim pesan yang sudah terisi.",
  },
  {
    title: "Lihat kamarnya",
    body: "Atur jadwal survei dengan pengelola supaya bisa cek kamar dan lingkungan sekitarnya.",
  },
  {
    title: "Bayar dan mulai tinggal",
    body: "Selesaikan pembayaran pertama sesuai kesepakatan, lalu kamar siap ditempati.",
  },
];

export const payNote = {
  title: "Bayar sewa dari HP",
  body: "Setiap penghuni mendapat link tagihan pribadi lewat WhatsApp. Di situ ada rincian sewa, nomor rekening, dan tempat mengunggah bukti transfer. Tanpa perlu membuat akun.",
};
