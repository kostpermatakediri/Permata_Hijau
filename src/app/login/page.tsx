import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { config } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { login } from "./actions";

export const metadata: Metadata = { title: "Masuk pengelola", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  // Kalau sudah login sebagai admin, langsung ke dashboard.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (admin) redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold">Masuk pengelola</h1>
      <p className="mt-2 text-abu">{config.kosName}</p>

      <form action={login} className="mt-8 space-y-4">
        <Flash error={error} />
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" inputMode="email" className="input" />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        <SubmitButton pendingText="Masuk…" className="btn btn-primary w-full">
          Masuk
        </SubmitButton>
      </form>
    </main>
  );
}
