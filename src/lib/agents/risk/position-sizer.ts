import { RULES } from "../../constants/rules.js";

export interface SizingInput {
  score: number;          // 0-100 MAPO composite score
  beta: number;           // Calculated beta
  correlationPenalty: boolean; // True if adding this position exceeds correlation limits
  portfolioValue: number; // Current total portfolio value
  currentPositions: number; // Current number of positions
  cashAvailable: number;  // Available cash for deployment
}

export interface SizingResult {
  minPct: number;
  maxPct: number;
  recommendedPct: number;
  dollarAmount: number;
  rationale: string;
}

export function sizePosition(input: SizingInput): SizingResult {
  const { score, beta, correlationPenalty, portfolioValue, currentPositions, cashAvailable } = input;

  // Base allocation by score tier
  let minPct: number;
  let maxPct: number;

  if (score >= RULES.STRONG_BUY_MIN) {
    minPct = RULES.BASE_ALLOC_STRONG_BUY.min;
    maxPct = RULES.BASE_ALLOC_STRONG_BUY.max;
  } else {
    minPct = RULES.BASE_ALLOC_BUY.min;
    maxPct = RULES.BASE_ALLOC_BUY.max;
  }

  // Quant adjustments
  let adjustment = 0;
  const notes: string[] = [];

  if (score >= RULES.STRONG_BUY_MIN) {
    adjustment += RULES.SIGNAL_BOOST_PCT;
    notes.push(`+${RULES.SIGNAL_BOOST_PCT}% strong buy`);
  }

  if (beta > RULES.HIGH_BETA_THRESHOLD) {
    adjustment -= RULES.HIGH_BETA_PENALTY_PCT;
    notes.push(`-${RULES.HIGH_BETA_PENALTY_PCT}% high beta (${beta.toFixed(2)})`);
  }

  if (correlationPenalty) {
    adjustment -= RULES.CORRELATION_PENALTY_PCT;
    notes.push(`-${RULES.CORRELATION_PENALTY_PCT}% correlation penalty`);
  }

  // Recommended = midpoint of range + adjustments, clamped
  const midpoint = (minPct + maxPct) / 2;
  const recommendedPct = Math.min(
    RULES.MAX_SINGLE_POSITION_PCT,
    Math.max(minPct, midpoint + adjustment)
  );

  // Ensure we don't deploy more than available cash
  const maxByCash = (cashAvailable / portfolioValue) * 100;
  const finalPct = Math.min(recommendedPct, Math.min(maxByCash, maxPct));

  const dollarAmount = (finalPct / 100) * portfolioValue;

  return {
    minPct,
    maxPct,
    recommendedPct: Math.round(finalPct * 10) / 10,
    dollarAmount: Math.round(dollarAmount),
    rationale: notes.length > 0
      ? `Base ${minPct}-${maxPct}%, adjustments: ${notes.join(", ")}`
      : `Base ${minPct}-${maxPct}%`,
  };
}


export function sharesFromAllocation(
  pct: number,
  portfolioValue: number,
  currentPrice: number
): number {
  const targetValue = (pct / 100) * portfolioValue;
  return Math.floor(targetValue / currentPrice);
}
