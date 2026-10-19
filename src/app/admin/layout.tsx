import type { Metadata } from "next";
import { logout } from "@/app/login/actions";
import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Pengelola", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();

  const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending");

  return (
    <div className="pb-28">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-5">
        <span className="font-display text-lg font-bold">{config.kosName}</span>
        <form action={logout}>
          <button type="submit" className="text-sm font-semibold text-abu underline underline-offset-4">
            Keluar
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-6">{children}</main>
      <AdminNav pendingCount={count ?? 0} />
    </div>
  );
}
