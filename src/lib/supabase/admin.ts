import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client service-role: MELEWATI RLS. Hanya boleh dipakai di server untuk:
 * - halaman publik (landing, /bayar/[token]) yang hanya mengambil kolom aman
 * - upload/signed URL storage
 * - cron
 * Jangan pernah diimpor dari komponen client.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
