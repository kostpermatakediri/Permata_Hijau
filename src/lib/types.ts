export type Unit = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  photo_url: string | null;
  sort_order: number;
};

export type Room = {
  id: string;
  unit_id: string;
  name: string;
  monthly_price: number;
  facilities: string[];
  is_active: boolean;
};

export type Tenant = {
  id: string;
  full_name: string;
  phone: string;
  notes: string | null;
};

export type Lease = {
  id: string;
  room_id: string;
  tenant_id: string;
  token: string;
  start_date: string;
  duration_months: number;
  end_date: string;
  monthly_price: number;
  status: "active" | "ended";
};

export type Payment = {
  id: string;
  lease_id: string;
  amount: number;
  paid_date: string;
  proof_path: string | null;
  status: "pending" | "approved" | "rejected";
  source: "tenant" | "admin";
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};
