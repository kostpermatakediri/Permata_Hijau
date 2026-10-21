"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Ringkasan", exact: true },
  { href: "/admin/penyewa", label: "Penyewa" },
  { href: "/admin/verifikasi", label: "Verifikasi" },
  { href: "/admin/kamar", label: "Kamar" },
];

/**
 * Garis kecil di bawah menu yang sedang dibuka. Muncul hanya kalau pindah halaman butuh lebih dari
 * ~150 ms, jadi pindah menu yang cepat tidak berkedip. Dipakai sebagai ganti loading.tsx: skeleton
 * Suspense menahan konten asli minimal 300 ms walau datanya sudah datang dalam 60 ms.
 */
function PendingBar() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-6 bottom-1.5 h-0.5 rounded-full bg-pandan transition-opacity",
        pending ? "animate-pulse opacity-100 delay-150" : "opacity-0 duration-100",
      )}
    />
  );
}

export function AdminNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-20 border-t border-batu bg-white">
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center px-1 text-sm font-semibold",
                  active ? "text-pandan" : "text-abu",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-5 top-0 h-1 rounded-b-full",
                    active ? "bg-pandan" : "bg-transparent",
                  )}
                />
                {item.label}
                <PendingBar />
                {item.href === "/admin/verifikasi" && pendingCount > 0 && (
                  <span className="absolute right-[18%] top-2 min-w-5 rounded-full bg-kunyit px-1.5 text-center text-xs font-bold text-ink">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
