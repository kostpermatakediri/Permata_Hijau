// Info kos dibaca dari env supaya gampang diganti tanpa ubah kode.
export const config = {
  kosName: process.env.NEXT_PUBLIC_KOS_NAME || "Kos Putri",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  waNumber: (process.env.NEXT_PUBLIC_WA_NUMBER || "").replace(/\D/g, ""),
  bank: {
    name: process.env.NEXT_PUBLIC_BANK_NAME || "",
    account: process.env.NEXT_PUBLIC_BANK_ACCOUNT || "",
    holder: process.env.NEXT_PUBLIC_BANK_HOLDER || "",
  },
  galonPrice: Number(process.env.NEXT_PUBLIC_GALON_PRICE) || 7000,
};
