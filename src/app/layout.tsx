import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${config.kosName} | Kos putri`, template: `%s | ${config.kosName}` },
  description: `Info kamar, harga, dan ketersediaan di ${config.kosName}. Tanya langsung lewat WhatsApp.`,
  metadataBase: new URL(config.siteUrl),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6b4f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
