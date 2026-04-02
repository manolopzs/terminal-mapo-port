/**
 * Cron: GET /api/cron/morning
 * Schedule: 30 13 * * 1-5 (7:30 AM CST, market days)
 * Triggers morning briefing and dispatches via webhook
 */
import type { Request, Response } from "express";
import { getHoldings } from "../../../lib/portfolio/state.js";
import { getFMPQuote, getEarnings } from "../../../../server/lib/fmp.js";
import { callClaude } from "../../../lib/claude/client.js";
import { MORNING_BRIEFING_PROMPT } from "../../../lib/claude/prompts/morning.js";
import { checkDrawdown } from "../../../lib/agents/risk/drawdown-monitor.js";

export async function cronMorningRoute(req: Request, res: Response): Promise<void> {
  // Verify cron secret
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const holdings = await getHoldings();
    const tickers = holdings.map(h => h.ticker);

    let quotes: any[] = [];
    const earningsMap: Record<string, any> = {};

    if (tickers.length > 0) {
      const raw = await getFMPQuote(tickers.join(","));
      quotes = Array.isArray(raw) ? raw : [];

      const earningsResults = await Promise.allSettled(tickers.map(t => getEarnings(t)));
      tickers.forEach((t, i) => {
        const r = earningsResults[i];
        if (r.status === "fulfilled" && r.value) earningsMap[t] = r.value;
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const holdingsStatus = holdings.map(h => {
      const q = quotes.find((q: any) => q.symbol === h.ticker);
      const currentPrice = q?.price ?? h.entryPrice;
      const drawdown = checkDrawdown(h.entryPrice, currentPrice, h.ticker);
      const earnings = earningsMap[h.ticker];
      const nextEarnings = Array.isArray(earnings)
        ? earnings.find((e: any) => e.date > today)
        : null;

      return {
        ticker: h.ticker,
        company: h.companyName,
        currentPrice,
        changePct: q?.changesPercentage ?? 0,
        returnPct: h.entryPrice > 0 ? ((currentPrice - h.entryPrice) / h.entryPrice) * 100 : 0,
        drawdownAlert: drawdown ? { level: drawdown.level, action: drawdown.action } : null,
        nextEarnings: nextEarnings
          ? { date: nextEarnings.date, epsEst: nextEarnings.epsEstimated }
          : null,
      };
    });

    const briefing = await callClaude({
      system: MORNING_BRIEFING_PROMPT,
      prompt: JSON.stringify({ date: today, holdingsStatus }, null, 2),
    });

    // Dispatch via webhook
    const webhook = process.env.ALERT_WEBHOOK_URL;
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*MAPO Morning Briefing ${today}*\n\n${briefing}` }),
      }).catch(e => console.error("[cron/morning] Webhook failed:", e));
    }

    console.log(`[cron/morning] Briefing dispatched for ${today}`);
    res.json({ success: true, date: today, briefing });
  } catch (err: any) {
    console.error("[cron/morning]", err);
    res.status(500).json({ error: err.message });
  }
}
