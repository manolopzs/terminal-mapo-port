import { isExcluded } from "../../constants/exclusion-list.js";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface ExclusionResult {
  passed: boolean;
  reason?: string;
}

export async function checkExclusion(ticker: string): Promise<ExclusionResult> {
  const upper = ticker.toUpperCase();

  // Check explicit exclusion list
  const exclusion = isExcluded(upper);
  if (exclusion.excluded) {
    return { passed: false, reason: `Exclusion List: ${exclusion.reason}` };
  }

  // Check cooldown list (tickers that hit 25% drawdown forced exit)
  try {
    const supabase = getSupabase();
    const { data: cooldown } = await supabase
      .from("cooldown_list")
      .select("*")
      .eq("ticker", upper)
      .gte("cooldown_until", new Date().toISOString().split("T")[0])
      .maybeSingle();

    if (cooldown) {
      return {
        passed: false,
        reason: `90-day cooldown until ${cooldown.cooldown_until} (forced exit on ${cooldown.exit_date})`,
      };
    }
  } catch {
    // Supabase unavailable: skip cooldown check, don't block
  }

  return { passed: true };
}

export async function addToCooldown(ticker: string, exitReason: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const exitDate = new Date().toISOString().split("T")[0];
    const cooldownUntil = new Date(Date.now() + 90 * 86_400_000).toISOString().split("T")[0];
    await supabase.from("cooldown_list").upsert({
      ticker: ticker.toUpperCase(),
      exit_date: exitDate,
      cooldown_until: cooldownUntil,
      exit_reason: exitReason,
    });
  } catch (e) {
    console.error("[exclusion-guard] Failed to add cooldown:", e);
  }
}
