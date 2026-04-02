/**
 * Financial Modeling Prep API client (stable endpoints, post-Aug 2025)
 */
const FMP_BASE = "https://financialmodelingprep.com/stable";

async function fmpFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data === "string") return null;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (data["Error Message"] || data["error"]) return null;
    }
    return Array.isArray(data) && data.length === 0 ? null : data;
  } catch {
    return null;
  }
}

export async function getProfile(ticker: string) {
  return fmpFetch("/profile", { symbol: ticker });
}
export async function getIncomeStatement(ticker: string) {
  return fmpFetch("/income-statement", { symbol: ticker, period: "quarter", limit: "8" });
}
export async function getBalanceSheet(ticker: string) {
  return fmpFetch("/balance-sheet-statement", { symbol: ticker, period: "quarter", limit: "4" });
}
export async function getCashFlow(ticker: string) {
  return fmpFetch("/cash-flow-statement", { symbol: ticker, period: "quarter", limit: "4" });
}
export async function getKeyRatios(ticker: string) {
  return fmpFetch("/ratios", { symbol: ticker, limit: "5" });
}
export async function getKeyMetrics(ticker: string) {
  return fmpFetch("/key-metrics", { symbol: ticker, limit: "5" });
}
export async function getFinancialGrowth(ticker: string) {
  return fmpFetch("/financial-growth", { symbol: ticker, limit: "4" });
}

// Earnings: returns both upcoming and historical EPS actuals/estimates
// Used for SUE calculation (actual vs estimated EPS)
export async function getEarnings(ticker: string) {
  return fmpFetch("/earnings", { symbol: ticker });
}

// Upgrades/downgrades from analysts
export async function getUpgradesDowngrades(ticker: string) {
  return fmpFetch("/upgrades-downgrades", { symbol: ticker });
}

export async function getInsiderTrading(ticker: string) {
  return fmpFetch("/insider-trading", { symbol: ticker, limit: "10" });
}

export async function getFMPQuote(ticker: string) {
  return fmpFetch("/quote", { symbol: ticker });
}

// Screener: returns stocks matching market cap + sector filters
// Note: requires at least one filter param beyond limit
export async function screenStocks(params: {
  marketCapMoreThan?: number;
  marketCapLessThan?: number;
  betaMoreThan?: number;
  betaLessThan?: number;
  sector?: string;
  country?: string;
}) {
  const p: Record<string, string> = {
    marketCapMoreThan: String(params.marketCapMoreThan ?? 500_000_000),
    marketCapLessThan: String(params.marketCapLessThan ?? 50_000_000_000),
    country: params.country ?? "US",
    limit: "100",
  };
  if (params.sector) p.sector = params.sector;
  if (params.betaMoreThan !== undefined) p.betaMoreThan = String(params.betaMoreThan);
  if (params.betaLessThan !== undefined) p.betaLessThan = String(params.betaLessThan);
  return fmpFetch("/stock-screener", p);
}
