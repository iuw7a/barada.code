import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the SECRET key.
 * Never import this from client components — the secret key must stay server-side.
 * Uses the publishable key client instead when unauthenticated access is enough.
 */
export function getSupabaseServer(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY missing)");
  }
  cached ??= createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Public (publishable-key) client — safe for anon-level operations. */
export function getSupabasePublic(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !pub) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing)");
  }
  return createClient(url, pub, { auth: { persistSession: false } });
}
