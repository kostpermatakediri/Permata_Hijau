"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { endDateFor } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { int, normalizePhone, str, todayWIB } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PHOTO = 3 * 1024 * 1024;
const PHOTO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Kembali ke halaman dengan pesan. Selalu dipanggil di luar try/catch (redirect melempar). */
function go(path: string, kind: "ok" | "error", message: string): never {
  revalidatePath("/admin", "layout");
  revalidatePath("/"); // landing (ISR 60 dtk) ikut berubah saat kamar/unit/sewa berubah
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

// ---------------------------------------------------------------- penyewa & sewa

export async function createLease(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/penyewa/baru";

  const name = str(formData, "full_name");
  const phone = normalizePhone(str(formData, "phone"));
  const roomId = str(formData, "room_id");
  const startDate = str(formData, "start_date");
  const months = int(formData, "duration_months");
  let price = int(formData, "monthly_price");

  if (name.length < 2) go(back, "error", "Nama penyewa belum diisi.");
  if (phone.length < 10 || phone.length > 15) go(back, "error", "Nomor WhatsApp tidak valid.");
  if (!roomId) go(back, "error", "Pilih kamar dulu.");
  if (!DATE_RE.test(startDate)) go(back, "error", "Tanggal masuk tidak valid.");
  if (!Number.isInteger(months) || months < 1 || months > 60) go(back, "error", "Durasi sewa harus 1 sampai 60 bulan.");

  const { data: room } = await supabase
    .from("rooms")
    .select("id, monthly_price, is_active")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || !room.is_active) go(back, "error", "Kamar tidak ditemukan atau sudah dinonaktifkan.");
  if (!Number.isFinite(price) || price <= 0) price = room.monthly_price;

  // Pakai penyewa lama kalau nomornya sama (orang yang sama sewa lagi).
  let tenantId: string;
  const { data: existing } = await supabase.from("tenants").select("id").eq("phone", phone).limit(1).maybeSingle();
  if (existing) {
    tenantId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("tenants")
      .insert({ full_name: name, phone })
      .select("id")
      .single();
    if (error || !created) go(back, "error", "Gagal menyimpan penyewa.");
    tenantId = created.id;
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .insert({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: startDate,
      duration_months: months,
      end_date: endDateFor(startDate, months),
      monthly_price: price,
    })
    .select("id")
    .single();

  if (leaseError || !lease) {
    go(
      back,
      "error",
      leaseError?.code === "23505" ? "Kamar ini masih punya penyewa aktif." : "Gagal menyimpan sewa.",
    );
  }

  // Langsung terbitkan tagihan sewa bulan pertama (cron harian yang meneruskan sisanya).
  try {
    await createAdminClient().rpc("generate_rent_charges");
  } catch {
    // Tidak fatal: cron akan membuatnya.
  }

  go(`/admin/penyewa/${lease.id}`, "ok", "Penyewa ditambahkan. Kirim link bayar ke WhatsApp-nya.");
}

export async function endLease(formData: FormData) {
  const { supabase } = await requireAdmin();
  const leaseId = str(formData, "lease_id");
  const { error } = await supabase.from("leases").update({ status: "ended" }).eq("id", leaseId);
  if (error) go(`/admin/penyewa/${leaseId}`, "error", "Gagal mengakhiri sewa.");
  go("/admin/penyewa", "ok", "Sewa diakhiri. Kamar kembali tampil kosong di landing page.");
}

// ---------------------------------------------------------------- tagihan & pembayaran

export async function addGalon(formData: FormData) {
  const { supabase } = await requireAdmin();
  const leaseId = str(formData, "lease_id");
  const back = `/admin/penyewa/${leaseId}`;
  const qty = int(formData, "qty");
  const price = int(formData, "price");

  if (!Number.isInteger(qty) || qty < 1 || qty > 50) go(back, "error", "Jumlah galon harus 1 sampai 50.");
  if (!Number.isFinite(price) || price <= 0) go(back, "error", "Harga galon tidak valid.");

  const { error } = await supabase.from("charges").insert({
    lease_id: leaseId,
    type: "galon",
    description: `Galon x${qty}`,
    amount: qty * price,
    due_date: todayWIB(),
  });
  if (error) go(back, "error", "Gagal mencatat galon.");
  go(back, "ok", `Galon x${qty} dicatat.`);
}

export async function addCharge(formData: FormData) {
  const { supabase } = await requireAdmin();
  const leaseId = str(formData, "lease_id");
  const back = `/admin/penyewa/${leaseId}`;
  const description = str(formData, "description");
  const amount = int(formData, "amount");
  const dueDate = str(formData, "due_date") || todayWIB();

  if (!description) go(back, "error", "Keterangan tagihan belum diisi.");
  if (!Number.isFinite(amount) || amount <= 0) go(back, "error", "Nominal tidak valid.");
  if (!DATE_RE.test(dueDate)) go(back, "error", "Tanggal tidak valid.");

  const { error } = await supabase
    .from("charges")
    .insert({ lease_id: leaseId, type: "other", description, amount, due_date: dueDate });
  if (error) go(back, "error", "Gagal menyimpan tagihan.");
  go(back, "ok", "Tagihan ditambahkan.");
}

export async function deleteCharge(formData: FormData) {
  const { supabase } = await requireAdmin();
  const leaseId = str(formData, "lease_id");
  const chargeId = str(formData, "charge_id");
  // Tagihan sewa tidak boleh dihapus (cron akan membuatnya lagi). Hanya galon & lainnya.
  const { error } = await supabase.from("charges").delete().eq("id", chargeId).in("type", ["galon", "other"]);
  if (error) go(`/admin/penyewa/${leaseId}`, "error", "Gagal menghapus tagihan.");
  go(`/admin/penyewa/${leaseId}`, "ok", "Tagihan dihapus.");
}

/** Pembayaran yang diterima langsung (tunai / transfer yang sudah dicek sendiri): langsung disetujui. */
export async function recordPayment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const leaseId = str(formData, "lease_id");
  const back = `/admin/penyewa/${leaseId}`;
  const amount = int(formData, "amount");
  const paidDate = str(formData, "paid_date") || todayWIB();
  const note = str(formData, "note") || null;

  if (!Number.isFinite(amount) || amount <= 0) go(back, "error", "Nominal pembayaran tidak valid.");
  if (!DATE_RE.test(paidDate)) go(back, "error", "Tanggal tidak valid.");

  const { error } = await supabase.from("payments").insert({
    lease_id: leaseId,
    amount,
    paid_date: paidDate,
    note,
    status: "approved",
    source: "admin",
    reviewed_at: new Date().toISOString(),
  });
  if (error) go(back, "error", "Gagal mencatat pembayaran.");
  go(back, "ok", "Pembayaran dicatat.");
}

export async function reviewPayment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/verifikasi";
  const paymentId = str(formData, "payment_id");
  const decision = str(formData, "decision");
  const note = str(formData, "note") || null;
  const amount = int(formData, "amount");

  if (decision !== "approve" && decision !== "reject") go(back, "error", "Aksi tidak dikenal.");
  if (decision === "reject" && !note) go(back, "error", "Isi catatan alasan penolakan supaya penyewa tahu.");

  const patch =
    decision === "approve"
      ? {
          status: "approved" as const,
          reviewed_at: new Date().toISOString(),
          note,
          ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
        }
      : { status: "rejected" as const, reviewed_at: new Date().toISOString(), note };

  // .eq("status", "pending") mencegah dobel klik / dua admin menyetujui bersamaan.
  const { data, error } = await supabase
    .from("payments")
    .update(patch)
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id");

  if (error) go(back, "error", "Gagal menyimpan keputusan.");
  if (!data || data.length === 0) go(back, "error", "Pembayaran ini sudah diproses.");
  go(back, "ok", decision === "approve" ? "Pembayaran disetujui." : "Pembayaran ditolak.");
}

// ---------------------------------------------------------------- unit & kamar

const MAX_UNIT_PHOTOS = 8;

async function uploadUnitPhoto(unitId: string, file: File): Promise<string> {
  const ext = PHOTO_EXT[file.type];
  if (!ext) throw new Error("Foto harus berformat JPG, PNG, atau WebP.");
  if (file.size > MAX_PHOTO) throw new Error("Ukuran foto maksimal 3 MB.");

  const admin = createAdminClient();
  const path = `${unitId}/${Date.now()}.${ext}`;
  const { error } = await admin.storage
    .from("unit-photos")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error("Gagal mengunggah foto.");
  return admin.storage.from("unit-photos").getPublicUrl(path).data.publicUrl;
}

function photoFrom(formData: FormData): File | null {
  const f = formData.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
}

/** Foto unit sekarang: galeri `photos`, dengan `photo_url` (foto pertama) tetap diisi untuk kompatibilitas. */
async function setUnitPhotos(supabase: SupabaseClient, unitId: string, photos: string[]) {
  return supabase.from("units").update({ photos, photo_url: photos[0] ?? null }).eq("id", unitId);
}

export async function createUnit(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/kamar";
  const name = str(formData, "name");
  if (!name) go(back, "error", "Nama unit belum diisi.");

  const { data: unit, error } = await supabase
    .from("units")
    .insert({ name, address: str(formData, "address") || null, description: str(formData, "description") || null })
    .select("id")
    .single();
  if (error || !unit) go(back, "error", "Gagal menyimpan unit.");

  const photo = photoFrom(formData);
  if (photo) {
    let url: string;
    try {
      url = await uploadUnitPhoto(unit.id, photo);
    } catch (e) {
      go(back, "error", `Unit tersimpan, tapi ${e instanceof Error ? e.message.toLowerCase() : "foto gagal diunggah"}`);
    }
    const { error: photoError } = await setUnitPhotos(supabase, unit.id, [url]);
    if (photoError) go(back, "error", "Unit tersimpan, tapi foto gagal disimpan. Pastikan migrasi foto sudah dijalankan.");
  }
  go(back, "ok", `Unit ${name} ditambahkan.`);
}

export async function addUnitPhoto(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/kamar";
  const unitId = str(formData, "unit_id");
  const photo = photoFrom(formData);
  if (!photo) go(back, "error", "Pilih foto dulu.");

  const { data: unit } = await supabase.from("units").select("photos, photo_url").eq("id", unitId).maybeSingle();
  if (!unit) go(back, "error", "Unit tidak ditemukan.");
  const current: string[] = unit.photos?.length ? unit.photos : unit.photo_url ? [unit.photo_url] : [];
  if (current.length >= MAX_UNIT_PHOTOS) go(back, "error", `Maksimal ${MAX_UNIT_PHOTOS} foto per unit. Hapus satu dulu.`);

  let url: string;
  try {
    url = await uploadUnitPhoto(unitId, photo);
  } catch (e) {
    go(back, "error", e instanceof Error ? e.message : "Gagal mengunggah foto.");
  }
  const { error } = await setUnitPhotos(supabase, unitId, [...current, url]);
  if (error) go(back, "error", "Gagal menyimpan foto. Pastikan migrasi foto sudah dijalankan.");
  go(back, "ok", "Foto ditambahkan.");
}

export async function removeUnitPhoto(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/kamar";
  const unitId = str(formData, "unit_id");
  const url = str(formData, "url");

  // URL harus benar-benar ada di galeri unit ini: jangan percaya input form.
  const { data: unit } = await supabase.from("units").select("photos, photo_url").eq("id", unitId).maybeSingle();
  const current: string[] = unit?.photos?.length ? unit.photos : unit?.photo_url ? [unit.photo_url] : [];
  if (!unit || !current.includes(url)) go(back, "error", "Foto tidak ditemukan.");

  const { error } = await setUnitPhotos(
    supabase,
    unitId,
    current.filter((u) => u !== url),
  );
  if (error) go(back, "error", "Gagal menghapus foto.");

  const objectPath = new URL(url).pathname.split("/unit-photos/")[1];
  if (objectPath) await createAdminClient().storage.from("unit-photos").remove([decodeURIComponent(objectPath)]);
  go(back, "ok", "Foto dihapus.");
}

export async function createRoom(formData: FormData) {
  const { supabase } = await requireAdmin();
  const back = "/admin/kamar";
  const unitId = str(formData, "unit_id");
  const name = str(formData, "name");
  const price = int(formData, "monthly_price");
  const facilities = str(formData, "facilities")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name) go(back, "error", "Nama/nomor kamar belum diisi.");
  if (!Number.isFinite(price) || price <= 0) go(back, "error", "Harga per bulan tidak valid.");

  const { error } = await supabase
    .from("rooms")
    .insert({ unit_id: unitId, name, monthly_price: price, facilities });
  if (error) go(back, "error", error.code === "23505" ? "Nama kamar itu sudah ada di unit ini." : "Gagal menyimpan kamar.");
  go(back, "ok", `Kamar ${name} ditambahkan.`);
}

export async function setRoomActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const roomId = str(formData, "room_id");
  const active = str(formData, "active") === "true";
  const { error } = await supabase.from("rooms").update({ is_active: active }).eq("id", roomId);
  if (error) go("/admin/kamar", "error", "Gagal mengubah status kamar.");
  go("/admin/kamar", "ok", active ? "Kamar ditampilkan di landing page." : "Kamar disembunyikan dari landing page.");
}
