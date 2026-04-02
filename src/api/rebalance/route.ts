/**
 * POST /api/rebalance
 * Monthly rebalance: current portfolio + top candidates -> Claude portfolio construction
 */
import type { Request, Response } from "express";
import { getHoldings, getCash } from "../../lib/portfolio/state.js";
import { getFMPQuote } from "../../../server/lib/fmp.js";
import { callClaudeDeep } from "../../lib/claude/client.js";
import { REBALANCE_PROMPT } from "../../lib/claude/prompts/rebalance.js";
import { runValidation } from "../../lib/portfolio/validation.js";
import { enrichHoldings } from "../../lib/portfolio/calculations.js";

export async function rebalanceRoute(req: Request, res: Response): Promise<void> {
  try {
    const holdings = await getHoldings();
    const cash = await getCash();

    let quotes: any[] = [];
    if (holdings.length > 0) {
      const raw = await getFMPQuote(holdings.map(h => h.ticker).join(","));
      quotes = Array.isArray(raw) ? raw : [];
    }

    const totalValue =
      holdings.reduce((s, h) => {
        const q = quotes.find((q: any) => q.symbol === h.ticker);
        return s + h.shares * (q?.price ?? h.entryPrice);
      }, 0) + cash;

    const enriched = enrichHoldings(
      holdings,
      quotes.map((q: any) => ({
        symbol: q.symbol,
        price: q.price ?? 0,
        changesPercentage: q.changesPercentage ?? 0,
        avgVolume: q.avgVolume ?? 0,
        marketCap: q.marketCap ?? 0,
      })),
      totalValue
    );

    const validation = runValidation(enriched, cash, totalValue);

    const context = {
      currentDate: new Date().toISOString().split("T")[0],
      portfolioValue: totalValue,
      cash,
      cashPct: totalValue > 0 ? (cash / totalValue) * 100 : 0,
      currentHoldings: enriched.map(h => ({
        ticker: h.ticker,
        company: h.companyName,
        sector: h.sector,
        shares: h.shares,
        entryPrice: h.entryPrice,
        currentPrice: h.currentPrice,
        value: h.value,
        weightPct: h.weightPct,
        returnPct: h.returnPct,
        entryScore: h.entryScore,
      })),
      validationStatus: validation,
    };

    const memo = await callClaudeDeep(
      REBALANCE_PROMPT,
      JSON.stringify(context, null, 2)
    );

    res.json({ memo, context, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error("[/api/rebalance]", err);
    res.status(500).json({ error: err.message });
  }
}
