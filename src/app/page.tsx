import type { Metadata } from "next";
import Link from "next/link";
import { Gallery } from "@/components/Gallery";
import { config } from "@/lib/config";
import { bookingSteps, payNote } from "@/lib/content";
import { getPublicListing, type PublicUnit } from "@/lib/public-data";
import { formatRupiah, waLink } from "@/lib/utils";

// Dibangun ulang tiap 60 detik: kamar yang baru terisi/kosong ikut berubah tanpa deploy.
export const revalidate = 60;

function describe(units: PublicUnit[]) {
  const rooms = units.flatMap((u) => u.rooms);
  const free = rooms.filter((r) => r.available);
  const minFree = free.length ? Math.min(...free.map((r) => r.monthly_price)) : null;
  return { rooms, free, minFree };
}

export async function generateMetadata(): Promise<Metadata> {
  const units = await getPublicListing();
  const { free, minFree } = describe(units);
  const cover = units.find((u) => u.photos.length > 0)?.photos[0];
  const description =
    free.length > 0 && minFree
      ? `${free.length} kamar kosong, mulai ${formatRupiah(minFree)} per bulan. Lihat foto kamar dan tanya langsung lewat WhatsApp.`
      : `Info kamar, harga, dan foto di ${config.kosName}. Tanya ketersediaan lewat WhatsApp.`;
  return {
    description,
    openGraph: { title: `${config.kosName} | Kos putri`, description, type: "website", images: cover ? [cover] : undefined },
  };
}

function askAbout(unit: PublicUnit, roomName?: string) {
  return roomName
    ? `Halo Kak, saya mau tanya kamar ${roomName} di ${unit.name} ${config.kosName}. Masih kosong?`
    : `Halo Kak, saya mau tanya kamar kosong di ${unit.name} ${config.kosName}.`;
}

export default async function HomePage() {
  const units = await getPublicListing();
  const { rooms: allRooms, free, minFree } = describe(units);
  const hasWa = config.waNumber.length > 0;
  const generalMsg = `Halo Kak, saya mau tanya kamar kosong di ${config.kosName}.`;
  const waGeneral = hasWa ? waLink(config.waNumber, generalMsg) : "";

  const facilities = Array.from(new Map(allRooms.flatMap((r) => r.facilities).map((f) => [f.toLowerCase(), f])).values());
  const unitOfRoom = new Map(units.flatMap((u) => u.rooms.map((r) => [r.id, u] as const)));

  const summary =
    allRooms.length === 0
      ? "Daftar kamar sedang diperbarui. Hubungi kami lewat WhatsApp untuk info terbaru."
      : free.length > 0 && minFree
        ? `${free.length} dari ${allRooms.length} kamar kosong saat ini, mulai ${formatRupiah(minFree)} per bulan.`
        : "Semua kamar sedang terisi. Kirim pesan untuk tanya kamar yang akan kosong.";

  return (
    <div className="pb-24 lg:pb-0">
      {/* Hero */}
      <section className="bg-pandan text-white">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-5 sm:pb-16">
          <header className="flex items-center justify-between gap-3">
            <span className="font-display text-lg font-bold">{config.kosName}</span>
            {hasWa && (
              <a href={waGeneral} className="btn btn-wa btn-sm hidden sm:inline-flex" target="_blank" rel="noopener">
                Tanya via WhatsApp
              </a>
            )}
          </header>

          <div className="mt-10 grid gap-10 lg:mt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
            <div>
              <h1 className="text-[2.6rem] font-bold leading-[1.04] sm:text-6xl">Cari kamar kos putri yang masih kosong</h1>
              <p className="mt-5 max-w-[44ch] text-lg text-white/85">{summary}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {free.length > 0 ? (
                  <a href="#kamar-kosong" className="btn btn-wa">
                    Lihat kamar kosong
                  </a>
                ) : (
                  hasWa && (
                    <a href={waGeneral} className="btn btn-wa" target="_blank" rel="noopener">
                      Tanya via WhatsApp
                    </a>
                  )
                )}
                {hasWa && free.length > 0 && (
                  <a href={waGeneral} className="btn btn-light" target="_blank" rel="noopener">
                    Tanya via WhatsApp
                  </a>
                )}
              </div>
            </div>

            {units.length > 0 && (
              <div className="rounded-3xl bg-white p-5 text-ink sm:p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-bold">Papan kamar</h2>
                  <p className="text-sm text-abu">
                    {free.length} kosong dari {allRooms.length}
                  </p>
                </div>
                <div className="mt-4 space-y-5">
                  {units.map((unit) => (
                    <div key={unit.id}>
                      <p className="mb-2 text-sm font-semibold">{unit.name}</p>
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
                <p className="mt-5 border-t border-batu pt-4 text-sm text-abu">
                  {free.length > 0 && hasWa
                    ? "Ketuk kamar hijau untuk tanya lewat WhatsApp. Kotak putus-putus berarti sudah terisi."
                    : "Kotak putus-putus berarti kamar sudah terisi."}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4">
        {/* Kamar kosong */}
        {allRooms.length > 0 && (
          <section id="kamar-kosong" className="scroll-mt-4 py-12">
            <h2 className="text-3xl font-bold">{free.length > 0 ? "Kamar yang kosong sekarang" : "Semua kamar sedang terisi"}</h2>
            {free.length > 0 ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {free.map((room) => {
                  const unit = unitOfRoom.get(room.id)!;
                  return (
                    <li key={room.id} className="card flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="plate plate-free">
                          {room.name}
                          <small>Kosong</small>
                        </span>
                        <p className="text-right">
                          <span className="block font-display text-2xl font-bold">{formatRupiah(room.monthly_price)}</span>
                          <span className="text-sm text-abu">per bulan</span>
                        </p>
                      </div>
                      <p className="mt-3 text-sm text-abu">{unit.name}</p>
                      {room.facilities.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {room.facilities.map((f) => (
                            <li key={f} className="badge badge-ok">
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                      {hasWa && (
                        <a
                          href={waLink(config.waNumber, askAbout(unit, room.name))}
                          target="_blank"
                          rel="noopener"
                          className="btn btn-wa mt-5 w-full"
                        >
                          Tanya kamar ini
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 max-w-[52ch] text-abu">
                Kamar bisa kosong lagi kapan saja. Kirim pesan lewat WhatsApp untuk tanya kamar yang akan segera kosong.
              </p>
            )}
          </section>
        )}

        {/* Unit */}
        {units.map((unit, idx) => {
          const minPrice = Math.min(...unit.rooms.map((r) => r.monthly_price));
          const hasPhotos = unit.photos.length > 0;
          return (
            <section key={unit.id} id={`unit-${unit.id}`} className="scroll-mt-4 border-t border-batu py-12">
              <div className={hasPhotos ? "grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12" : "max-w-2xl"}>
                {hasPhotos && (
                  <div className="min-w-0">
                    <Gallery photos={unit.photos} label={unit.name} priority={idx === 0} />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-3xl font-bold">{unit.name}</h2>
                  {unit.address && (
                    <p className="mt-2 text-abu">
                      {unit.address}.{" "}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(unit.address)}`}
                        target="_blank"
                        rel="noopener"
                        className="font-semibold text-ink underline underline-offset-4"
                      >
                        Lihat di peta
                      </a>
                    </p>
                  )}
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
                          {room.facilities.length > 0 && <p className="truncate text-sm text-abu">{room.facilities.join(", ")}</p>}
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
                </div>
              </div>
            </section>
          );
        })}

        {/* Fasilitas */}
        {facilities.length > 0 && (
          <section className="border-t border-batu py-12">
            <h2 className="text-3xl font-bold">Fasilitas kamar</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {facilities.map((f) => (
                <li key={f} className="rounded-full bg-lumut px-4 py-2 font-semibold text-pandan-dark">
                  {f}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cara pesan */}
        <section className="border-t border-batu py-12">
          <h2 className="text-3xl font-bold">Cara pesan kamar</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {bookingSteps.map((step, i) => (
              <li key={step.title} className="flex gap-4 md:block">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-bold text-white">
                  {i + 1}
                </span>
                <div className="md:mt-4">
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 max-w-[40ch] text-abu">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 rounded-3xl bg-ink p-6 text-white sm:p-8">
            <h2 className="text-2xl font-bold">{payNote.title}</h2>
            <p className="mt-2 max-w-[58ch] text-white/80">{payNote.body}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-batu">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-abu sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">{config.kosName}</p>
            {hasWa ? (
              <p className="mt-1">
                WhatsApp:{" "}
                <a href={waGeneral} target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-4">
                  +{config.waNumber}
                </a>
              </p>
            ) : (
              <p className="mt-1">Info ketersediaan diperbarui otomatis.</p>
            )}
          </div>
          <Link href="/login" className="underline underline-offset-4">
            Masuk pengelola
          </Link>
        </div>
      </footer>

      {hasWa && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-batu bg-kapur/95 p-3 backdrop-blur lg:hidden">
          <a href={waGeneral} target="_blank" rel="noopener" className="btn btn-wa w-full">
            Tanya via WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
