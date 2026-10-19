"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Salin link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Salin teks ini:", text);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-ghost btn-sm" aria-live="polite">
      {copied ? "Tersalin" : label}
    </button>
  );
}
