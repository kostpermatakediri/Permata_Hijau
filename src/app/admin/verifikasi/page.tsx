import Link from "next/link";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { getActiveOverview } from "@/lib/overview";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payment } from "@/lib/types";
import { formatDate, formatRupiah } from "@/lib/utils";
import { reviewPayment } from "../actions";

type PendingRow = Payment & {
  leases: {
    id: string;
    tenants: { full_name: string } | null;
    rooms: { name: string; units: { name: string } | null } | null;
  } | null;
};

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();

  const [pendingRes, overview] = await Promise.all([
    supabase
      .from("payments")
      .select("*, leases(id, tenants(full_name), rooms(name, units(name)))")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    getActiveOverview(supabase),
  ]);
  const pending = (pendingRes.data ?? []) as unknown as PendingRow[];
  const overviewByLease = new Map(overview.map((o) => [o.lease.id, o]));

  const proofUrls = new Map<string, string>();
  const withProof = pending.filter((p) => p.proof_path);
  if (withProof.length > 0) {
    const { data: signed } = await createAdminClient()
      .storage.from("payment-proofs")
      .createSignedUrls(withProof.map((p) => p.proof_path!), 3600);
    signed?.forEach((s, i) => {
      if (s.signedUrl) proofUrls.set(withProof[i].id, s.signedUrl);
    });
  }

  return (
    <>
      <Flash ok={ok} error={error} />
      <h1 className="text-3xl font-bold">Verifikasi bayar</h1>
      <p className="mt-1 text-abu">Cocokkan foto bukti dengan mutasi rekening, lalu setujui atau tolak.</p>

      {pending.length === 0 ? (
        <p className="mt-8 text-abu">Tidak ada bukti bayar yang menunggu. Yang baru masuk akan muncul di sini.</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {pending.map((p) => {
            const o = p.leases ? overviewByLease.get(p.leases.id) : undefined;
            const proof = proofUrls.get(p.id);
            return (
              <li key={p.id} className="card overflow-hidden">
                {proof ? (
                  <a href={proof} target="_blank" rel="noopener" aria-label="Buka bukti bayar ukuran penuh">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={proof} alt="Bukti transfer" className="max-h-96 w-full bg-lumut object-contain" />
                  </a>
                ) : (
                  <p className="bg-lumut px-4 py-6 text-center text-sm text-abu">Foto bukti tidak tersedia</p>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{p.leases?.tenants?.full_name ?? "Penyewa"}</p>
                      <p className="text-sm text-abu">
                        {p.leases?.rooms?.units?.name}, kamar {p.leases?.rooms?.name}
                      </p>
                      <p className="text-sm text-abu">Dikirim {formatDate(p.created_at.slice(0, 10))}</p>
                    </div>
                    {p.leases && (
                      <Link href={`/admin/penyewa/${p.leases.id}`} className="shrink-0 text-sm font-semibold underline underline-offset-4">
                        Detail
                      </Link>
                    )}
                  </div>

                  {o && (
                    <p className="mt-3 rounded-lg bg-lumut px-3 py-2 text-sm">
                      Tagihan saat ini <strong>{formatRupiah(o.summary.payableNow)}</strong>
                    </p>
                  )}

                  <form action={reviewPayment} className="mt-4 space-y-3">
                    <input type="hidden" name="payment_id" value={p.id} />
                    <label className="field">
                      <span>Nominal yang masuk (ubah kalau beda dengan yang diketik penyewa)</span>
                      <input name="amount" defaultValue={p.amount} inputMode="numeric" required className="input" />
                    </label>
                    <label className="field">
                      <span>Catatan (wajib diisi kalau ditolak)</span>
                      <input name="note" placeholder="Contoh: nominal tidak sesuai mutasi" className="input" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <SubmitButton name="decision" value="reject" className="btn btn-danger" pendingText="…" confirm="Tolak pembayaran ini?">
                        Tolak
                      </SubmitButton>
                      <SubmitButton name="decision" value="approve" className="btn btn-primary" pendingText="…">
                        Setujui
                      </SubmitButton>
                    </div>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
