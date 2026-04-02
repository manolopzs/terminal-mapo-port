/**
 * Cron: GET /api/cron/earnings
 * Schedule: 0 12 * * 0 (weekly Sunday, noon UTC)
 * Checks earnings within BLACKOUT_DAYS, dispatches calendar alert
 */
import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getHoldings } from "../../../lib/portfolio/state.js";
import { getEarnings } from "../../../../server/lib/fmp.js";
import { RULES } from "../../../lib/constants/rules.js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

export async function cronEarningsRoute(req: Request, res: Response): Promise<void> {
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const holdings = await getHoldings();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const sb = getSupabase();
    const earningsAlerts: Array<{ ticker: string; date: string; daysUntil: number; epsEst?: number }> = [];

    const results = await Promise.allSettled(holdings.map(h => getEarnings(h.ticker)));

    holdings.forEach((holding, i) => {
      const r = results[i];
      if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;

      // Find next scheduled earnings (date > today, no actual result yet)
      const upcoming = r.value.find(
        (e: any) => e.date > todayStr && e.epsActual == null
      );
      if (!upcoming) return;

      const earningsDate = new Date(upcoming.date);
      const daysUntil = Math.ceil((earningsDate.getTime() - today.getTime()) / 86_400_000);

      if (daysUntil <= RULES.EARNINGS_BLACKOUT_DAYS * 7) {
        earningsAlerts.push({
          ticker: holding.ticker,
          date: upcoming.date,
          daysUntil,
          epsEst: upcoming.epsEstimated,
        });
      }
    });

    // Persist and alert on blackout violations (<= 3 days)
    const blackoutViolations = earningsAlerts.filter(e => e.daysUntil <= RULES.EARNINGS_BLACKOUT_DAYS);
    for (const alert of blackoutViolations) {
      try {
        await sb.from("alerts").insert({
          alert_type: "EARNINGS_NEAR",
          ticker: alert.ticker,
          message: `${alert.ticker} earnings in ${alert.daysUntil} day(s) on ${alert.date}. EPS est: ${alert.epsEst ?? "?"}. BLACKOUT: no new positions.`,
          severity: "WARNING",
        });
      } catch { /* non-fatal */ }
    }

    // Dispatch full calendar via webhook
    const webhook = process.env.ALERT_WEBHOOK_URL;
    if (earningsAlerts.length > 0 && webhook) {
      const lines = earningsAlerts
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .map(e => `${e.ticker}: ${e.date} (${e.daysUntil}d) | EPS est: ${e.epsEst ?? "?"}`)
        .join("\n");
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*MAPO Earnings Calendar*\n\n${lines}` }),
      }).catch(e => console.error("[cron/earnings] Webhook failed:", e));
    }

    console.log(`[cron/earnings] ${earningsAlerts.length} upcoming earnings found, ${blackoutViolations.length} in blackout`);
    res.json({ earningsAlerts, blackoutViolations, checked: holdings.length });
  } catch (err: any) {
    console.error("[cron/earnings]", err);
    res.status(500).json({ error: err.message });
  }
}
