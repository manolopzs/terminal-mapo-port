export const EXCLUSION_LIST: Record<string, string> = {
  BMNR: "Crypto Mining",
  UP: "Aviation",
  MP: "Materials",
  CLSK: "Crypto Mining",
  NBIS: "AI/Cloud",
  AMD: "Semiconductors",
  TE: "Energy",
  IREN: "HPC Infrastructure",
  IBIT: "ETF",
  GOOGL: "Super Mega Cap (>$500B)",
  META: "Super Mega Cap (>$500B)",
  NVDA: "Super Mega Cap (>$500B)",
  AAPL: "Super Mega Cap (>$500B)",
  MSFT: "Super Mega Cap (>$500B)",
  AMZN: "Super Mega Cap (>$500B)",
  TSLA: "Super Mega Cap (>$500B)",
};

export function isExcluded(ticker: string): { excluded: boolean; reason?: string } {
  const upper = ticker.toUpperCase();
  if (EXCLUSION_LIST[upper]) {
    return { excluded: true, reason: EXCLUSION_LIST[upper] };
  }
  return { excluded: false };
}
