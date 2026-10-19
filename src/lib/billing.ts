import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

export type ChargeRow = {
  id: string;
  lease_id: string;
  type: "rent" | "galon" | "other";
  description: string;
  amount: number;
  due_date: string;
  created_at: string;
};

export type AllocatedCharge = ChargeRow & {
  paid: number;
  unpaid: number;
  status: "paid" | "partial" | "unpaid";
};

/**
 * Alokasi pembayaran ke tagihan secara FIFO (tagihan terlama dilunasi duluan).
 * Kelebihan bayar otomatis menutup tagihan berikutnya begitu tagihan itu muncul.
 */
export function allocate(charges: ChargeRow[], totalPaid: number): AllocatedCharge[] {
  const sorted = [...charges].sort(
    (a, b) => a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at),
  );
  let remaining = totalPaid;
  return sorted.map((c) => {
    const paid = Math.max(0, Math.min(c.amount, remaining));
    remaining -= paid;
    return {
      ...c,
      paid,
      unpaid: c.amount - paid,
      status: paid === 0 ? "unpaid" : paid < c.amount ? "partial" : "paid",
    };
  });
}

export type LeaseSummary = {
  charges: AllocatedCharge[];
  paidTotal: number;
  /** Total tagihan yang sudah jatuh tempo (<= hari ini) dan belum lunas. */
  overdueAmount: number;
  /** Tagihan yang sudah muncul tapi jatuh temponya belum tiba. */
  upcomingAmount: number;
  oldestUnpaidDue: string | null;
  daysOverdue: number;
  /** Total yang harus dibayar sekarang (jatuh tempo + yang sudah muncul). */
  payableNow: number;
};

export function summarize(charges: ChargeRow[], paidTotal: number, today: string): LeaseSummary {
  const allocated = allocate(charges, paidTotal);
  const overdue = allocated.filter((c) => c.unpaid > 0 && c.due_date <= today);
  const upcoming = allocated.filter((c) => c.unpaid > 0 && c.due_date > today);
  const overdueAmount = overdue.reduce((s, c) => s + c.unpaid, 0);
  const upcomingAmount = upcoming.reduce((s, c) => s + c.unpaid, 0);
  const oldestUnpaidDue = overdue[0]?.due_date ?? null;
  return {
    charges: allocated,
    paidTotal,
    overdueAmount,
    upcomingAmount,
    oldestUnpaidDue,
    daysOverdue: oldestUnpaidDue ? differenceInCalendarDays(parseISO(today), parseISO(oldestUnpaidDue)) : 0,
    payableNow: overdueAmount + upcomingAmount,
  };
}

/** Tanggal tagihan sewa berikutnya (>= hari ini) berdasarkan jadwal bulanan lease. */
export function nextRentDue(startDate: string, durationMonths: number, today: string): string | null {
  const start = parseISO(startDate);
  for (let k = 0; k < durationMonths; k++) {
    const d = format(addMonths(start, k), "yyyy-MM-dd");
    if (d >= today) return d;
  }
  return null;
}

export function endDateFor(startDate: string, durationMonths: number): string {
  return format(addMonths(parseISO(startDate), durationMonths), "yyyy-MM-dd");
}

export function daysUntil(iso: string, today: string) {
  return differenceInCalendarDays(parseISO(iso), parseISO(today));
}
