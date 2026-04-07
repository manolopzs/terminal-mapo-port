/**
 * GET /api/briefing
 * Morning market briefing: macro-sentinel + portfolio status + drawdown + earnings + AGI pulse
 */
import type { Request, Response } from "express";
import { getHoldings } from "../../lib/portfolio/state.js";
import { getFMPQuote, getEarnings } from "../../../server/lib/fmp.js";
import { callClaude } from "../../lib/claude/client.js";
import { MORNING_BRIEFING_PROMPT } from "../../lib/claude/prompts/morning.js";
import { checkDrawdown } from "../../lib/agents/risk/drawdown-monitor.js";
import { runMacroSentinel } from "../../lib/agents/intelligence/macro-sentinel.js";
import { runSituationalAwareness } from "../../lib/agents/agi-engine/situational-awareness.js";

export async function briefingRoute(req: Request, res: Response): Promise<void> {
  try {
    let holdings: Awaited<ReturnType<typeof getHoldings>> = [];
    try {
      holdings = await getHoldings();
    } catch {
      holdings = [];
    }
    const tickers = holdings.map(h => h.ticker);

    // Fetch macro context + portfolio data in parallel
    const [macroResult, agiResult, quotesRaw] = await Promise.allSettled([
      runMacroSentinel(),
      runSituationalAwareness(),
      tickers.length > 0 ? getFMPQuote(tickers.join(",")) : Promise.resolve([]),
    ]);

    const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
    const agi = agiResult.status === "fulfilled" ? agiResult.value : null;
    const quotes: any[] = quotesRaw.status === "fulfilled" && Array.isArray(quotesRaw.value)
      ? quotesRaw.value : [];

    const today = new Date().toISOString().split("T")[0];

    // Fetch earnings in parallel (best effort)
    const earningsMap: Record<string, any> = {};
    if (tickers.length > 0) {
      const earningsResults = await Promise.allSettled(tickers.map(t => getEarnings(t)));
      tickers.forEach((t, i) => {
        const r = earningsResults[i];
        if (r.status === "fulfilled" && r.value) earningsMap[t] = r.value;
      });
    }

    // Build holdings status with drawdown checks
    const holdingsStatus = holdings.map(h => {
      const q = quotes.find((q: any) => q.symbol === h.ticker);
      const currentPrice = q?.price ?? h.entryPrice;
      const drawdown = checkDrawdown(h.entryPrice, currentPrice, h.ticker);

      // Next upcoming earnings
      const earningsData = earningsMap[h.ticker];
      const nextEarnings = Array.isArray(earningsData)
        ? earningsData.find((e: any) => e.date > today && e.epsActual == null)
        : null;

      const daysUntilEarnings = nextEarnings
        ? Math.ceil((new Date(nextEarnings.date).getTime() - Date.now()) / 86_400_000)
        : null;

      return {
        ticker: h.ticker,
        company: h.companyName,
        currentPrice,
        changePct: q?.changesPercentage ?? 0,
        returnPct: h.entryPrice > 0 ? ((currentPrice - h.entryPrice) / h.entryPrice) * 100 : 0,
        drawdownAlert: drawdown ? { level: drawdown.level, action: drawdown.action } : null,
        nextEarnings: nextEarnings ? { date: nextEarnings.date, daysUntil: daysUntilEarnings, epsEst: nextEarnings.epsEstimated } : null,
        earningsBlackout: daysUntilEarnings !== null && daysUntilEarnings <= 3,
      };
    });

    // Compile context for Claude
    const briefingData = {
      date: today,
      macroRegime: macro?.regime ?? "UNKNOWN",
      macroKeyEvents: macro?.keyEvents ?? [],
      sectorRanking: macro?.sectorRanking?.slice(0, 5) ?? [],
      agiThesisStatus: agi?.status ?? "UNKNOWN",
      agiKeyDevelopments: agi?.keyDevelopments ?? [],
      agiImplications: agi?.implicationsForPortfolio ?? "",
      holdingsStatus,
      drawdownAlerts: holdingsStatus.filter(h => h.drawdownAlert).map(h => h.drawdownAlert),
      earningsBlackouts: holdingsStatus.filter(h => h.earningsBlackout).map(h => ({
        ticker: h.ticker,
        date: h.nextEarnings?.date,
        daysUntil: h.nextEarnings?.daysUntil,
      })),
    };

    const briefing = await callClaude({
      system: MORNING_BRIEFING_PROMPT,
      prompt: JSON.stringify(briefingData, null, 2),
    });

    res.json({
      briefing,
      macro,
      agi,
      data: briefingData,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[/api/briefing]", err);
    res.status(500).json({ error: err.message });
  }
}
