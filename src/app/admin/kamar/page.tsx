import { Flash } from "@/components/Flash";
import { PhotoInput } from "@/components/PhotoInput";
import { SubmitButton } from "@/components/SubmitButton";
import { getSupabase, requireAdmin } from "@/lib/auth";
import type { Room, Unit } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";
import { addUnitPhoto, createRoom, createUnit, removeUnitPhoto, setRoomActive } from "../actions";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await getSupabase();

  const [, unitsRes, roomsRes, leasesRes] = await Promise.all([
    requireAdmin(),
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
        const photos = unit.photos?.length ? unit.photos : unit.photo_url ? [unit.photo_url] : [];
        const list = rooms.filter((r) => r.unit_id === unit.id).sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
        return (
          <section key={unit.id} className="mt-8 border-t border-batu pt-6">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{unit.name}</h2>
              {unit.address && <p className="text-sm text-abu">{unit.address}</p>}
            </div>

            {photos.length > 0 ? (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((url, i) => (
                  <li key={url} className="min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${i + 1} ${unit.name}`} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                    <form action={removeUnitPhoto} className="mt-1">
                      <input type="hidden" name="unit_id" value={unit.id} />
                      <input type="hidden" name="url" value={url} />
                      <SubmitButton
                        className="w-full text-sm font-semibold text-bata underline underline-offset-4"
                        pendingText="…"
                        confirm="Hapus foto ini dari landing page?"
                      >
                        Hapus
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-abu">Belum ada foto. Landing page paling menarik kalau ada foto kamar dan lingkungan.</p>
            )}

            {photos.length < 8 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">Tambah foto</summary>
                <form action={addUnitPhoto} className="mt-3 space-y-3">
                  <input type="hidden" name="unit_id" value={unit.id} />
                  <PhotoInput required />
                  <SubmitButton pendingText="Mengunggah…" className="btn btn-primary btn-sm">
                    Unggah foto
                  </SubmitButton>
                </form>
              </details>
            )}

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
              <span>Foto pertama (opsional, foto lain bisa ditambah nanti)</span>
              <PhotoInput />
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
