"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { int, str, todayWIB } from "@/lib/utils";

export type PayState = { status: "idle" | "ok" | "error"; message: string };

const TOKEN_RE = /^[a-f0-9]{36}$/;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PENDING = 5;

/** Cek isi file (bukan cuma Content-Type yang dikirim klien). */
function sniffImage(buf: Uint8Array): { mime: string; ext: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export async function submitPayment(_prev: PayState, formData: FormData): Promise<PayState> {
  const fail = (message: string): PayState => ({ status: "error", message });

  const token = str(formData, "token");
  if (!TOKEN_RE.test(token)) return fail("Link tidak valid.");

  const amount = int(formData, "amount");
  if (!Number.isFinite(amount) || amount < 1000 || amount > 50_000_000) {
    return fail("Isi nominal transfer dengan benar, minimal Rp1.000.");
  }

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return fail("Pilih foto bukti transfer dulu.");
  if (file.size > MAX_BYTES) return fail("Ukuran foto terlalu besar (maksimal 3 MB).");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return fail("File harus berupa foto (JPG, PNG, atau WebP).");

  const db = createAdminClient();
  const { data: lease } = await db.from("leases").select("id").eq("token", token).maybeSingle();
  if (!lease) return fail("Link tidak ditemukan. Minta link baru ke pengelola.");

  // Batasi spam: maksimal beberapa bukti yang belum dicek per sewa.
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", lease.id)
    .eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING) {
    return fail("Masih ada beberapa bukti yang belum dicek pengelola. Tunggu sebentar ya.");
  }

  const path = `${lease.id}/${Date.now()}-${randomUUID().slice(0, 8)}.${kind.ext}`;
  const { error: uploadError } = await db.storage
    .from("payment-proofs")
    .upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (uploadError) return fail("Foto gagal diunggah. Coba lagi.");

  const { error: insertError } = await db.from("payments").insert({
    lease_id: lease.id,
    amount,
    paid_date: todayWIB(),
    proof_path: path,
    status: "pending",
    source: "tenant",
  });
  if (insertError) {
    await db.storage.from("payment-proofs").remove([path]);
    return fail("Gagal menyimpan pembayaran. Coba lagi.");
  }

  revalidatePath(`/bayar/${token}`);
  revalidatePath("/admin", "layout");
  return { status: "ok", message: "Bukti bayar terkirim. Pengelola akan mengecek dan statusnya berubah di halaman ini." };
}
