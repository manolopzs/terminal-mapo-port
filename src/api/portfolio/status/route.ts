/**
 * GET /api/portfolio/status
 * Returns enriched holdings, portfolio metrics, drawdown alerts, validation
 */
import type { Request, Response } from "express";
import { getHoldings, getCash, getStartingCapital } from "../../../lib/portfolio/state.js";
import { getFMPQuote } from "../../../../server/lib/fmp.js";
import { enrichHoldings, calcPortfolioMetrics, calcSectorWeights } from "../../../lib/portfolio/calculations.js";
import { runValidation } from "../../../lib/portfolio/validation.js";
import { checkDrawdown } from "../../../lib/agents/risk/drawdown-monitor.js";

export async function portfolioStatusRoute(req: Request, res: Response): Promise<void> {
  try {
    const holdings = await getHoldings();
    if (holdings.length === 0) {
      res.json({ holdings: [], totalValue: 0, cash: 0, cashPct: 0 });
      return;
    }

    // Batch quote all tickers
    const tickers = holdings.map(h => h.ticker);
    const quoteData = await getFMPQuote(tickers.join(","));
    const quotes = Array.isArray(quoteData) ? quoteData : [];

    const cash = await getCash();
    const grossValue = holdings.reduce((s, h) => {
      const q = quotes.find((q: any) => q.symbol === h.ticker);
      return s + h.shares * (q?.price ?? h.entryPrice);
    }, 0);
    const totalValue = grossValue + cash;

    const enriched = enrichHoldings(
      holdings,
      quotes.map((q: any) => ({
        symbol: q.symbol,
        price: q.price,
        changesPercentage: q.changesPercentage,
        avgVolume: q.avgVolume,
        marketCap: q.marketCap,
      })),
      totalValue
    );

    const startingCapital = await getStartingCapital();
    const metrics = calcPortfolioMetrics(enriched, cash, startingCapital);
    const sectorWeights = calcSectorWeights(enriched, totalValue);
    const validation = runValidation(enriched, cash, totalValue);

    const drawdownAlerts = enriched
      .map(h => checkDrawdown(h.entryPrice, h.currentPrice ?? h.entryPrice, h.ticker))
      .filter(Boolean);

    res.json({
      holdings: enriched,
      metrics,
      sectorWeights,
      validation,
      drawdownAlerts,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[/api/portfolio/status]", err);
    res.status(500).json({ error: err.message });
  }
}
