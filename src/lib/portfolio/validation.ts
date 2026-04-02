/**
 * Portfolio validation: the 14 commandments enforced programmatically.
 * Thin wrapper over portfolio-validator that works with the portfolio state layer.
 */
import { validatePortfolio, type ValidationResult } from "../agents/risk/portfolio-validator.js";
import type { EnrichedHolding } from "./calculations.js";

export function runValidation(
  enriched: EnrichedHolding[],
  cash: number,
  totalValue: number
): ValidationResult {
  const holdings = enriched.map(h => ({
    ticker: h.ticker,
    sector: h.sector,
    value: h.value,
    score: h.entryScore,
    marketCap: h.marketCap,
    avgDailyVolume: h.avgDailyVolume,
  }));
  return validatePortfolio(holdings, cash, totalValue);
}

export { ValidationResult };
