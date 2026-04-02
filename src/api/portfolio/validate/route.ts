/**
 * POST /api/portfolio/validate
 * Runs all 9 validation checks against current or proposed portfolio
 */
import type { Request, Response } from "express";
import { getHoldings, getCash } from "../../../lib/portfolio/state.js";
import { getFMPQuote } from "../../../../server/lib/fmp.js";
import { enrichHoldings } from "../../../lib/portfolio/calculations.js";
import { runValidation } from "../../../lib/portfolio/validation.js";

export async function portfolioValidateRoute(req: Request, res: Response): Promise<void> {
  try {
    const holdings = await getHoldings();
    const cash = await getCash();

    const tickers = holdings.map(h => h.ticker);
    let quotes: any[] = [];
    if (tickers.length > 0) {
      const raw = await getFMPQuote(tickers.join(","));
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

    const result = runValidation(enriched, cash, totalValue);
    res.json({ ...result, totalValue, cash, positionCount: holdings.length });
  } catch (err: any) {
    console.error("[/api/portfolio/validate]", err);
    res.status(500).json({ error: err.message });
  }
}
