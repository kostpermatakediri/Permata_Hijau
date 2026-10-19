"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { submitPayment, type PayState } from "./actions";

const MAX_SIDE = 1600;
const MAX_BYTES = 3 * 1024 * 1024;

/** Perkecil foto dari HP (sering 3-8 MB) jadi ~300 KB sebelum diunggah. */
async function compress(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    return blob ? new File([blob], "bukti.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function PaymentForm({ token, defaultAmount }: { token: string; defaultAmount: number }) {
  const [state, formAction, pending] = useActionState<PayState, FormData>(submitPayment, { status: "idle", message: "" });
  const [localError, setLocalError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [fileName, setFileName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const raw = fd.get("proof");
    if (!(raw instanceof File) || raw.size === 0) {
      setLocalError("Pilih foto bukti transfer dulu.");
      return;
    }

    setPreparing(true);
    const small = await compress(raw);
    setPreparing(false);
    if (small.size > MAX_BYTES) {
      setLocalError("Foto terlalu besar. Coba screenshot bukti transfernya saja.");
      return;
    }
    fd.set("proof", small);
    startTransition(() => formAction(fd));
  }

  if (state.status === "ok") {
    return (
      <div role="status" className="rounded-2xl border-2 border-pandan/30 bg-lumut p-5">
        <p className="font-display text-xl font-bold text-pandan-dark">Terkirim</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  const busy = pending || preparing;
  const error = localError || (state.status === "error" ? state.message : "");

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <label className="field">
        <span>Nominal yang ditransfer</span>
        <input
          name="amount"
          required
          inputMode="numeric"
          defaultValue={defaultAmount > 0 ? defaultAmount : undefined}
          placeholder="Contoh: 1500000"
          className="input"
        />
      </label>

      <label className="field">
        <span>Foto bukti transfer</span>
        <input
          name="proof"
          type="file"
          accept="image/*"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="input file:mr-3 file:rounded-lg file:border-0 file:bg-lumut file:px-3 file:py-1.5 file:font-semibold file:text-pandan-dark"
        />
        {fileName && <span className="mt-1 !mb-0 text-sm font-normal text-abu">{fileName}</span>}
      </label>

      {error && (
        <p role="alert" className="rounded-xl border-2 border-bata bg-bata-soft px-4 py-3 text-sm font-semibold text-bata">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {preparing ? "Menyiapkan foto…" : pending ? "Mengirim…" : "Kirim bukti bayar"}
      </button>
    </form>
  );
}
