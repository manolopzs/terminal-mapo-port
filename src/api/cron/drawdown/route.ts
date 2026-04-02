/**
 * Cron: GET /api/cron/drawdown
 * Schedule: 30 14-21 * * 1-5 (every hour during market hours)
 */
import type { Request, Response } from "express";
import { getHoldings, getSnapshotHistory } from "../../../lib/portfolio/state.js";
import { getFMPQuote } from "../../../../server/lib/fmp.js";
import { checkDrawdown, checkPortfolioDrawdown } from "../../../lib/agents/risk/drawdown-monitor.js";
import { addToCooldown } from "../../../lib/agents/risk/exclusion-guard.js";
import { sendAlert } from "../../../lib/alerts/send.js";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers["x-cron-secret"] ?? req.headers["authorization"];
  return auth === `Bearer ${secret}` || auth === secret;
}

export async function cronDrawdownRoute(req: Request, res: Response): Promise<void> {
  if (!verifyCron(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const holdings = await getHoldings();
    if (holdings.length === 0) { res.json({ alerts: [], checked: 0 }); return; }

    const raw = await getFMPQuote(holdings.map(h => h.ticker).join(","));
    const quotes: any[] = Array.isArray(raw) ? raw : [];
    const alerts = [];

    for (const holding of holdings) {
      const quote = quotes.find((q: any) => q.symbol === holding.ticker);
      if (!quote) continue;

      const alert = checkDrawdown(holding.entryPrice, quote.price, holding.ticker);
      if (!alert) continue;

      alerts.push(alert);

      // Persist alert to Supabase
      if (isSupabaseEnabled) {
        try {
          await supabase.from("alerts").insert({
            alert_type: `DRAWDOWN_${Math.round(alert.drawdownPct * 100)}`,
            ticker: alert.ticker,
            message: alert.action,
            severity: alert.level === "FORCED_EXIT" || alert.level === "AUTO_EXIT" ? "CRITICAL" : "WARNING",
          });
        } catch { /* non-fatal */ }
      }

      // Forced exit: add to cooldown + critical alert
      if (alert.level === "FORCED_EXIT") {
        await addToCooldown(alert.ticker, `Forced exit: ${(alert.drawdownPct * 100).toFixed(1)}% drawdown`);
        await sendAlert(alert.action, "CRITICAL");
      } else if (alert.level === "AUTO_EXIT") {
        await sendAlert(alert.action, "CRITICAL");
      } else {
        await sendAlert(alert.action, "WARNING");
      }
    }

    // Portfolio-level 30-day rolling drawdown check
    const snapshots = await getSnapshotHistory(35);
    const totalValue = holdings.reduce((s, h) => {
      const q = quotes.find((q: any) => q.symbol === h.ticker);
      return s + h.shares * (q?.price ?? h.entryPrice);
    }, 0);
    const valueHistory = snapshots.map(s => s.totalValue);
    const portfolioCheck = checkPortfolioDrawdown(totalValue, valueHistory);

    if (portfolioCheck.halt) {
      await sendAlert(
        `PORTFOLIO HALT: 30-day rolling return ${(portfolioCheck.rollingReturn * 100).toFixed(1)}% below -12% threshold. HALT ALL NEW ENTRIES.`,
        "CRITICAL"
      );
    }

    console.log(`[cron/drawdown] Checked ${holdings.length} holdings, ${alerts.length} alerts, portfolio halt: ${portfolioCheck.halt}`);
    res.json({ alerts, checked: holdings.length, portfolioCheck });
  } catch (err: any) {
    console.error("[cron/drawdown]", err);
    await sendAlert(`MAPO Drawdown Check FAILED: ${err.message}`, "CRITICAL").catch(() => {});
    res.status(500).json({ error: err.message });
  }
}
