import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Satu client Supabase per request, dipakai bersama oleh layout, halaman, dan helper data. */
export const getSupabase = cache(async () => createClient());

/**
 * Wajib dipanggil di setiap halaman admin DAN setiap server action admin.
 * Server action adalah endpoint publik, jadi cek login tidak boleh hanya mengandalkan proxy.
 *
 * Di-cache per request: layout dan halaman sama-sama memanggilnya, tapi pengecekan
 * hanya berjalan sekali. Panggil bareng query data lewat Promise.all supaya tidak berurutan.
 */
export const requireAdmin = cache(async () => {
  const supabase = await getSupabase();

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!admin) redirect("/login?error=" + encodeURIComponent("Akun ini belum terdaftar sebagai pengelola."));

  return { supabase, userId };
});
