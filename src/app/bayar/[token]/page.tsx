import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { summarize, type ChargeRow } from "@/lib/billing";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment } from "@/lib/types";
import { formatDate, formatRupiah, todayWIB, waLink } from "@/lib/utils";
import { PaymentForm } from "./PaymentForm";

// Link ini berisi token rahasia: jangan diindeks mesin pencari dan jangan bocor lewat Referer.
export const metadata: Metadata = {
  title: "Tagihan kos",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[a-f0-9]{36}$/;

const statusLabel = {
  approved: ["badge badge-ok", "Diterima"],
  pending: ["badge badge-warn", "Menunggu dicek"],
  rejected: ["badge badge-bad", "Ditolak"],
} as const;

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();

  const db = createAdminClient();
  const { data: lease } = await db
    .from("leases")
    .select("id, status, tenants(full_name), rooms(name, units(name))")
    .eq("token", token)
    .maybeSingle();
  if (!lease) notFound();

  const tenant = lease.tenants as unknown as { full_name: string } | null;
  const room = lease.rooms as unknown as { name: string; units: { name: string } | null } | null;

  const [chargesRes, paymentsRes] = await Promise.all([
    db.from("charges").select("*").eq("lease_id", lease.id),
    db
      .from("payments")
      .select("id, amount, paid_date, status, note, created_at")
      .eq("lease_id", lease.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const charges = (chargesRes.data ?? []) as ChargeRow[];
  const payments = (paymentsRes.data ?? []) as Pick<Payment, "id" | "amount" | "paid_date" | "status" | "note" | "created_at">[];

  // Total semua pembayaran disetujui (bukan cuma 10 terakhir).
  const { data: approvedRows } = await db.from("payments").select("amount").eq("lease_id", lease.id).eq("status", "approved");
  const approvedTotal = (approvedRows ?? []).reduce((s, p) => s + p.amount, 0);

  const summary = summarize(charges, approvedTotal, todayWIB());
  const unpaid = summary.charges.filter((c) => c.unpaid > 0);
  const pendingTotal = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const toTransfer = Math.max(0, summary.payableNow - pendingTotal);
  const firstName = (tenant?.full_name ?? "").split(" ")[0];
  const hasBank = config.bank.account.length > 0;

  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-6">
      <p className="font-display text-lg font-bold">{config.kosName}</p>

      <h1 className="mt-8 text-3xl font-bold">Halo Kak {firstName}</h1>
      <p className="mt-1 text-abu">
        {room?.units?.name}, kamar {room?.name}
      </p>

      <section className="mt-6 rounded-2xl bg-ink p-5 text-white" aria-label="Total tagihan">
        <p className="text-sm text-white/70">{summary.payableNow > 0 ? "Total tagihan" : "Status tagihan"}</p>
        <p className="mt-1 font-display text-4xl font-bold">
          {summary.payableNow > 0 ? formatRupiah(summary.payableNow) : "Lunas"}
        </p>
        {summary.daysOverdue > 0 && (
          <p className="mt-1 text-sm text-kunyit">Sudah lewat {summary.daysOverdue} hari dari jatuh tempo</p>
        )}
        {summary.payableNow === 0 && <p className="mt-1 text-sm text-white/70">Tidak ada tagihan yang perlu dibayar. Terima kasih!</p>}
      </section>

      {unpaid.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Rincian</h2>
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {unpaid.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{c.description}</p>
                  <p className="text-sm text-abu">Jatuh tempo {formatDate(c.due_date)}</p>
                </div>
                <p className="shrink-0 font-semibold">{formatRupiah(c.unpaid)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingTotal > 0 && (
        <p role="status" className="mt-6 rounded-xl bg-kunyit/25 px-4 py-3 text-sm font-semibold">
          Bukti bayar {formatRupiah(pendingTotal)} sudah terkirim dan sedang dicek pengelola.
        </p>
      )}

      {summary.payableNow > 0 && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-bold">Transfer ke</h2>
            {hasBank ? (
              <div className="card mt-2 p-4">
                <p className="text-sm text-abu">{config.bank.name}</p>
                <p className="font-display text-2xl font-bold tracking-wide">{config.bank.account}</p>
                <p className="text-sm text-abu">a.n. {config.bank.holder}</p>
                <div className="mt-3">
                  <CopyButton text={config.bank.account} label="Salin nomor rekening" />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-abu">Nomor rekening belum diatur. Tanyakan ke pengelola lewat WhatsApp.</p>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Sudah transfer?</h2>
            <p className="mb-4 mt-1 text-abu">Kirim foto bukti transfernya di sini.</p>
            <PaymentForm token={token} defaultAmount={toTransfer} />
          </section>
        </>
      )}

      {payments.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">Riwayat bayar</h2>
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {payments.map((p) => {
              const [cls, label] = statusLabel[p.status];
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{formatRupiah(p.amount)}</p>
                    <p className="text-sm text-abu">{formatDate(p.paid_date)}</p>
                    {p.status === "rejected" && p.note && <p className="text-sm text-bata">{p.note}</p>}
                  </div>
                  <span className={cls}>{label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {config.waNumber && (
        <p className="mt-10 text-sm text-abu">
          Ada yang tidak sesuai?{" "}
          <a
            href={waLink(config.waNumber, `Halo, saya ${tenant?.full_name} (kamar ${room?.name}), mau tanya soal tagihan kos.`)}
            className="font-semibold text-ink underline underline-offset-4"
            target="_blank"
            rel="noopener"
          >
            Tanya pengelola lewat WhatsApp
          </a>
        </p>
      )}
    </div>
  );
}
