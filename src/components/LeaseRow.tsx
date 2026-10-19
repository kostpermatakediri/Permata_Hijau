import Link from "next/link";
import type { LeaseOverview } from "@/lib/overview";
import { reminderMessage } from "@/lib/messages";
import { formatDate, formatRupiah, waLink } from "@/lib/utils";

/** Baris penyewa: tap untuk detail, tombol WA terpisah supaya tidak ada link di dalam link. */
export function LeaseRow({ o, showRemind = false, note }: { o: LeaseOverview; showRemind?: boolean; note?: React.ReactNode }) {
  const { summary } = o;
  return (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/admin/penyewa/${o.lease.id}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold">{o.tenantName}</p>
        <p className="truncate text-sm text-abu">
          {o.unitName}, kamar {o.roomName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {summary.overdueAmount > 0 && (
            <>
              <span className="font-semibold text-bata">{formatRupiah(summary.overdueAmount)}</span>
              <span className="badge badge-bad">Telat {summary.daysOverdue} hari</span>
            </>
          )}
          {o.pendingCount > 0 && <span className="badge badge-warn">Bukti menunggu dicek</span>}
          {note}
        </div>
      </Link>
      {showRemind && o.tenantPhone && summary.overdueAmount > 0 && (
        <a
          className="btn btn-wa btn-sm shrink-0"
          target="_blank"
          rel="noopener"
          href={waLink(
            o.tenantPhone,
            reminderMessage({
              name: o.tenantName,
              amount: summary.payableNow,
              oldestDue: summary.oldestUnpaidDue,
              token: o.lease.token,
            }),
          )}
        >
          Ingatkan
        </a>
      )}
    </li>
  );
}

export function dueNote(date: string) {
  return <span className="text-abu">Jatuh tempo {formatDate(date, "d MMM")}</span>;
}
