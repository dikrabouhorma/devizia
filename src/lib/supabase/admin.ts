import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Salon } from "../domain";
import { DEMO_SALON, isDemoMode } from "../demo";

let admin: SupabaseClient | null = null;

/** Client serveur avec la clé service : contourne la RLS, ne jamais l'exposer au navigateur. */
export function getAdminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  }
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export async function getSalonBySlug(slug: string): Promise<Salon | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  if (isDemoMode()) return slug === DEMO_SALON.slug ? DEMO_SALON : null;
  const { data, error } = await getAdminClient().from("salons").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Salon | null) ?? null;
}
