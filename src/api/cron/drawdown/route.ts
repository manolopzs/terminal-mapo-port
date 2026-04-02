/**
 * Cron: GET /api/cron/drawdown
 * Schedule: 0 * * * 1-5 (every hour on market days)
 * Checks all holdings for drawdown violations, saves alerts, triggers forced exits
 */
import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getHoldings } from "../../../lib/portfolio/state.js";
import { getFMPQuote } from "../../../../server/lib/fmp.js";
import { checkDrawdown } from "../../../lib/agents/risk/drawdown-monitor.js";
import { addToCooldown } from "../../../lib/agents/risk/exclusion-guard.js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

export async function cronDrawdownRoute(req: Request, res: Response): Promise<void> {
  // Verify cron secret
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const holdings = await getHoldings();
    if (holdings.length === 0) {
      res.json({ alerts: [], checked: 0 });
      return;
    }

    const raw = await getFMPQuote(holdings.map(h => h.ticker).join(","));
    const quotes: any[] = Array.isArray(raw) ? raw : [];
    const sb = getSupabase();
    const alerts = [];

    for (const holding of holdings) {
      const quote = quotes.find((q: any) => q.symbol === holding.ticker);
      if (!quote) continue;

      const alert = checkDrawdown(holding.entryPrice, quote.price, holding.ticker);
      if (!alert) continue;

      alerts.push(alert);

      // Persist alert
      try {
        await sb.from("alerts").insert({
          alert_type: `DRAWDOWN_${Math.round(alert.drawdownPct * 100)}`,
          ticker: alert.ticker,
          message: alert.action,
          severity: alert.level === "FORCED_EXIT" || alert.level === "AUTO_EXIT" ? "CRITICAL" : "WARNING",
        });
      } catch { /* non-fatal */ }

      // Forced exit: add to 90-day cooldown
      if (alert.level === "FORCED_EXIT") {
        await addToCooldown(
          alert.ticker,
          `Forced exit: ${(alert.drawdownPct * 100).toFixed(1)}% drawdown`
        );
      }
    }

    // Send webhook if any alerts
    const webhook = process.env.ALERT_WEBHOOK_URL;
    if (alerts.length > 0 && webhook) {
      const message = alerts.map(a => `*${a.level}*: ${a.action}`).join("\n\n");
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*MAPO DRAWDOWN ALERTS*\n\n${message}` }),
      }).catch(e => console.error("[cron/drawdown] Webhook failed:", e));
    }

    console.log(`[cron/drawdown] Checked ${holdings.length} holdings, ${alerts.length} alerts`);
    res.json({ alerts, checked: holdings.length });
  } catch (err: any) {
    console.error("[cron/drawdown]", err);
    res.status(500).json({ error: err.message });
  }
}
