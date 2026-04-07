import type { Holding } from "./types.js";

export interface EnrichedHolding extends Holding {
  currentPrice: number;
  value: number;
  returnPct: number;
  returnDollar: number;
  weightPct: number;
  marketCap: number;
  avgDailyVolume: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  investedValue: number;
  cash: number;
  cashPct: number;
  totalReturnPct: number;
  dayChangePct: number;
  weightedBeta: number;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
}

export function enrichHoldings(
  holdings: Holding[],
  quotes: Array<{ symbol: string; price: number; changesPercentage: number; avgVolume: number; marketCap: number }>,
  totalValue: number
): EnrichedHolding[] {
  return holdings.map(h => {
    const quote = quotes.find(q => q.symbol === h.ticker);
    const currentPrice = quote?.price ?? h.entryPrice;
    const value = h.shares * currentPrice;
    const returnDollar = (currentPrice - h.entryPrice) * h.shares;
    const returnPct = h.entryPrice > 0 ? (currentPrice - h.entryPrice) / h.entryPrice : 0;
    const weightPct = totalValue > 0 ? (value / totalValue) * 100 : 0;

    return {
      ...h,
      currentPrice,
      value,
      returnPct,
      returnDollar,
      weightPct,
      marketCap: quote?.marketCap ?? h.marketCapAtEntry,
      avgDailyVolume: (quote?.avgVolume ?? 0) * currentPrice,
    };
  });
}

export function calcPortfolioMetrics(
  enriched: EnrichedHolding[],
  cash: number,
  startingCapital: number,
  quotes?: Array<{ symbol: string; changesPercentage?: number; beta?: number }>,
): PortfolioMetrics {
  const investedValue = enriched.reduce((s, h) => s + h.value, 0);
  const totalValue = investedValue + cash;
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const totalReturnPct =
    startingCapital > 0 ? ((totalValue - startingCapital) / startingCapital) * 100 : 0;

  const dayChangePct =
    enriched.length > 0 && totalValue > 0
      ? enriched.reduce((s, h) => {
          const q = quotes?.find(q => q.symbol === h.ticker);
          const changePct = q?.changesPercentage ?? 0;
          return s + (h.value / totalValue) * changePct;
        }, 0)
      : 0;

  // Weighted beta (holdings only)
  const weightedBeta =
    investedValue > 0
      ? enriched.reduce((s, h) => {
          const w = h.value / investedValue;
          const q = quotes?.find(q => q.symbol === h.ticker);
          const beta = (q && typeof q.beta === "number") ? q.beta : 1;
          return s + w * beta;
        }, 0)
      : 1;

  return {
    totalValue,
    investedValue,
    cash,
    cashPct,
    totalReturnPct,
    dayChangePct,
    weightedBeta,
    sharpeRatio: null,
    maxDrawdown: null,
  };
}

export function calcSectorWeights(enriched: EnrichedHolding[], totalValue: number): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const h of enriched) {
    weights[h.sector] = (weights[h.sector] ?? 0) + (h.value / totalValue) * 100;
  }
  return weights;
}

export function findBestWorst(enriched: EnrichedHolding[]): {
  best: EnrichedHolding | null;
  worst: EnrichedHolding | null;
} {
  if (enriched.length === 0) return { best: null, worst: null };
  const sorted = [...enriched].sort((a, b) => b.returnPct - a.returnPct);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}
