import "server-only";
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
  photo_url: string | null;
  rooms: PublicRoom[];
};

/**
 * Data untuk landing page. Memakai service role di server dan hanya
 * mengembalikan kolom yang aman ditampilkan (tanpa data penyewa).
 */
export async function getPublicListing(): Promise<PublicUnit[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const db = createAdminClient();
    const [units, rooms, leases] = await Promise.all([
      db.from("units").select("id,name,address,description,photo_url").order("sort_order").order("name"),
      db.from("rooms").select("id,unit_id,name,monthly_price,facilities").eq("is_active", true).order("name"),
      db.from("leases").select("room_id").eq("status", "active"),
    ]);

    if (units.error || rooms.error || leases.error) return [];

    const occupied = new Set((leases.data ?? []).map((l) => l.room_id));

    return (units.data ?? [])
      .map((u) => ({
        ...u,
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
      }))
      .filter((u) => u.rooms.length > 0);
  } catch {
    return [];
  }
}
