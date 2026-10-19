import Link from "next/link";
import { config } from "@/lib/config";
import { getPublicListing, type PublicUnit } from "@/lib/public-data";
import { formatRupiah, waLink } from "@/lib/utils";

// Dibangun ulang tiap 60 detik: kamar yang baru terisi/kosong ikut berubah tanpa deploy.
export const revalidate = 60;

function askAbout(unit: PublicUnit, roomName?: string) {
  return roomName
    ? `Halo Kak, saya mau tanya kamar ${roomName} di ${unit.name} ${config.kosName}. Masih kosong?`
    : `Halo Kak, saya mau tanya kamar kosong di ${unit.name} ${config.kosName}.`;
}

export default async function HomePage() {
  const units = await getPublicListing();
  const allRooms = units.flatMap((u) => u.rooms);
  const freeCount = allRooms.filter((r) => r.available).length;
  const hasWa = config.waNumber.length > 0;
  const generalMsg = `Halo Kak, saya mau tanya kamar kosong di ${config.kosName}.`;

  return (
    <div className="pb-24 lg:pb-0">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-5">
        <span className="font-display text-lg font-bold">{config.kosName}</span>
        {hasWa && (
          <a href={waLink(config.waNumber, generalMsg)} className="btn btn-wa btn-sm" target="_blank" rel="noopener">
            Tanya via WhatsApp
          </a>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <section className="pt-10 pb-8">
          <h1 className="max-w-[18ch] text-[2.25rem] font-bold sm:text-5xl">Cari kamar kos putri yang masih kosong</h1>
          <p className="mt-4 max-w-[46ch] text-lg text-abu">
            {allRooms.length > 0
              ? `${freeCount} dari ${allRooms.length} kamar kosong saat ini. Ketuk plat hijau untuk tanya kamarnya lewat WhatsApp.`
              : "Daftar kamar sedang diperbarui. Hubungi kami lewat WhatsApp untuk info terbaru."}
          </p>

          {units.length > 0 && (
            <div className="mt-8 space-y-5">
              {units.map((unit) => (
                <div key={unit.id}>
                  <a href={`#unit-${unit.id}`} className="mb-2 inline-block text-sm font-semibold underline-offset-4 hover:underline">
                    {unit.name}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    {unit.rooms.map((room) =>
                      room.available && hasWa ? (
                        <a
                          key={room.id}
                          href={waLink(config.waNumber, askAbout(unit, room.name))}
                          target="_blank"
                          rel="noopener"
                          className="plate plate-free"
                          aria-label={`Tanya kamar ${room.name}, kosong`}
                        >
                          {room.name}
                          <small>Kosong</small>
                        </a>
                      ) : (
                        <span key={room.id} className={`plate ${room.available ? "plate-free" : "plate-taken"}`}>
                          {room.name}
                          <small>{room.available ? "Kosong" : "Terisi"}</small>
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {units.map((unit) => {
          const minPrice = Math.min(...unit.rooms.map((r) => r.monthly_price));
          return (
            <section key={unit.id} id={`unit-${unit.id}`} className="scroll-mt-4 border-t border-batu py-8">
              {unit.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={unit.photo_url}
                  alt={`Foto ${unit.name}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-2xl object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-lumut font-display text-6xl font-bold text-pandan/40"
                >
                  {unit.name.slice(0, 1)}
                </div>
              )}

              <h2 className="mt-5 text-2xl font-bold">{unit.name}</h2>
              {unit.address && <p className="mt-1 text-abu">{unit.address}</p>}
              {unit.description && <p className="mt-3 max-w-[60ch]">{unit.description}</p>}
              <p className="mt-3 font-semibold">
                Mulai {formatRupiah(minPrice)} <span className="font-normal text-abu">per bulan</span>
              </p>

              <ul className="mt-5 divide-y divide-batu border-y border-batu">
                {unit.rooms.map((room) => (
                  <li key={room.id} className="flex items-center gap-3 py-3">
                    <span className={`plate ${room.available ? "plate-free" : "plate-taken"}`}>
                      {room.name}
                      <small>{room.available ? "Kosong" : "Terisi"}</small>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{formatRupiah(room.monthly_price)}</p>
                      {room.facilities.length > 0 && (
                        <p className="truncate text-sm text-abu">{room.facilities.join(", ")}</p>
                      )}
                    </div>
                    {room.available && hasWa && (
                      <a
                        href={waLink(config.waNumber, askAbout(unit, room.name))}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-ghost btn-sm"
                      >
                        Tanya
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {units.length === 0 && (
          <section className="border-t border-batu py-10">
            <p className="text-abu">Belum ada kamar yang ditampilkan.</p>
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-3xl border-t border-batu px-4 py-8 text-sm text-abu">
        <p className="font-semibold text-ink">{config.kosName}</p>
        <p className="mt-1">Info harga dan ketersediaan diperbarui otomatis. Untuk survei kamar, hubungi lewat WhatsApp.</p>
        <p className="mt-4">
          <Link href="/login" className="underline underline-offset-4">
            Masuk pengelola
          </Link>
        </p>
      </footer>

      {hasWa && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-batu bg-kapur/95 p-3 backdrop-blur lg:hidden">
          <a href={waLink(config.waNumber, generalMsg)} target="_blank" rel="noopener" className="btn btn-wa w-full">
            Tanya via WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
