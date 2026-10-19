import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Wajib dipanggil di setiap halaman admin DAN setiap server action admin.
 * Server action adalah endpoint publik, jadi cek login tidak boleh hanya mengandalkan proxy.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/login?error=" + encodeURIComponent("Akun ini belum terdaftar sebagai pengelola."));

  return { supabase, user };
}
