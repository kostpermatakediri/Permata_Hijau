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

  // Cek admin tidak menunggu getClaims(): policy RLS "admin baca diri sendiri" hanya mengembalikan
  // baris milik pemegang token, jadi query tanpa filter user_id sudah pasti soal diri sendiri.
  // Keduanya jalan bareng (satu putaran), lalu dicocokkan dengan klaim yang tanda tangannya terverifikasi.
  const [{ data: claimsData }, { data: admin }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("admins").select("user_id").maybeSingle(),
  ]);

  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");
  if (admin?.user_id !== userId) redirect("/login?error=" + encodeURIComponent("Akun ini belum terdaftar sebagai pengelola."));

  return { supabase, userId };
});
