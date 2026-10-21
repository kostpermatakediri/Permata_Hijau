import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    // Bukti bayar dikompres di sisi klien (~300KB), tapi kasih ruang aman.
    serverActions: { bodySizeLimit: "4mb" },
    // Halaman admin yang baru dibuka dipakai ulang 30 detik di sisi klien, jadi bolak-balik antar menu
    // tidak menunggu server. Server action memanggil revalidatePath, yang mengosongkan cache ini.
    staleTimes: { dynamic: 30 },
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
