import Link from "next/link";
import { Flash } from "@/components/Flash";
import { getSupabase, requireAdmin } from "@/lib/auth";
import { getActiveOverview } from "@/lib/overview";
import { formatDate, formatRupiah } from "@/lib/utils";

type EndedLease = {
  id: string;
  end_date: string;
  tenants: { full_name: string } | null;
  rooms: { name: string; units: { name: string } | null } | null;
};

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await getSupabase();

  const [, overview, endedRes] = await Promise.all([
    requireAdmin(),
    getActiveOverview(supabase),
    supabase
      .from("leases")
      .select("id, end_date, tenants(full_name), rooms(name, units(name))")
      .eq("status", "ended")
      .order("end_date", { ascending: false })
      .limit(15),
  ]);
  const ended = (endedRes.data ?? []) as unknown as EndedLease[];

  return (
    <>
      <Flash ok={ok} error={error} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Penyewa</h1>
        <Link href="/admin/penyewa/baru" className="btn btn-primary btn-sm">
          Tambah penyewa
        </Link>
      </div>

      {overview.length === 0 ? (
        <p className="mt-6 text-abu">Belum ada penyewa aktif. Tambah penyewa untuk mulai mencatat sewa dan tagihan.</p>
      ) : (
        <ul className="mt-4 divide-y divide-batu border-y border-batu">
          {overview.map((o) => (
            <li key={o.lease.id}>
              <Link href={`/admin/penyewa/${o.lease.id}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.tenantName}</p>
                  <p className="truncate text-sm text-abu">
                    {o.unitName}, kamar {o.roomName} · masuk {formatDate(o.lease.start_date)} · {o.lease.duration_months} bulan
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {o.summary.overdueAmount > 0 ? (
                    <span className="badge badge-bad">Nunggak {formatRupiah(o.summary.overdueAmount)}</span>
                  ) : (
                    <span className="badge badge-ok">Lunas</span>
                  )}
                  {o.pendingCount > 0 && <span className="badge badge-warn">Bukti menunggu</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {ended.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-abu">Sewa yang sudah berakhir</h2>
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {ended.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/penyewa/${l.id}`} className="flex items-center justify-between gap-3 py-3 text-abu">
                  <span className="truncate">
                    {l.tenants?.full_name} · {l.rooms?.units?.name}, kamar {l.rooms?.name}
                  </span>
                  <span className="shrink-0 text-sm">selesai {formatDate(l.end_date, "d MMM yyyy")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
