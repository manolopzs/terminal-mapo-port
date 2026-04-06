/**
 * MAPO Composite Scorer
 * Orchestrates: FMP data fetch -> Quant signals -> Claude scoring
 */
import * as fmp from "../../../../server/lib/fmp.js";
import { assembleQuantSignals } from "../../scoring/quant-signals.js";
import { checkExclusion } from "../risk/exclusion-guard.js";
import { RULES } from "../../constants/rules.js";
import { callClaude } from "../../claude/client.js";
import { SCORING_SYSTEM_PROMPT } from "../../claude/prompts/scoring.js";
import type { QuantSignals } from "../../scoring/quant-signals.js";

export interface ScoringFactors {
  financialHealth: { base: number; adjusted: number; notes: string };
  valuation: { base: number; adjusted: number; notes: string };
  growth: { base: number; adjusted: number; notes: string };
  technical: { base: number; adjusted: number; notes: string };
  sentiment: { base: number; adjusted: number; notes: string };
  macroAlignment: { base: number; adjusted: number; notes: string };
}

export interface AnalysisResult {
  ticker: string;
  profile: any;
  quantSignals: QuantSignals | null;
  scoring: {
    factors: ScoringFactors;
    compositeScore: number;
    rating: "STRONG_BUY" | "BUY" | "HOLD" | "AVOID";
    bullCase: string[];
    bearCase: string[];
    recommendation: string;
    agiAlignment: string;
  } | null;
  rejected: boolean;
  rejectReason?: string;
  timestamp: string;
}

export async function analyzeStock(ticker: string): Promise<AnalysisResult> {
  const upper = ticker.toUpperCase();

  // Gate 1: Exclusion + cooldown
  const exclusionCheck = await checkExclusion(upper);
  if (!exclusionCheck.passed) {
    return {
      ticker: upper, profile: null, quantSignals: null, scoring: null,
      rejected: true, rejectReason: exclusionCheck.reason,
      timestamp: new Date().toISOString(),
    };
  }

  // Parallel data fetch
  const [
    profileArr, ratios, metrics, growth, income, balance, cashflow,
    earnings, upgrades, insider, avBars, avSpBars,
  ] = await Promise.allSettled([
    fmp.getProfile(upper),
    fmp.getKeyRatios(upper),
    fmp.getKeyMetrics(upper),
    fmp.getFinancialGrowth(upper),
    fmp.getIncomeStatement(upper),
    fmp.getBalanceSheet(upper),
    fmp.getCashFlow(upper),
    fmp.getEarnings(upper),
    fmp.getUpgradesDowngrades(upper),
    fmp.getInsiderTrading(upper),
    fmp.getDailyPrices(upper),
    fmp.getDailyPrices("SPY"),
  ]);

  const val = <T>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null;

  const profile = val(profileArr);
  const companyProfile = Array.isArray(profile) ? profile[0] : profile;
  const quote = await fmp.getFMPQuote(upper);
  const currentPrice = (Array.isArray(quote) ? quote[0]?.price : null) ?? val(avBars)?.[0]?.close ?? 0;
  const avgVolume = (Array.isArray(quote) ? quote[0]?.avgVolume : 0) ?? 0;

  // Gate 2: Liquidity
  if (avgVolume * currentPrice < RULES.MIN_AVG_DAILY_VOLUME && avgVolume > 0) {
    return {
      ticker: upper, profile: companyProfile, quantSignals: null, scoring: null,
      rejected: true,
      rejectReason: `LIQUIDITY REJECT: Avg daily dollar volume $${((avgVolume * currentPrice) / 1_000_000).toFixed(1)}M < $5M minimum`,
      timestamp: new Date().toISOString(),
    };
  }

  // Compute all 7 quant signals
  const bars = val(avBars) ?? [];
  const spBars = val(avSpBars) ?? [];
  const quantSignals = assembleQuantSignals({
    bars,
    spBars,
    earnings: val(earnings) ?? [],
    estimates: val(ratios) ?? [],
    metrics: val(metrics) ?? [],
    currentPrice,
  });

  // Gate 3: Donchian reject
  if (quantSignals.donchian.reject) {
    return {
      ticker: upper, profile: companyProfile, quantSignals,
      scoring: null, rejected: true,
      rejectReason: `DONCHIAN REJECT: ${upper} at ${(quantSignals.donchian.position * 100).toFixed(1)}% of 52wk range (>95% threshold)`,
      timestamp: new Date().toISOString(),
    };
  }

  // Build Claude data package
  const dataPackage = {
    company: {
      name: companyProfile?.companyName,
      ticker: upper,
      sector: companyProfile?.sector,
      industry: companyProfile?.industry,
      marketCap: companyProfile?.marketCap ?? companyProfile?.mktCap,
      price: currentPrice,
      exchange: companyProfile?.exchangeShortName,
    },
    financials: {
      ratios: Array.isArray(val(ratios)) ? val(ratios)!.slice(0, 3) : null,
      metrics: Array.isArray(val(metrics)) ? val(metrics)!.slice(0, 3) : null,
      growth: Array.isArray(val(growth)) ? val(growth)!.slice(0, 3) : null,
      recentIncome: Array.isArray(val(income)) ? val(income)!.slice(0, 4) : null,
      recentBalance: Array.isArray(val(balance)) ? val(balance)!.slice(0, 2) : null,
      recentCashflow: Array.isArray(val(cashflow)) ? val(cashflow)!.slice(0, 4) : null,
    },
    quantSignals,
    technicals: {
      sma50: quantSignals.goldenCross.sma50,
      sma200: quantSignals.goldenCross.sma200,
      donchianPosition: quantSignals.donchian.position,
      high52w: quantSignals.donchian.high52w,
      low52w: quantSignals.donchian.low52w,
      beta: quantSignals.beta.value,
    },
    sentiment: {
      analystActions: Array.isArray(val(upgrades)) ? val(upgrades)!.slice(0, 5) : null,
      insiderTrades: Array.isArray(val(insider)) ? val(insider)!.slice(0, 10) : null,
    },
  };

  // Claude scoring — retry once on rate limit / transient errors
  let rawResponse: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      rawResponse = await callClaude({
        system: SCORING_SYSTEM_PROMPT,
        prompt: `Score this stock. Respond ONLY with JSON, no markdown.\n\n${JSON.stringify(dataPackage, null, 2)}`,
      });
      break;
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || /rate.limit|overloaded|529/i.test(String(err?.message ?? ""));
      if (isRateLimit && attempt === 0) {
        console.warn(`[composite-scorer] Rate limit hit for ${upper}, retrying in 10s...`);
        await new Promise(r => setTimeout(r, 20_000));
      } else {
        console.error(`[composite-scorer] Claude call failed for ${upper}:`, err?.message ?? err);
        break;
      }
    }
  }

  let scoring: AnalysisResult["scoring"] = null;
  if (rawResponse) {
    try {
      const cleaned = rawResponse.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.rejected) {
        return {
          ticker: upper, profile: companyProfile, quantSignals,
          scoring: null, rejected: true,
          rejectReason: parsed.rejectReason ?? "Rejected by scorer",
          timestamp: new Date().toISOString(),
        };
      }
      scoring = {
        factors: parsed.factors,
        compositeScore: parsed.compositeScore,
        rating: parsed.rating,
        bullCase: parsed.bullCase ?? [],
        bearCase: parsed.bearCase ?? [],
        recommendation: parsed.recommendation ?? "",
        agiAlignment: parsed.agiAlignment ?? "",
      };
    } catch {
      console.error("[composite-scorer] Parse failed:", rawResponse.slice(0, 200));
    }
  }

  // Persist to score_history
  if (scoring) {
    try {
      const { supabase: sb, isSupabaseEnabled } = await import("../../../../server/lib/supabase.js");
      if (!isSupabaseEnabled) throw new Error("Supabase not configured");
      await sb.from("score_history").insert({
        ticker: upper,
        score_date: new Date().toISOString().split("T")[0],
        composite_score: scoring.compositeScore,
        financial_health: scoring.factors?.financialHealth?.adjusted,
        valuation: scoring.factors?.valuation?.adjusted,
        growth: scoring.factors?.growth?.adjusted,
        technical: scoring.factors?.technical?.adjusted,
        sentiment: scoring.factors?.sentiment?.adjusted,
        macro_alignment: scoring.factors?.macroAlignment?.adjusted,
        quant_signals: quantSignals,
        rating: scoring.rating,
        bull_case: JSON.stringify(scoring.bullCase),
        bear_case: JSON.stringify(scoring.bearCase),
        full_analysis: scoring.recommendation,
      });
    } catch { /* Supabase unavailable: non-fatal */ }
  }

  return {
    ticker: upper,
    profile: companyProfile,
    quantSignals,
    scoring,
    rejected: false,
    timestamp: new Date().toISOString(),
  };
}
