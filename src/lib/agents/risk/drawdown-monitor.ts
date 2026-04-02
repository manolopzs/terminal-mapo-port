import { RULES } from "../../constants/rules.js";

export interface DrawdownAlert {
  ticker: string;
  drawdownPct: number;
  level: "REVIEW" | "RESCORE" | "AUTO_EXIT" | "FORCED_EXIT";
  action: string;
}

export function checkDrawdown(
  entryPrice: number,
  currentPrice: number,
  ticker: string
): DrawdownAlert | null {
  const drawdown = (entryPrice - currentPrice) / entryPrice;

  if (drawdown >= RULES.DRAWDOWN_FORCED_EXIT) {
    return {
      ticker,
      drawdownPct: drawdown,
      level: "FORCED_EXIT",
      action: `FORCED EXIT: ${ticker} down ${(drawdown * 100).toFixed(1)}% from entry. Full exit required, no exceptions. Add to 90-day cooldown.`,
    };
  }
  if (drawdown >= RULES.DRAWDOWN_AUTO_EXIT) {
    return {
      ticker,
      drawdownPct: drawdown,
      level: "AUTO_EXIT",
      action: `AUTO-EXIT WARNING: ${ticker} down ${(drawdown * 100).toFixed(1)}%. Exit unless board-level catalyst imminent within 30 days.`,
    };
  }
  if (drawdown >= RULES.DRAWDOWN_RESCORE) {
    return {
      ticker,
      drawdownPct: drawdown,
      level: "RESCORE",
      action: `MANDATORY RE-SCORE: ${ticker} down ${(drawdown * 100).toFixed(1)}%. If new score <65, reduce position by 50%.`,
    };
  }
  if (drawdown >= RULES.DRAWDOWN_REVIEW) {
    return {
      ticker,
      drawdownPct: drawdown,
      level: "REVIEW",
      action: `THESIS REVIEW: ${ticker} down ${(drawdown * 100).toFixed(1)}%. Confirm catalysts still intact.`,
    };
  }

  return null;
}

export function checkPortfolioDrawdown(
  currentValue: number,
  valueHistory: number[]
): { halt: boolean; rollingReturn: number } {
  if (valueHistory.length < 2) return { halt: false, rollingReturn: 0 };
  const value30dAgo = valueHistory[Math.min(21, valueHistory.length - 1)];
  const rollingReturn = (currentValue - value30dAgo) / value30dAgo;
  return {
    halt: rollingReturn <= RULES.PORTFOLIO_HALT_THRESHOLD,
    rollingReturn,
  };
}

export function getDrawdownSeverity(drawdownPct: number): string {
  if (drawdownPct >= RULES.DRAWDOWN_FORCED_EXIT) return "CRITICAL";
  if (drawdownPct >= RULES.DRAWDOWN_AUTO_EXIT) return "CRITICAL";
  if (drawdownPct >= RULES.DRAWDOWN_RESCORE) return "WARNING";
  if (drawdownPct >= RULES.DRAWDOWN_REVIEW) return "INFO";
  return "OK";
}
