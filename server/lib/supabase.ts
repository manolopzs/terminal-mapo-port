import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const isSupabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

if (!isSupabaseEnabled) {
  console.warn("[supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set. Supabase disabled.");
}

export const supabase: SupabaseClient = isSupabaseEnabled
  ? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
  : (null as unknown as SupabaseClient);
