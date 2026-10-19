import Link from "next/link";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { formatRupiah, todayWIB } from "@/lib/utils";
import { createLease } from "../../actions";

type RoomOption = { id: string; name: string; monthly_price: number; unit_id: string };

export default async function NewTenantPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();

  const [units, rooms, active] = await Promise.all([
    supabase.from("units").select("id, name").order("sort_order").order("name"),
    supabase.from("rooms").select("id, name, monthly_price, unit_id").eq("is_active", true).order("name"),
    supabase.from("leases").select("room_id").eq("status", "active"),
  ]);

  const occupied = new Set((active.data ?? []).map((l) => l.room_id));
  const vacant = ((rooms.data ?? []) as RoomOption[]).filter((r) => !occupied.has(r.id));

  return (
    <>
      <Link href="/admin/penyewa" className="text-sm font-semibold text-abu underline underline-offset-4">
        Kembali ke daftar penyewa
      </Link>
      <h1 className="mt-3 text-3xl font-bold">Tambah penyewa</h1>

      {vacant.length === 0 ? (
        <p className="mt-4 text-abu">
          Tidak ada kamar kosong. Tambah kamar di menu <Link href="/admin/kamar" className="font-semibold underline">Kamar</Link>, atau
          akhiri sewa yang sudah selesai.
        </p>
      ) : (
        <form action={createLease} className="mt-5 space-y-4">
          <Flash error={error} />

          <label className="field">
            <span>Nama lengkap</span>
            <input name="full_name" required autoComplete="off" className="input" />
          </label>

          <label className="field">
            <span>Nomor WhatsApp</span>
            <input name="phone" required inputMode="tel" placeholder="0812 3456 7890" autoComplete="off" className="input" />
          </label>

          <label className="field">
            <span>Kamar</span>
            <select name="room_id" required defaultValue="" className="input">
              <option value="" disabled>
                Pilih kamar kosong
              </option>
              {(units.data ?? []).map((u) => {
                const list = vacant.filter((r) => r.unit_id === u.id);
                if (list.length === 0) return null;
                return (
                  <optgroup key={u.id} label={u.name}>
                    {list.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {formatRupiah(r.monthly_price)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Tanggal masuk</span>
              <input name="start_date" type="date" required defaultValue={todayWIB()} className="input" />
            </label>
            <label className="field">
              <span>Lama sewa (bulan)</span>
              <input name="duration_months" type="number" min={1} max={60} required defaultValue={6} inputMode="numeric" className="input" />
            </label>
          </div>

          <label className="field">
            <span>Harga per bulan (kosongkan untuk pakai harga kamar)</span>
            <input name="monthly_price" inputMode="numeric" placeholder="Contoh: 1500000" className="input" />
          </label>

          <SubmitButton className="btn btn-primary w-full">Simpan penyewa</SubmitButton>
        </form>
      )}
    </>
  );
}
