/** Tampil seketika saat pindah menu, selagi data halaman berikutnya diambil. */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="animate-pulse">
      <div className="h-9 w-2/5 rounded-lg bg-batu/70" />
      <div className="mt-3 h-4 w-3/5 rounded bg-batu/50" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-batu/50" />
        <div className="h-24 rounded-2xl bg-batu/50" />
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-16 rounded-xl bg-batu/40" />
        <div className="h-16 rounded-xl bg-batu/40" />
        <div className="h-16 rounded-xl bg-batu/40" />
      </div>
    </div>
  );
}
