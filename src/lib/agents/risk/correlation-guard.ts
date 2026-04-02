import { RULES } from "../../constants/rules.js";

export interface CorrelationResult {
  passed: boolean;
  pairwiseViolations: Array<{ tickerA: string; tickerB: string; correlation: number }>;
  avgCorrelation: number;
  highCorrelationPairs: number;
}

/**
 * Compute daily return series from price bars (newest first)
 */
function dailyReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 0; i < closes.length - 1; i++) {
    returns.push((closes[i] - closes[i + 1]) / closes[i + 1]);
  }
  return returns;
}

/**
 * Pearson correlation coefficient between two equal-length arrays
 */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 20) return 0;

  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 1000;
}

/**
 * Check portfolio correlation constraints.
 * @param holdings Array of { ticker, closes } where closes are newest-first daily close prices
 */
export function checkCorrelation(
  holdings: Array<{ ticker: string; closes: number[] }>
): CorrelationResult {
  const pairwiseViolations: CorrelationResult["pairwiseViolations"] = [];
  let totalCorrelation = 0;
  let pairCount = 0;
  let highCorrelationPairs = 0;

  // Precompute return series
  const returnSeries = holdings.map(h => ({
    ticker: h.ticker,
    returns: dailyReturns(h.closes),
  }));

  for (let i = 0; i < returnSeries.length; i++) {
    for (let j = i + 1; j < returnSeries.length; j++) {
      const corr = pearson(returnSeries[i].returns, returnSeries[j].returns);
      totalCorrelation += corr;
      pairCount++;

      if (corr >= RULES.HIGH_CORRELATION_THRESHOLD) {
        highCorrelationPairs++;
      }

      if (corr > RULES.MAX_PAIRWISE_CORRELATION) {
        pairwiseViolations.push({
          tickerA: returnSeries[i].ticker,
          tickerB: returnSeries[j].ticker,
          correlation: corr,
        });
      }
    }
  }

  const avgCorrelation = pairCount > 0 ? totalCorrelation / pairCount : 0;

  return {
    passed:
      pairwiseViolations.length === 0 &&
      avgCorrelation <= RULES.MAX_PORTFOLIO_AVG_CORRELATION &&
      highCorrelationPairs <= RULES.MAX_HIGH_CORRELATION_PAIRS,
    pairwiseViolations,
    avgCorrelation: Math.round(avgCorrelation * 1000) / 1000,
    highCorrelationPairs,
  };
}

/**
 * Check whether adding a new ticker would violate correlation limits
 * given existing portfolio price histories.
 */
export function wouldViolateCorrelation(
  newTicker: string,
  newCloses: number[],
  existingHoldings: Array<{ ticker: string; closes: number[] }>
): { violates: boolean; reason?: string } {
  const newReturns = dailyReturns(newCloses);

  for (const holding of existingHoldings) {
    const existingReturns = dailyReturns(holding.closes);
    const corr = pearson(newReturns, existingReturns);
    if (corr > RULES.MAX_PAIRWISE_CORRELATION) {
      return {
        violates: true,
        reason: `${newTicker} vs ${holding.ticker}: correlation ${corr.toFixed(3)} > ${RULES.MAX_PAIRWISE_CORRELATION} limit`,
      };
    }
  }

  return { violates: false };
}
