/**
 * POST /api/screen/v2
 * Simplified MAPO screen: discovery → exclusion → scoring
 */
import type { Request, Response } from "express";
import { runDiscovery } from "../../lib/agents/discovery.js";
import { checkExclusion } from "../../lib/agents/risk/exclusion-guard.js";
import { analyzeStock } from "../../lib/agents/scoring/composite-scorer.js";
import { screenCachedRoute } from "./cached/route.js";

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

function buildResult(ticker: string, analysis: any, meta?: { screenType?: string; screeningNotes?: string; agiAlignmentScore?: number; signalCount?: number }) {
  return {
    ticker,
    name: analysis?.profile?.companyName ?? ticker,
    sector: analysis?.profile?.sector ?? null,
    industry: analysis?.profile?.industry ?? null,
    marketCap: analysis?.profile?.marketCap ?? null,
    marketCapB: analysis?.profile?.marketCap ? `$${(analysis.profile.marketCap / 1e9).toFixed(1)}B` : "?",
    agiAlignmentScore: meta?.agiAlignmentScore ?? 0,
    screenType: meta?.screenType ?? "direct",
    screeningNotes: meta?.screeningNotes ?? (analysis?.quantSignals?.signalSummary ?? null),
    signalCount: meta?.signalCount ?? 1,
    price: analysis?.profile?.price ?? null,
    changePct: 0,
    score: analysis?.scoring?.compositeScore ?? null,
    rating: analysis?.scoring?.rating ?? null,
    rejected: analysis?.rejected ?? false,
    rejectReason: analysis?.rejectReason ?? null,
    quantSignals: analysis?.quantSignals ?? null,
  };
}

export async function screenRoute(req: Request, res: Response): Promise<void> {
  try {
    const { tickers: requestTickers, cached } = req.body ?? {};

    if (cached) { await screenCachedRoute(req, res); return; }


    // ── Fast path: caller provides tickers, score them directly ──────────
    if (Array.isArray(requestTickers) && requestTickers.length > 0) {
      const upperTickers = requestTickers.map((t: string) => t.toUpperCase()).slice(0, 30);
      console.log(`[screen/v2] Fast path: scoring ${upperTickers.length} tickers`);

      const exclusionResults = await Promise.allSettled(
        upperTickers.map(async t => ({ t, ok: (await checkExclusion(t)).passed }))
      );
      const allowed = new Set(
        exclusionResults
          .filter(r => r.status === "fulfilled" && r.value.ok)
          .map(r => (r as PromiseFulfilledResult<any>).value.t)
      );
      const toScore = upperTickers.filter(t => allowed.has(t));
      const scores = await batchScore(toScore);

      const results = toScore
        .map(t => buildResult(t, scores.get(t)))
        .filter(r => !r.rejected)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      console.log(`[screen/v2] Fast path done: ${results.length} results`);
      return res.json(results);
    }

    // ── Full path: discovery → exclusion → score ─────────────────────────
    console.log("[screen/v2] Starting full discovery...");

    // Step 1: Discovery
    const { candidates, stats } = await runDiscovery();
    console.log(`[screen/v2] Discovery: ${stats.total} universe → ${stats.passed} candidates (${stats.excluded} excluded, ${stats.filtered} filtered)`);

    // Step 2: Exclusion + cooldown check
    const exclusionResults = await Promise.allSettled(
      candidates.map(async c => ({ t: c.ticker, ok: (await checkExclusion(c.ticker)).passed }))
    );
    const allowed = new Set(
      exclusionResults
        .filter(r => r.status === "fulfilled" && r.value.ok)
        .map(r => (r as PromiseFulfilledResult<any>).value.t)
    );
    const toScore = candidates.filter(c => allowed.has(c.ticker));
    console.log(`[screen/v2] After exclusion: ${toScore.length} candidates`);

    // Step 3: Score
    const scores = await batchScore(toScore.map(c => c.ticker));

    const results = toScore
      .map(c => buildResult(c.ticker, scores.get(c.ticker), {
        screenType: c.screenType,
        screeningNotes: c.screeningNotes,
        agiAlignmentScore: c.agiAlignmentScore,
        signalCount: 1,
      }))
      .filter(r => !r.rejected)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    console.log(`[screen/v2] Done: ${results.length} scored candidates`);
    res.json(results);
  } catch (err: any) {
    console.error("[screen/v2]", err);
    res.status(500).json({ error: err.message });
  }
}
