import Link from "next/link";
import { Flash } from "@/components/Flash";
import { LeaseRow, dueNote } from "@/components/LeaseRow";
import { requireAdmin } from "@/lib/auth";
import { daysUntil } from "@/lib/billing";
import { getActiveOverview } from "@/lib/overview";
import { formatDate, formatRupiah, todayWIB } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const today = todayWIB();

  const [overview, roomsRes] = await Promise.all([
    getActiveOverview(supabase),
    supabase.from("rooms").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const totalRooms = roomsRes.count ?? 0;
  const pendingCount = overview.reduce((s, o) => s + o.pendingCount, 0);
  const overdue = overview.filter((o) => o.summary.overdueAmount > 0);
  const overdueTotal = overdue.reduce((s, o) => s + o.summary.overdueAmount, 0);
  const dueSoon = overview.filter((o) => {
    if (o.summary.overdueAmount > 0 || !o.nextDue) return false;
    const d = daysUntil(o.nextDue, today);
    return d >= 0 && d <= 7;
  });
  const ending = overview.filter((o) => o.endsInDays >= 0 && o.endsInDays <= 30);

  return (
    <>
      <Flash ok={ok} error={error} />
      <h1 className="text-3xl font-bold">Ringkasan</h1>
      <p className="mt-1 text-abu">{formatDate(today, "EEEE, d MMMM yyyy")}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <dt className="text-sm text-abu">Kamar terisi</dt>
          <dd className="mt-1 font-display text-2xl font-bold">
            {overview.length}
            <span className="text-base font-medium text-abu"> dari {totalRooms}</span>
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-sm text-abu">Total tunggakan</dt>
          <dd className={`mt-1 font-display text-2xl font-bold ${overdueTotal > 0 ? "text-bata" : ""}`}>
            {formatRupiah(overdueTotal)}
          </dd>
        </div>
      </dl>

      <Link
        href="/admin/verifikasi"
        className={`mt-4 flex items-center justify-between rounded-2xl px-4 py-4 font-semibold ${
          pendingCount > 0 ? "bg-kunyit text-ink" : "border border-batu bg-white text-abu"
        }`}
      >
        <span>
          {pendingCount > 0
            ? `${pendingCount} bukti bayar menunggu dicek`
            : "Tidak ada bukti bayar yang menunggu"}
        </span>
        {pendingCount > 0 && <span className="underline underline-offset-4">Cek</span>}
      </Link>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Nunggak ({overdue.length})</h2>
        {overdue.length === 0 ? (
          <p className="mt-2 text-abu">Semua tagihan yang jatuh tempo sudah lunas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {overdue.map((o) => (
              <LeaseRow key={o.lease.id} o={o} showRemind />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Jatuh tempo 7 hari ke depan ({dueSoon.length})</h2>
        {dueSoon.length === 0 ? (
          <p className="mt-2 text-abu">Tidak ada yang jatuh tempo minggu ini.</p>
        ) : (
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {dueSoon.map((o) => (
              <LeaseRow key={o.lease.id} o={o} note={o.nextDue ? dueNote(o.nextDue) : null} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Sewa hampir habis ({ending.length})</h2>
        {ending.length === 0 ? (
          <p className="mt-2 text-abu">Tidak ada sewa yang habis dalam 30 hari.</p>
        ) : (
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {ending.map((o) => (
              <LeaseRow
                key={o.lease.id}
                o={o}
                note={
                  <span className="text-abu">
                    Habis {formatDate(o.lease.end_date, "d MMM")} ({o.endsInDays === 0 ? "hari ini" : `${o.endsInDays} hari lagi`})
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
