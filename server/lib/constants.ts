export const EXCLUSION_LIST: Record<string, string> = {
  BMNR: "Crypto Mining", UP: "Aviation", MP: "Materials", CLSK: "Crypto Mining",
  NBIS: "AI/Cloud", AMD: "Semiconductors", TE: "Energy", IREN: "HPC Infrastructure",
  IBIT: "ETF", GOOGL: "Super Mega Cap >$500B", META: "Super Mega Cap >$500B",
  NVDA: "Super Mega Cap >$500B", AAPL: "Super Mega Cap >$500B",
  MSFT: "Super Mega Cap >$500B", AMZN: "Super Mega Cap >$500B", TSLA: "Super Mega Cap >$500B",
};

export function isExcluded(ticker: string): { excluded: boolean; reason?: string } {
  const r = EXCLUSION_LIST[ticker.toUpperCase()];
  return r ? { excluded: true, reason: r } : { excluded: false };
}

export const RULES = {
  MIN_POSITIONS: 4, MAX_POSITIONS: 8,
  MAX_SINGLE_POSITION_PCT: 25, MAX_SECTOR_PCT: 40, MAX_MEGA_CAP_PCT: 30,
  MIN_CASH_PCT: 5, MAX_CASH_PCT: 20,
  MIN_ENTRY_SCORE: 65, STRONG_BUY_MIN: 80, BUY_MIN: 65, HOLD_MIN: 50,
  MIN_AVG_DAILY_VOLUME_USD: 5_000_000,
  MAX_PAIRWISE_CORRELATION: 0.75,
  DRAWDOWN_REVIEW: 0.10, DRAWDOWN_RESCORE: 0.15,
  DRAWDOWN_AUTO_EXIT: 0.20, DRAWDOWN_FORCED_EXIT: 0.25,
  DONCHIAN_REJECT: 0.95, DONCHIAN_PREFER: 0.60,
  HIGH_BETA_THRESHOLD: 1.8,
} as const;
