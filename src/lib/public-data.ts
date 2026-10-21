import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicRoom = {
  id: string;
  name: string;
  monthly_price: number;
  facilities: string[];
  available: boolean;
};

export type PublicUnit = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  photos: string[];
  rooms: PublicRoom[];
};

type UnitRow = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  photo_url: string | null;
  photos?: string[] | null;
};

/**
 * Data untuk landing page. Memakai service role di server dan hanya
 * mengembalikan kolom yang aman ditampilkan (tanpa data penyewa).
 * Di-cache per request supaya halaman dan generateMetadata tidak query dua kali.
 */
export const getPublicListing = cache(async (): Promise<PublicUnit[]> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const db = createAdminClient();

    // Coba dengan kolom galeri; kalau migrasi foto belum dijalankan, ulangi tanpa kolom itu.
    const unitsQuery = async (): Promise<UnitRow[]> => {
      const withPhotos = await db
        .from("units")
        .select("id,name,address,description,photo_url,photos")
        .order("sort_order")
        .order("name");
      if (!withPhotos.error) return (withPhotos.data ?? []) as UnitRow[];
      const legacy = await db
        .from("units")
        .select("id,name,address,description,photo_url")
        .order("sort_order")
        .order("name");
      return (legacy.data ?? []) as UnitRow[];
    };

    const [units, rooms, leases] = await Promise.all([
      unitsQuery(),
      db.from("rooms").select("id,unit_id,name,monthly_price,facilities").eq("is_active", true).order("name"),
      db.from("leases").select("room_id").eq("status", "active"),
    ]);

    if (rooms.error || leases.error) return [];

    const occupied = new Set((leases.data ?? []).map((l) => l.room_id));

    return units
      .map((u) => {
        const photos = u.photos && u.photos.length > 0 ? u.photos : u.photo_url ? [u.photo_url] : [];
        return {
          id: u.id,
          name: u.name,
          address: u.address,
          description: u.description,
          photos,
          rooms: (rooms.data ?? [])
            .filter((r) => r.unit_id === u.id)
            .map((r) => ({
              id: r.id,
              name: r.name,
              monthly_price: r.monthly_price,
              facilities: r.facilities ?? [],
              available: !occupied.has(r.id),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true })),
        };
      })
      .filter((u) => u.rooms.length > 0);
  } catch {
    return [];
  }
});
