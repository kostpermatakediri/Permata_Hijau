"use client";

import { useState } from "react";
import { compressImage } from "@/lib/image-client";

/**
 * Input foto yang langsung memperkecil gambar begitu dipilih, lalu menggantinya di input
 * itu sendiri. Form dan server action tidak perlu diubah: tetap menerima field `photo`.
 */
export function PhotoInput({ name = "photo", required = false }: { name?: string; required?: boolean }) {
  const [note, setNote] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      setNote("");
      return;
    }
    setNote("Menyiapkan foto…");
    const small = await compressImage(file, 1280, 0.8);
    try {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
      setNote(`Siap diunggah (${Math.max(1, Math.round(small.size / 1024))} KB)`);
    } catch {
      setNote("");
    }
  }

  return (
    <div>
      <input
        name={name}
        type="file"
        accept="image/*"
        required={required}
        onChange={onChange}
        className="input file:mr-3 file:rounded-lg file:border-0 file:bg-lumut file:px-3 file:py-1.5 file:font-semibold file:text-pandan-dark"
      />
      {note && (
        <p className="mt-1 text-sm text-abu" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}
