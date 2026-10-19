import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import type { Room, Unit } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";
import { createRoom, createUnit, setRoomActive, updateUnitPhoto } from "../actions";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();

  const [unitsRes, roomsRes, leasesRes] = await Promise.all([
    supabase.from("units").select("*").order("sort_order").order("name"),
    supabase.from("rooms").select("*").order("name"),
    supabase.from("leases").select("room_id, tenants(full_name)").eq("status", "active"),
  ]);

  const units = (unitsRes.data ?? []) as Unit[];
  const rooms = (roomsRes.data ?? []) as Room[];
  const tenantByRoom = new Map(
    ((leasesRes.data ?? []) as unknown as { room_id: string; tenants: { full_name: string } | null }[]).map((l) => [
      l.room_id,
      l.tenants?.full_name ?? "penyewa",
    ]),
  );

  return (
    <>
      <Flash ok={ok} error={error} />
      <h1 className="text-3xl font-bold">Unit dan kamar</h1>
      <p className="mt-1 text-abu">Yang tampil di landing page: unit, foto, harga, dan status kosong/terisi.</p>

      {units.length === 0 && <p className="mt-6 text-abu">Belum ada unit. Tambah unit pertama di bawah.</p>}

      {units.map((unit) => {
        const list = rooms.filter((r) => r.unit_id === unit.id).sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
        return (
          <section key={unit.id} className="mt-8 border-t border-batu pt-6">
            <div className="flex items-start gap-3">
              {unit.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={unit.photo_url} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-lumut font-display text-2xl font-bold text-pandan/40">
                  {unit.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-bold">{unit.name}</h2>
                {unit.address && <p className="text-sm text-abu">{unit.address}</p>}
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">
                {unit.photo_url ? "Ganti foto unit" : "Tambah foto unit"}
              </summary>
              <form action={updateUnitPhoto} className="mt-3 space-y-3">
                <input type="hidden" name="unit_id" value={unit.id} />
                <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="input" />
                <SubmitButton pendingText="Mengunggah…" className="btn btn-primary btn-sm">
                  Unggah foto
                </SubmitButton>
              </form>
            </details>

            <ul className="mt-4 divide-y divide-batu border-y border-batu">
              {list.length === 0 && <li className="py-3 text-abu">Belum ada kamar di unit ini.</li>}
              {list.map((room) => {
                const tenant = tenantByRoom.get(room.id);
                return (
                  <li key={room.id} className="flex items-center gap-3 py-3">
                    <span className={`plate ${!room.is_active ? "plate-taken" : tenant ? "plate-taken" : "plate-free"}`}>
                      {room.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{formatRupiah(room.monthly_price)}</p>
                      <p className="truncate text-sm text-abu">
                        {!room.is_active ? "Disembunyikan dari landing page" : tenant ? `Dihuni ${tenant}` : "Kosong"}
                        {room.facilities.length > 0 ? ` · ${room.facilities.join(", ")}` : ""}
                      </p>
                    </div>
                    <form action={setRoomActive}>
                      <input type="hidden" name="room_id" value={room.id} />
                      <input type="hidden" name="active" value={room.is_active ? "false" : "true"} />
                      <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                        {room.is_active ? "Sembunyikan" : "Tampilkan"}
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>

            <details className="mt-4 rounded-xl border border-batu bg-white p-4">
              <summary className="cursor-pointer font-semibold">Tambah kamar di {unit.name}</summary>
              <form action={createRoom} className="mt-4 space-y-3">
                <input type="hidden" name="unit_id" value={unit.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Nama / nomor kamar</span>
                    <input name="name" required placeholder="A1" className="input" />
                  </label>
                  <label className="field">
                    <span>Harga per bulan</span>
                    <input name="monthly_price" required inputMode="numeric" placeholder="1500000" className="input" />
                  </label>
                </div>
                <label className="field">
                  <span>Fasilitas (pisahkan dengan koma)</span>
                  <input name="facilities" placeholder="AC, kamar mandi dalam, kasur" className="input" />
                </label>
                <SubmitButton className="btn btn-primary w-full">Simpan kamar</SubmitButton>
              </form>
            </details>
          </section>
        );
      })}

      <section className="mt-10 border-t border-batu pt-6">
        <details open={units.length === 0} className="rounded-xl border border-batu bg-white p-4">
          <summary className="cursor-pointer font-semibold">Tambah unit kos baru</summary>
          <form action={createUnit} className="mt-4 space-y-3">
            <label className="field">
              <span>Nama unit</span>
              <input name="name" required placeholder="Kos Melati" className="input" />
            </label>
            <label className="field">
              <span>Alamat</span>
              <input name="address" className="input" />
            </label>
            <label className="field">
              <span>Deskripsi singkat</span>
              <textarea name="description" rows={3} className="input" placeholder="Dekat kampus, parkir motor, ada dapur bersama" />
            </label>
            <label className="field">
              <span>Foto (JPG/PNG/WebP, maks 3 MB)</span>
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
            </label>
            <SubmitButton pendingText="Menyimpan…" className="btn btn-primary w-full">
              Simpan unit
            </SubmitButton>
          </form>
        </details>
      </section>
    </>
  );
}
