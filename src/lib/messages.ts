import { config } from "@/lib/config";
import { formatDate, formatRupiah } from "@/lib/utils";

export function payLink(token: string) {
  return `${config.siteUrl}/bayar/${token}`;
}

export function reminderMessage(opts: { name: string; amount: number; oldestDue: string | null; token: string }) {
  const firstName = opts.name.split(" ")[0];
  const due = opts.oldestDue ? ` (jatuh tempo ${formatDate(opts.oldestDue)})` : "";
  return [
    `Halo Kak ${firstName}, ini pengingat dari ${config.kosName}.`,
    `Tagihan kakak saat ini ${formatRupiah(opts.amount)}${due}.`,
    `Rincian dan upload bukti bayar di sini: ${payLink(opts.token)}`,
    `Terima kasih ya Kak 🙏`,
  ].join("\n");
}

export function payLinkMessage(opts: { name: string; token: string }) {
  const firstName = opts.name.split(" ")[0];
  return [
    `Halo Kak ${firstName}, ini link tagihan kos kakak di ${config.kosName}:`,
    payLink(opts.token),
    `Di situ ada rincian sewa dan galon, dan kakak bisa upload bukti transfer langsung. Terima kasih 🙏`,
  ].join("\n");
}
