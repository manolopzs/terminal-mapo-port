/**
 * Cron: GET /api/cron/earnings
 * Schedule: 0 12 * * 0 (weekly Sunday noon UTC)
 */
import type { Request, Response } from "express";
import { getHoldings } from "../../../lib/portfolio/state.js";
import { getEarnings } from "../../../../server/lib/fmp.js";
import { runEarningsMonitor } from "../../../lib/agents/intelligence/earnings-monitor.js";
import { sendAlert } from "../../../lib/alerts/send.js";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";
import { RULES } from "../../../lib/constants/rules.js";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  return auth === `Bearer ${secret}` || auth === secret;
}

export async function cronEarningsRoute(req: Request, res: Response): Promise<void> {
  if (!verifyCron(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const holdings = await getHoldings();
    if (holdings.length === 0) { res.json({ earningsAlerts: [], checked: 0 }); return; }

    const today = new Date().toISOString().split("T")[0];

    // Fetch earnings for all holdings in parallel
    const earningsResults = await Promise.allSettled(holdings.map(h => getEarnings(h.ticker)));
    const earningsMap: Record<string, any[]> = {};
    holdings.forEach((h, i) => {
      const r = earningsResults[i];
      if (r.status === "fulfilled" && Array.isArray(r.value)) earningsMap[h.ticker] = r.value;
    });

    // Find upcoming earnings within 14 days
    const upcomingAlerts: Array<{ ticker: string; date: string; daysUntil: number; epsEst?: number }> = [];
    for (const holding of holdings) {
      const earningsData = earningsMap[holding.ticker] ?? [];
      const upcoming = earningsData.find((e: any) => e.date > today && e.epsActual == null);
      if (!upcoming) continue;
      const daysUntil = Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / 86_400_000);
      if (daysUntil <= 14) {
        upcomingAlerts.push({ ticker: holding.ticker, date: upcoming.date, daysUntil, epsEst: upcoming.epsEstimated });
      }
    }

    // Run earnings monitor for SUE analysis on recent results
    const monitorResult = await runEarningsMonitor(
      holdings.map(h => ({ ticker: h.ticker, entryPrice: h.entryPrice }))
    ).catch(() => ({ upcomingEarnings: [], recentResults: [], alerts: [] }));

    // Send alerts for blackout violations
    const blackoutViolations = upcomingAlerts.filter(e => e.daysUntil <= RULES.EARNINGS_BLACKOUT_DAYS);
    for (const violation of blackoutViolations) {
      const msg = `EARNINGS BLACKOUT: ${violation.ticker} reports in ${violation.daysUntil} day(s) on ${violation.date}. EPS est: ${violation.epsEst ?? "?"}. No new positions allowed.`;
      await sendAlert(msg, "WARNING");
      if (isSupabaseEnabled) {
        try {
          await supabase.from("alerts").insert({
            alert_type: "EARNINGS_NEAR",
            ticker: violation.ticker,
            message: msg,
            severity: "WARNING",
          });
        } catch { /* non-fatal */ }
      }
    }

    // Send alerts for SUE misses
    for (const result of monitorResult.recentResults) {
      if (result.flag === "MANDATORY_RESCORE") {
        await sendAlert(
          `SUE MISS: ${result.ticker} reported ${(result.surprisePct * 100).toFixed(1)}% earnings miss. Mandatory re-score within 24 hours.`,
          "WARNING"
        );
      }
    }

    // Weekly calendar summary
    if (upcomingAlerts.length > 0) {
      const lines = upcomingAlerts
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .map(e => `${e.ticker}: ${e.date} (${e.daysUntil}d) | EPS est: ${e.epsEst ?? "?"}`)
        .join("\n");
      await sendAlert(`MAPO Earnings Calendar\n\n${lines}`, "INFO");
    }

    console.log(`[cron/earnings] ${upcomingAlerts.length} upcoming, ${blackoutViolations.length} blackouts, ${monitorResult.recentResults.length} recent`);
    res.json({
      upcomingAlerts,
      blackoutViolations,
      recentResults: monitorResult.recentResults,
      checked: holdings.length,
    });
  } catch (err: any) {
    console.error("[cron/earnings]", err);
    await sendAlert(`MAPO Earnings Cron FAILED: ${err.message}`, "CRITICAL").catch(() => {});
    res.status(500).json({ error: err.message });
  }
}
