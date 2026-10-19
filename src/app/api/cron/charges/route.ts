import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Dijalankan Vercel Cron tiap hari (lihat vercel.json).
 * - Menerbitkan tagihan sewa bulanan yang jatuh tempo dalam 3 hari ke depan.
 * - Sekaligus mengirim query ke database, jadi project Supabase free tier
 *   tidak ikut ter-pause karena tidak ada aktivitas.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient().rpc("generate_rent_charges");
  if (error) {
    console.error("generate_rent_charges gagal:", error.message);
    return NextResponse.json({ error: "gagal membuat tagihan" }, { status: 500 });
  }
  return NextResponse.json({ created: data });
}
