/** Galeri foto yang bisa digeser. Foto pertama dimuat langsung, sisanya menunggu dilihat. */
export function Gallery({ photos, label, priority = false }: { photos: string[]; label: string; priority?: boolean }) {
  if (photos.length === 0) return null;

  return (
    <div>
      <div
        className="gallery -mx-4 px-4 sm:mx-0 sm:px-0"
        role="group"
        aria-roledescription="carousel"
        aria-label={`Foto ${label}`}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${label}, foto ${i + 1} dari ${photos.length}`}
            width={1280}
            height={960}
            loading={priority && i === 0 ? "eager" : "lazy"}
            fetchPriority={priority && i === 0 ? "high" : "auto"}
            decoding="async"
            className="aspect-[4/3] h-auto w-[86%] rounded-2xl bg-lumut object-cover sm:w-[70%] lg:w-[88%]"
          />
        ))}
      </div>
      {photos.length > 1 && <p className="mt-2 text-sm text-abu">{photos.length} foto, geser ke samping untuk melihat semuanya.</p>}
    </div>
  );
}
