/** Banner hasil aksi, dibaca dari ?ok= atau ?error= di URL. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-4 rounded-xl border-2 px-4 py-3 text-sm font-semibold ${
        error ? "border-bata bg-bata-soft text-bata" : "border-pandan/30 bg-lumut text-pandan-dark"
      }`}
    >
      {error || ok}
    </div>
  );
}
