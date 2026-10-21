import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysUntil, nextRentDue, summarize, type ChargeRow, type LeaseSummary } from "@/lib/billing";
import type { Lease } from "@/lib/types";
import { todayWIB } from "@/lib/utils";

export type LeaseOverview = {
  lease: Lease;
  tenantName: string;
  tenantPhone: string;
  roomName: string;
  unitName: string;
  summary: LeaseSummary;
  pendingAmount: number;
  pendingCount: number;
  nextDue: string | null;
  endsInDays: number;
};

type LeaseJoin = Lease & {
  tenants: { full_name: string; phone: string } | null;
  rooms: { name: string; units: { name: string } | null } | null;
};

/**
 * Ringkasan semua sewa aktif: tunggakan, pembayaran menunggu, jatuh tempo, dst.
 * Tiga query jalan paralel (satu kali bolak-balik): tagihan dan pembayaran difilter
 * lewat relasi ke sewa aktif, bukan menunggu daftar sewa selesai diambil dulu.
 */
export async function getActiveOverview(supabase: SupabaseClient): Promise<LeaseOverview[]> {
  const today = todayWIB();

  const [leasesRes, chargesRes, paymentsRes] = await Promise.all([
    supabase.from("leases").select("*, tenants(full_name, phone), rooms(name, units(name))").eq("status", "active"),
    supabase.from("charges").select("*, leases!inner(status)").eq("leases.status", "active"),
    supabase
      .from("payments")
      .select("lease_id, amount, status, leases!inner(status)")
      .eq("leases.status", "active")
      .in("status", ["approved", "pending"]),
  ]);

  const rows = (leasesRes.data ?? []) as LeaseJoin[];
  const charges = (chargesRes.data ?? []) as unknown as ChargeRow[];
  const payments = (paymentsRes.data ?? []) as unknown as { lease_id: string; amount: number; status: string }[];

  return rows
    .map((l) => {
      const myCharges = charges.filter((c) => c.lease_id === l.id);
      const mine = payments.filter((p) => p.lease_id === l.id);
      const paid = mine.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
      const pending = mine.filter((p) => p.status === "pending");
      return {
        lease: l,
        tenantName: l.tenants?.full_name ?? "(tanpa nama)",
        tenantPhone: l.tenants?.phone ?? "",
        roomName: l.rooms?.name ?? "?",
        unitName: l.rooms?.units?.name ?? "?",
        summary: summarize(myCharges, paid, today),
        pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
        pendingCount: pending.length,
        nextDue: nextRentDue(l.start_date, l.duration_months, today),
        endsInDays: daysUntil(l.end_date, today),
      };
    })
    .sort(
      (a, b) =>
        b.summary.daysOverdue - a.summary.daysOverdue ||
        a.unitName.localeCompare(b.unitName, "id") ||
        a.roomName.localeCompare(b.roomName, "id", { numeric: true }),
    );
}
