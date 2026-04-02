import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn("[supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set. Supabase disabled.");
}

export const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_ANON_KEY ?? "",
  {
    auth: { persistSession: false },
  }
);

export const isSupabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
