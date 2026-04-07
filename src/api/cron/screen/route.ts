/**
 * Cron: GET /api/cron/screen
 * Schedule: 30 21 * * 1-5 (4:30 PM ET, after market close)
 * Pre-scores discovery results and caches them in Supabase.
 */
import type { Request, Response } from "express";
import { runDiscovery } from "../../../lib/agents/discovery.js";
import { analyzeStock } from "../../../lib/agents/scoring/composite-scorer.js";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  return auth === `Bearer ${secret}` || auth === secret;
}

async function batchScore(tickers: string[], batchSize = 5): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(t => analyzeStock(t)));
    settled.forEach((r, idx) => {
      if (r.status === "fulfilled") results.set(batch[idx], r.value);
    });
    if (i + batchSize < tickers.length) await new Promise(r => setTimeout(r, 3_000));
  }
  return results;
}

export async function cronScreenRoute(req: Request, res: Response): Promise<void> {
  if (!verifyCron(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (!isSupabaseEnabled) {
    console.log("[cron/screen] Supabase not configured, skipping.");
    res.json({ ok: true, skipped: true, reason: "supabase_disabled" });
    return;
  }

  try {
    console.log("[cron/screen] Starting discovery...");
    const { candidates } = await runDiscovery();
    const tickers = candidates.map(c => c.ticker).slice(0, 30);
    console.log(`[cron/screen] Discovery returned ${tickers.length} candidates, scoring...`);

    const scores = await batchScore(tickers);
    const now = new Date().toISOString();
    let upserted = 0;

    for (const ticker of Array.from(scores.keys())) {
      const analysis = scores.get(ticker);
      const candidate = candidates.find(c => c.ticker === ticker);
      const row = {
        ticker,
        score: analysis?.scoring?.compositeScore ?? null,
        rating: analysis?.scoring?.rating ?? null,
        factors: analysis?.scoring?.factors ?? null,
        sector: analysis?.profile?.sector ?? null,
        industry: analysis?.profile?.industry ?? null,
        market_cap: analysis?.profile?.marketCap ?? null,
        screening_notes: candidate?.screeningNotes ?? (analysis?.quantSignals?.signalSummary ?? null),
        updated_at: now,
      };

      const { error } = await supabase
        .from("screener_cache" as any)
        .upsert(row as any, { onConflict: "ticker" });

      if (error) {
        console.error(`[cron/screen] Upsert failed for ${ticker}:`, error.message);
      } else {
        upserted++;
      }
    }

    console.log(`[cron/screen] Done: ${upserted}/${scores.size} cached.`);
    res.json({ ok: true, discovered: tickers.length, scored: scores.size, cached: upserted });
  } catch (err: any) {
    console.error("[cron/screen]", err);
    res.status(500).json({ error: err.message });
  }
}
