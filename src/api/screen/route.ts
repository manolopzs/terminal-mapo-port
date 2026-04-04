/**
 * POST /api/screen/v2
 * Full MAPO screen: AGI engine + broad engine + geopolitical overlay + catalyst filter + scoring
 */
import type { Request, Response } from "express";
import { runComputeScout } from "../../lib/agents/agi-engine/compute-scout.js";
import { runPowerAnalyst } from "../../lib/agents/agi-engine/power-analyst.js";
import { runSemiSpecialist } from "../../lib/agents/agi-engine/semi-specialist.js";
import { runDefenseAnalyst } from "../../lib/agents/agi-engine/defense-analyst.js";
import { applyGeopoliticalOverlay } from "../../lib/agents/agi-engine/geopolitical-risk.js";
import { runSectorRotation } from "../../lib/agents/broad-engine/sector-rotation.js";
import { runValueDiscovery } from "../../lib/agents/broad-engine/value-discovery.js";
import { runGrowthScout } from "../../lib/agents/broad-engine/growth-scout.js";
import { runCatalystHunter } from "../../lib/agents/broad-engine/catalyst-hunter.js";
import { checkExclusion } from "../../lib/agents/risk/exclusion-guard.js";
import { analyzeStock } from "../../lib/agents/scoring/composite-scorer.js";
import type { CandidateTicker } from "../../lib/fmp/types.js";

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

export async function screenRoute(req: Request, res: Response): Promise<void> {
  try {
    const { tickers: requestTickers } = req.body ?? {};

    // Fast path: if caller sends specific tickers, score them directly
    if (Array.isArray(requestTickers) && requestTickers.length > 0) {
      const upperTickers = requestTickers.map((t: string) => t.toUpperCase()).slice(0, 30);
      console.log(`[/api/screen/v2] Fast path: scoring ${upperTickers.length} provided tickers`);

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

      const fastResults = toScore.map(ticker => {
        const analysis = scores.get(ticker);
        return {
          ticker,
          name: analysis?.profile?.companyName ?? ticker,
          sector: analysis?.profile?.sector ?? null,
          industry: analysis?.profile?.industry ?? null,
          marketCap: analysis?.profile?.marketCap ?? null,
          marketCapB: analysis?.profile?.marketCap ? `$${(analysis.profile.marketCap / 1e9).toFixed(1)}B` : "?",
          agiAlignmentScore: 0,
          screenType: "direct",
          screeningNotes: analysis?.quantSignals?.signalSummary ?? null,
          signalCount: 1,
          price: analysis?.profile?.price ?? null,
          changePct: 0,
          score: analysis?.scoring?.compositeScore ?? null,
          rating: analysis?.scoring?.rating ?? null,
          rejected: analysis?.rejected ?? false,
          rejectReason: analysis?.rejectReason ?? null,
          quantSignals: analysis?.quantSignals ?? null,
        };
      })
        .filter(r => !r.rejected)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      console.log(`[/api/screen/v2] Fast path done. ${fastResults.length} results.`);
      return res.json(fastResults);
    }

    console.log("[/api/screen/v2] Starting full MAPO screen...");

    // AGI engine + broad engine in parallel
    const [
      agiComputeResult, agiPowerResult, agiSemiResult, agiDefenseResult,
      broadSectorResult, broadValueResult, broadGrowthResult,
    ] = await Promise.allSettled([
      runComputeScout(),
      runPowerAnalyst(),
      runSemiSpecialist(),
      runDefenseAnalyst(),
      runSectorRotation().then(r => r.topSectorCandidates),
      runValueDiscovery(),
      runGrowthScout(),
    ]);

    const val = <T>(r: PromiseSettledResult<T>): T | null =>
      r.status === "fulfilled" ? r.value : null;

    const agiCandidates: CandidateTicker[] = [
      ...(val(agiComputeResult) ?? []),
      ...(val(agiPowerResult) ?? []),
      ...(val(agiSemiResult) ?? []),
      ...(val(agiDefenseResult) ?? []),
    ];

    const broadCandidates: CandidateTicker[] = [
      ...(val(broadSectorResult) ?? []),
      ...(val(broadValueResult) ?? []),
      ...(val(broadGrowthResult) ?? []),
    ];

    console.log(`[/api/screen/v2] AGI: ${agiCandidates.length}, Broad: ${broadCandidates.length}`);

    // Apply overlays in parallel
    const [overlaidAgi, filteredBroad] = await Promise.all([
      applyGeopoliticalOverlay(agiCandidates),
      runCatalystHunter(broadCandidates),
    ]);

    // Merge + deduplicate — track how many engines found each ticker
    const tickerCount = new Map<string, number>();
    const tickerMeta = new Map<string, CandidateTicker>();

    for (const c of [...overlaidAgi, ...filteredBroad]) {
      const t = c.ticker.toUpperCase();
      tickerCount.set(t, (tickerCount.get(t) ?? 0) + 1);
      if (!tickerMeta.has(t)) tickerMeta.set(t, c);
      else {
        // Merge: keep higher AGI score, accumulate notes
        const existing = tickerMeta.get(t)!;
        tickerMeta.set(t, {
          ...existing,
          agiAlignmentScore: Math.max(existing.agiAlignmentScore, c.agiAlignmentScore),
          screeningNotes: [existing.screeningNotes, c.screeningNotes].filter(Boolean).join(" + "),
          screenType: [existing.screenType, c.screenType].filter(Boolean).join("+"),
        });
      }
    }

    // Exclusion filter
    const exclusionResults = await Promise.allSettled(
      Array.from(tickerMeta.keys()).map(async t => ({ t, ok: (await checkExclusion(t)).passed }))
    );
    const allowed = new Set(
      exclusionResults
        .filter(r => r.status === "fulfilled" && r.value.ok)
        .map(r => (r as PromiseFulfilledResult<any>).value.t)
    );

    // Sort by signal count (multi-engine hits first), take top 30
    const top30 = Array.from(tickerMeta.entries())
      .filter(([t]) => allowed.has(t))
      .sort(([a], [b]) => (tickerCount.get(b) ?? 0) - (tickerCount.get(a) ?? 0))
      .slice(0, 30)
      .map(([, meta]) => meta);

    console.log(`[/api/screen/v2] Scoring ${top30.length} candidates...`);

    // Batch score top 30 in groups of 5
    const scores = await batchScore(top30.map(c => c.ticker));

    // Compose final results
    const finalResults = top30.map(candidate => {
      const analysis = scores.get(candidate.ticker);
      const signalCount = tickerCount.get(candidate.ticker) ?? 1;
      return {
        ticker: candidate.ticker,
        name: candidate.companyName,
        sector: candidate.sector,
        industry: candidate.industry,
        marketCap: candidate.marketCap,
        marketCapB: candidate.marketCap ? `$${(candidate.marketCap / 1e9).toFixed(1)}B` : "?",
        agiAlignmentScore: candidate.agiAlignmentScore,
        screenType: candidate.screenType,
        screeningNotes: candidate.screeningNotes,
        signalCount,
        price: analysis?.profile?.price ?? null,
        changePct: 0,
        score: analysis?.scoring?.compositeScore ?? null,
        rating: analysis?.scoring?.rating ?? null,
        rejected: analysis?.rejected ?? false,
        rejectReason: analysis?.rejectReason ?? null,
        quantSignals: analysis?.quantSignals ?? null,
      };
    }).filter(r => !r.rejected)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    console.log(`[/api/screen/v2] Done. ${finalResults.length} scored candidates.`);
    res.json(finalResults);
  } catch (err: any) {
    console.error("[/api/screen/v2]", err);
    res.status(500).json({ error: err.message });
  }
}
