/**
 * MAPO Quant Signal Calculators - Pure mathematics, no AI
 * All 7 alpha signals computed from raw price and earnings data
 */
import type { DailyBar } from "./alphavantage.js";

export interface QuantSignals {
  momentum: { confirmed: boolean; return12m: number };
  goldenCross: { confirmed: boolean; sma50: number; sma200: number };
  sue: { confirmed: boolean; score: number; latestSurprisePct: number };
  revisions: { confirmed: boolean; revisionPct: number };
  beta: { value: number; lowVol: boolean; highVol: boolean };
  valueFactor: { confirmed: boolean; currentEvEbitda: number; avgEvEbitda: number };
  donchian: { position: number; valid: boolean; reject: boolean; high52w: number; low52w: number };
  compositeCount: number;
  signalSummary: string;
}

// Signal 1: Price Momentum (12-1 month) - bars are newest first
export function calcMomentum(bars: DailyBar[]): { confirmed: boolean; return12m: number } {
  if (bars.length < 252) return { confirmed: false, return12m: 0 };
  const current = bars[21]?.close ?? bars[0].close;
  const yearAgo = bars[251]?.close ?? bars[bars.length - 1].close;
  const return12m = yearAgo === 0 ? 0 : (current - yearAgo) / yearAgo;
  return { confirmed: return12m > 0.10, return12m };
}

// Signal 2: Golden Cross (50-DMA > 200-DMA)
export function calcGoldenCross(bars: DailyBar[]): { confirmed: boolean; sma50: number; sma200: number } {
  if (bars.length < 200) return { confirmed: false, sma50: 0, sma200: 0 };
  const sma50 = bars.slice(0, 50).reduce((s, b) => s + b.close, 0) / 50;
  const sma200 = bars.slice(0, 200).reduce((s, b) => s + b.close, 0) / 200;
  return { confirmed: sma50 > sma200, sma50: Math.round(sma50 * 100) / 100, sma200: Math.round(sma200 * 100) / 100 };
}

// Signal 3: SUE (Standardized Unexpected Earnings)
export function calcSUE(surprises: any[]): { confirmed: boolean; score: number; latestSurprisePct: number } {
  if (!surprises || surprises.length < 4) return { confirmed: false, score: 0, latestSurprisePct: 0 };
  const diffs = surprises.slice(0, 8).map((s: any) => {
    const actual = s.actualEarningResult ?? s.actual ?? 0;
    const estimated = s.estimatedEarning ?? s.estimated ?? 0;
    return actual - estimated;
  });
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / diffs.length;
  const std = Math.sqrt(variance);
  if (std === 0) return { confirmed: false, score: 0, latestSurprisePct: 0 };
  const sue = diffs[0] / std;
  const latest = surprises[0];
  const estimated = latest?.estimatedEarning ?? latest?.estimated ?? 0;
  const latestSurprisePct = estimated !== 0 ? ((latest?.actualEarningResult ?? 0) - estimated) / Math.abs(estimated) : 0;
  return { confirmed: sue > 1, score: Math.round(sue * 10) / 10, latestSurprisePct };
}

// Signal 4: Analyst Revisions (EPS up >3% in 30d)
export function calcRevisions(estimates: any[]): { confirmed: boolean; revisionPct: number } {
  if (!estimates || estimates.length < 2) return { confirmed: false, revisionPct: 0 };
  const current = estimates[0]?.estimatedEpsAvg ?? estimates[0]?.eps ?? 0;
  const prior = estimates[1]?.estimatedEpsAvg ?? estimates[1]?.eps ?? 0;
  if (prior === 0) return { confirmed: false, revisionPct: 0 };
  const revisionPct = (current - prior) / Math.abs(prior);
  return { confirmed: revisionPct > 0.03, revisionPct: Math.round(revisionPct * 1000) / 1000 };
}

// Signal 5: Beta vs S&P 500
export function calcBeta(stockBars: DailyBar[], spBars: DailyBar[]): number {
  const days = Math.min(stockBars.length, spBars.length, 252);
  if (days < 60) return 1;
  const sr: number[] = [], mr: number[] = [];
  for (let i = 0; i < days - 1; i++) {
    sr.push((stockBars[i].close - stockBars[i + 1].close) / stockBars[i + 1].close);
    mr.push((spBars[i].close - spBars[i + 1].close) / spBars[i + 1].close);
  }
  const ms = sr.reduce((a, b) => a + b, 0) / sr.length;
  const mm = mr.reduce((a, b) => a + b, 0) / mr.length;
  let cov = 0, varM = 0;
  for (let i = 0; i < sr.length; i++) {
    cov += (sr[i] - ms) * (mr[i] - mm);
    varM += (mr[i] - mm) ** 2;
  }
  return varM === 0 ? 1 : Math.round((cov / varM) * 100) / 100;
}

// Signal 6: Value Factor (EV/EBITDA below 5yr average)
export function calcValueFactor(metrics: any[]): { confirmed: boolean; currentEvEbitda: number; avgEvEbitda: number } {
  if (!metrics || metrics.length < 2) return { confirmed: false, currentEvEbitda: 0, avgEvEbitda: 0 };
  // stable API uses evToEBITDA; legacy used enterpriseValueOverEBITDA
  const getEvEbitda = (m: any) => m?.evToEBITDA ?? m?.enterpriseValueOverEBITDA ?? 0;
  const current = getEvEbitda(metrics[0]);
  const avg = metrics.reduce((s: number, m: any) => s + getEvEbitda(m), 0) / metrics.length;
  return {
    confirmed: current > 0 && avg > 0 && current < avg,
    currentEvEbitda: Math.round(current * 10) / 10,
    avgEvEbitda: Math.round(avg * 10) / 10,
  };
}

// Signal 7: Donchian Channel Position (where stock sits in 52wk range)
export function calcDonchian(bars: DailyBar[], currentPrice: number): { position: number; valid: boolean; reject: boolean; high52w: number; low52w: number } {
  const yr = bars.slice(0, Math.min(252, bars.length));
  if (yr.length === 0) return { position: 0.5, valid: true, reject: false, high52w: currentPrice, low52w: currentPrice };
  const high52w = Math.max(...yr.map(b => b.high));
  const low52w = Math.min(...yr.map(b => b.low));
  const range = high52w - low52w;
  const position = range === 0 ? 0.5 : (currentPrice - low52w) / range;
  return {
    position: Math.round(position * 1000) / 1000,
    valid: position <= 0.60,
    reject: position >= 0.95,
    high52w: Math.round(high52w * 100) / 100,
    low52w: Math.round(low52w * 100) / 100,
  };
}

export function buildSignalSummary(s: Omit<QuantSignals, "signalSummary">): string {
  const parts = [
    s.momentum.confirmed ? `Momentum YES (${(s.momentum.return12m * 100).toFixed(1)}% 12m)` : `Momentum NO (${(s.momentum.return12m * 100).toFixed(1)}% 12m)`,
    s.goldenCross.confirmed ? `Golden Cross YES (50MA $${s.goldenCross.sma50} > 200MA $${s.goldenCross.sma200})` : `Death Cross (50MA $${s.goldenCross.sma50} < 200MA $${s.goldenCross.sma200})`,
    s.sue.confirmed ? `SUE YES (${s.sue.score}σ, latest ${(s.sue.latestSurprisePct * 100).toFixed(1)}% beat)` : `SUE NO (${s.sue.score}σ)`,
    s.revisions.confirmed ? `Revisions YES (+${(s.revisions.revisionPct * 100).toFixed(1)}% EPS)` : `Revisions NO`,
    `Beta ${s.beta.value} (${s.beta.highVol ? "HIGH BETA - penalty" : s.beta.lowVol ? "Low Vol" : "Normal"})`,
    s.valueFactor.confirmed ? `Value YES (EV/EBITDA ${s.valueFactor.currentEvEbitda} < 5yr avg ${s.valueFactor.avgEvEbitda})` : `Value NO`,
    `Donchian ${(s.donchian.position * 100).toFixed(0)}% of 52wk range [${s.donchian.reject ? "REJECT" : s.donchian.valid ? "valid entry" : "extended"}] H:$${s.donchian.high52w} L:$${s.donchian.low52w}`,
  ];
  return parts.join(" | ");
}
