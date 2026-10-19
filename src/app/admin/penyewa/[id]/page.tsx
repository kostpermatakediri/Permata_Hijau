import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { summarize, type ChargeRow } from "@/lib/billing";
import { config } from "@/lib/config";
import { payLink, payLinkMessage, reminderMessage } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Lease, Payment } from "@/lib/types";
import { formatDate, formatRupiah, todayWIB, waLink } from "@/lib/utils";
import { addCharge, addGalon, deleteCharge, endLease, recordPayment } from "../../actions";

type LeaseJoin = Lease & {
  tenants: { full_name: string; phone: string } | null;
  rooms: { name: string; units: { name: string } | null } | null;
};

const paymentBadge = {
  approved: ["badge badge-ok", "Disetujui"],
  pending: ["badge badge-warn", "Menunggu dicek"],
  rejected: ["badge badge-bad", "Ditolak"],
} as const;

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const today = todayWIB();

  const { data } = await supabase
    .from("leases")
    .select("*, tenants(full_name, phone), rooms(name, units(name))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const lease = data as LeaseJoin;

  const [chargesRes, paymentsRes] = await Promise.all([
    supabase.from("charges").select("*").eq("lease_id", id),
    supabase.from("payments").select("*").eq("lease_id", id).order("created_at", { ascending: false }),
  ]);
  const charges = (chargesRes.data ?? []) as ChargeRow[];
  const payments = (paymentsRes.data ?? []) as Payment[];

  const approvedTotal = payments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const summary = summarize(charges, approvedTotal, today);

  // Link bukti bayar (bucket private) berlaku 1 jam.
  const proofUrls = new Map<string, string>();
  const withProof = payments.filter((p) => p.proof_path);
  if (withProof.length > 0) {
    const { data: signed } = await createAdminClient()
      .storage.from("payment-proofs")
      .createSignedUrls(withProof.map((p) => p.proof_path!), 3600);
    signed?.forEach((s, i) => {
      if (s.signedUrl) proofUrls.set(withProof[i].id, s.signedUrl);
    });
  }

  const name = lease.tenants?.full_name ?? "Penyewa";
  const phone = lease.tenants?.phone ?? "";
  const back = `/admin/penyewa/${id}`;
  const chargesNewestFirst = [...summary.charges].reverse();

  return (
    <>
      <Link href="/admin/penyewa" className="text-sm font-semibold text-abu underline underline-offset-4">
        Kembali ke daftar penyewa
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{name}</h1>
          <p className="mt-1 text-abu">
            {lease.rooms?.units?.name}, kamar {lease.rooms?.name}
          </p>
          {phone && (
            <a href={`tel:+${phone}`} className="text-sm font-semibold underline underline-offset-4">
              +{phone}
            </a>
          )}
        </div>
        <span className={lease.status === "active" ? "badge badge-ok" : "badge badge-muted"}>
          {lease.status === "active" ? "Aktif" : "Berakhir"}
        </span>
      </div>

      <div className="mt-5">
        <Flash ok={ok} error={error} />
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <dt className="text-sm text-abu">Tunggakan</dt>
          <dd className={`mt-1 font-display text-2xl font-bold ${summary.overdueAmount > 0 ? "text-bata" : "text-pandan"}`}>
            {summary.overdueAmount > 0 ? formatRupiah(summary.overdueAmount) : "Lunas"}
          </dd>
          {summary.daysOverdue > 0 && <dd className="text-sm text-bata">telat {summary.daysOverdue} hari</dd>}
        </div>
        <div className="card p-4">
          <dt className="text-sm text-abu">Menunggu dicek</dt>
          <dd className="mt-1 font-display text-2xl font-bold">{formatRupiah(pendingTotal)}</dd>
          {summary.upcomingAmount > 0 && (
            <dd className="text-sm text-abu">+ {formatRupiah(summary.upcomingAmount)} segera jatuh tempo</dd>
          )}
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {phone && summary.payableNow > 0 && (
          <a
            className="btn btn-wa btn-sm"
            target="_blank"
            rel="noopener"
            href={waLink(
              phone,
              reminderMessage({
                name,
                amount: summary.payableNow,
                oldestDue: summary.oldestUnpaidDue,
                token: lease.token,
              }),
            )}
          >
            Ingatkan via WhatsApp
          </a>
        )}
        {phone && (
          <a
            className="btn btn-ghost btn-sm"
            target="_blank"
            rel="noopener"
            href={waLink(phone, payLinkMessage({ name, token: lease.token }))}
          >
            Kirim link bayar
          </a>
        )}
        <CopyButton text={payLink(lease.token)} />
      </div>

      <p className="mt-4 text-sm text-abu">
        Masuk {formatDate(lease.start_date)}, selesai {formatDate(lease.end_date)} ({lease.duration_months} bulan) ·{" "}
        {formatRupiah(lease.monthly_price)} per bulan
      </p>

      {lease.status === "active" && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Catat galon</h2>
          <form action={addGalon} className="mt-3 grid grid-cols-[5.5rem_1fr] items-end gap-3">
            <input type="hidden" name="lease_id" value={id} />
            <label className="field">
              <span>Jumlah</span>
              <input name="qty" type="number" min={1} max={50} defaultValue={1} required inputMode="numeric" className="input" />
            </label>
            <label className="field">
              <span>Harga per galon</span>
              <input name="price" required defaultValue={config.galonPrice} inputMode="numeric" className="input" />
            </label>
            <div className="col-span-2">
              <SubmitButton className="btn btn-primary w-full">Catat galon</SubmitButton>
            </div>
          </form>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">Tagihan</h2>
        {chargesNewestFirst.length === 0 ? (
          <p className="mt-2 text-abu">Belum ada tagihan.</p>
        ) : (
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {chargesNewestFirst.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.description}</p>
                  <p className="text-sm text-abu">
                    {formatDate(c.due_date)} · {formatRupiah(c.amount)}
                  </p>
                </div>
                {c.status === "paid" && <span className="badge badge-ok">Lunas</span>}
                {c.status === "partial" && <span className="badge badge-warn">Sisa {formatRupiah(c.unpaid)}</span>}
                {c.status === "unpaid" && (
                  <span className={c.due_date <= today ? "badge badge-bad" : "badge badge-muted"}>
                    {c.due_date <= today ? "Belum bayar" : "Belum jatuh tempo"}
                  </span>
                )}
                {c.type !== "rent" && (
                  <form action={deleteCharge}>
                    <input type="hidden" name="lease_id" value={id} />
                    <input type="hidden" name="charge_id" value={c.id} />
                    <SubmitButton
                      className="btn btn-danger btn-sm"
                      pendingText="…"
                      confirm={`Hapus tagihan "${c.description}"?`}
                    >
                      Hapus
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 rounded-xl border border-batu bg-white p-4">
          <summary className="cursor-pointer font-semibold">Tambah tagihan lain</summary>
          <form action={addCharge} className="mt-4 space-y-3">
            <input type="hidden" name="lease_id" value={id} />
            <label className="field">
              <span>Keterangan</span>
              <input name="description" required placeholder="Contoh: Listrik tambahan" className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span>Nominal</span>
                <input name="amount" required inputMode="numeric" className="input" />
              </label>
              <label className="field">
                <span>Jatuh tempo</span>
                <input name="due_date" type="date" defaultValue={today} className="input" />
              </label>
            </div>
            <SubmitButton className="btn btn-primary w-full">Simpan tagihan</SubmitButton>
          </form>
        </details>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Pembayaran</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-abu">Belum ada pembayaran.</p>
        ) : (
          <ul className="mt-2 divide-y divide-batu border-y border-batu">
            {payments.map((p) => {
              const [cls, label] = paymentBadge[p.status];
              const proof = proofUrls.get(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{formatRupiah(p.amount)}</p>
                    <p className="text-sm text-abu">
                      {formatDate(p.paid_date)} · {p.source === "admin" ? "dicatat pengelola" : "dikirim penyewa"}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                    {proof && (
                      <a href={proof} target="_blank" rel="noopener" className="text-sm font-semibold underline underline-offset-4">
                        Lihat bukti
                      </a>
                    )}
                  </div>
                  <span className={cls}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}

        <details className="mt-4 rounded-xl border border-batu bg-white p-4">
          <summary className="cursor-pointer font-semibold">Catat pembayaran langsung (tunai / sudah dicek)</summary>
          <form action={recordPayment} className="mt-4 space-y-3">
            <input type="hidden" name="lease_id" value={id} />
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span>Nominal</span>
                <input
                  name="amount"
                  required
                  inputMode="numeric"
                  defaultValue={summary.payableNow > 0 ? summary.payableNow : undefined}
                  className="input"
                />
              </label>
              <label className="field">
                <span>Tanggal bayar</span>
                <input name="paid_date" type="date" defaultValue={today} className="input" />
              </label>
            </div>
            <label className="field">
              <span>Catatan (opsional)</span>
              <input name="note" placeholder="Contoh: tunai" className="input" />
            </label>
            <SubmitButton className="btn btn-primary w-full">Simpan pembayaran</SubmitButton>
          </form>
        </details>
      </section>

      {lease.status === "active" && (
        <section className="mt-10 border-t border-batu pt-6">
          <h2 className="text-lg font-bold">Akhiri sewa</h2>
          <p className="mt-1 text-sm text-abu">
            Dipakai saat penyewa pindah. Kamar kembali tampil kosong di landing page. Riwayat tagihan tetap tersimpan.
          </p>
          <form action={endLease} className="mt-3">
            <input type="hidden" name="lease_id" value={id} />
            <SubmitButton
              className="btn btn-danger"
              confirm={`Akhiri sewa ${name}? Kamar akan tampil kosong.${
                summary.overdueAmount > 0 ? ` Masih ada tunggakan ${formatRupiah(summary.overdueAmount)}.` : ""
              }`}
            >
              Akhiri sewa
            </SubmitButton>
          </form>
        </section>
      )}
    </>
  );
}
