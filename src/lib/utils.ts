import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function formatRupiah(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
}

/** Tanggal hari ini di WIB dalam format YYYY-MM-DD (server Vercel jalan di UTC). */
export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function formatDate(iso: string, pattern = "d MMM yyyy") {
  return format(parseISO(iso), pattern, { locale: idLocale });
}

/** 0812-3456-789 / +62 812... / 62812... -> 628123456789 */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

export function waLink(phone: string, message?: string) {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Ambil string dari FormData dan rapikan. */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Ambil angka bulat dari FormData. Menerima "1.500.000" / "1500000". */
export function int(fd: FormData, key: string): number {
  const raw = str(fd, key).replace(/[.\s]/g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}
