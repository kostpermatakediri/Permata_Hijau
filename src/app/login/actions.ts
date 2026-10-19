"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/utils";

export async function login(formData: FormData) {
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!email || !password) redirect("/login?error=" + encodeURIComponent("Isi email dan password."));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent("Email atau password salah."));

  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
