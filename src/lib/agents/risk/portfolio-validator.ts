import { RULES } from "../../constants/rules.js";
import { isExcluded } from "../../constants/exclusion-list.js";

export interface ValidationCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
}

export interface HoldingForValidation {
  ticker: string;
  sector: string;
  value: number;
  score: number;
  marketCap: number;
  avgDailyVolume: number; // dollar volume
}

export function validatePortfolio(
  holdings: HoldingForValidation[],
  cash: number,
  totalValue: number
): ValidationResult {
  const checks: ValidationCheck[] = [];

  // 1. Position count
  checks.push({
    rule: "4-8 positions",
    passed: holdings.length >= RULES.MIN_POSITIONS && holdings.length <= RULES.MAX_POSITIONS,
    detail: `${holdings.length} positions`,
  });

  // 2. Max single position
  const weights = holdings.map(h => (h.value / totalValue) * 100);
  const maxWeight = Math.max(0, ...weights);
  checks.push({
    rule: "Max 25% single position",
    passed: maxWeight <= RULES.MAX_SINGLE_POSITION_PCT,
    detail: `Largest: ${maxWeight.toFixed(1)}%`,
  });

  // 3. Max sector
  const sectorWeights: Record<string, number> = {};
  holdings.forEach(h => {
    sectorWeights[h.sector] = (sectorWeights[h.sector] || 0) + (h.value / totalValue) * 100;
  });
  const maxSector = Math.max(0, ...Object.values(sectorWeights));
  checks.push({
    rule: "Max 40% single sector",
    passed: maxSector <= RULES.MAX_SECTOR_PCT,
    detail: `Largest sector: ${maxSector.toFixed(1)}%`,
  });

  // 4. Mega-cap exposure (>$200B)
  const megaCapWeight = holdings
    .filter(h => h.marketCap > RULES.LARGE_CAP_MAX)
    .reduce((sum, h) => sum + (h.value / totalValue) * 100, 0);
  checks.push({
    rule: "Max 30% mega-cap (>$200B)",
    passed: megaCapWeight <= RULES.MAX_MEGA_CAP_PCT,
    detail: `Mega-cap: ${megaCapWeight.toFixed(1)}%`,
  });

  // 5. All scores 65+
  const lowScores = holdings.filter(h => h.score < RULES.MIN_ENTRY_SCORE);
  checks.push({
    rule: "All positions scored 65+",
    passed: lowScores.length === 0,
    detail: lowScores.length > 0
      ? `Below 65: ${lowScores.map(h => h.ticker).join(", ")}`
      : "All pass",
  });

  // 6. No exclusion list tickers
  const excluded = holdings.filter(h => isExcluded(h.ticker).excluded);
  checks.push({
    rule: "No Exclusion List tickers",
    passed: excluded.length === 0,
    detail: excluded.length > 0
      ? `Excluded: ${excluded.map(h => h.ticker).join(", ")}`
      : "All clear",
  });

  // 7. Minimum 3 sectors
  const sectorCount = Object.keys(sectorWeights).length;
  checks.push({
    rule: "Minimum 3 sectors",
    passed: sectorCount >= RULES.MIN_SECTORS,
    detail: `${sectorCount} sectors`,
  });

  // 8. Cash reserve 5-20%
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  checks.push({
    rule: "5-20% cash reserve",
    passed: cashPct >= RULES.MIN_CASH_PCT && cashPct <= RULES.MAX_CASH_PCT,
    detail: `Cash: ${cashPct.toFixed(1)}%`,
  });

  // 9. Liquidity: avg daily dollar volume >$5M
  const illiquid = holdings.filter(h => h.avgDailyVolume < RULES.MIN_AVG_DAILY_VOLUME);
  checks.push({
    rule: "All positions avg daily volume >$5M",
    passed: illiquid.length === 0,
    detail: illiquid.length > 0
      ? `Illiquid: ${illiquid.map(h => h.ticker).join(", ")}`
      : "All liquid",
  });

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}
