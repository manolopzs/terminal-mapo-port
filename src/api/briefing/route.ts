/**
 * GET /api/briefing
 * Morning market briefing via Claude
 */
import type { Request, Response } from "express";
import { getHoldings } from "../../lib/portfolio/state.js";
import { getFMPQuote, getEarnings } from "../../../server/lib/fmp.js";
import { callClaude } from "../../lib/claude/client.js";
import { MORNING_BRIEFING_PROMPT } from "../../lib/claude/prompts/morning.js";
import { checkDrawdown } from "../../lib/agents/risk/drawdown-monitor.js";

export async function briefingRoute(req: Request, res: Response): Promise<void> {
  try {
    const holdings = await getHoldings();
    const tickers = holdings.map(h => h.ticker);

    let quotes: any[] = [];
    const earningsData: Record<string, any> = {};

    if (tickers.length > 0) {
      const raw = await getFMPQuote(tickers.join(","));
      quotes = Array.isArray(raw) ? raw : [];

      // Get upcoming earnings for each holding (in parallel, best effort)
      const earningsResults = await Promise.allSettled(tickers.map(t => getEarnings(t)));
      tickers.forEach((t, i) => {
        const r = earningsResults[i];
        if (r.status === "fulfilled" && r.value) earningsData[t] = r.value;
      });
    }

    // Build context for Claude
    const today = new Date().toISOString().split("T")[0];

    const holdingsStatus = holdings.map(h => {
      const q = quotes.find((q: any) => q.symbol === h.ticker);
      const currentPrice = q?.price ?? h.entryPrice;
      const drawdown = checkDrawdown(h.entryPrice, currentPrice, h.ticker);

      // Find next earnings
      const earnings = earningsData[h.ticker];
      const nextEarnings = Array.isArray(earnings)
        ? earnings.find((e: any) => e.date > today)
        : null;

      return {
        ticker: h.ticker,
        company: h.companyName,
        entryPrice: h.entryPrice,
        currentPrice,
        changePct: q?.changesPercentage ?? 0,
        returnPct: h.entryPrice > 0 ? ((currentPrice - h.entryPrice) / h.entryPrice) * 100 : 0,
        drawdownAlert: drawdown ? { level: drawdown.level, action: drawdown.action } : null,
        nextEarnings: nextEarnings ? { date: nextEarnings.date, epsEst: nextEarnings.epsEstimated } : null,
      };
    });

    const briefingData = {
      date: today,
      holdingsStatus,
      positionCount: holdings.length,
    };

    const briefing = await callClaude({
      system: MORNING_BRIEFING_PROMPT,
      prompt: JSON.stringify(briefingData, null, 2),
    });

    res.json({ briefing, data: briefingData, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error("[/api/briefing]", err);
    res.status(500).json({ error: err.message });
  }
}
