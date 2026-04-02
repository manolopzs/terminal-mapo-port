/**
 * Financial Modeling Prep API client
 * Handles: fundamentals, screener, earnings, news, analyst estimates
 * Uses the /stable/ API endpoint (required for new subscriptions post Aug 2025)
 */
const FMP_BASE = "https://financialmodelingprep.com/stable";

async function fmpFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    // Check for premium/error responses (can be a string or object with error keys)
    if (typeof data === "string") return null;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (data["Error Message"] || data["error"] || (data["message"] && String(data["message"]).includes("Premium"))) return null;
    }
    return data;
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
export async function getEarningsSurprises(ticker: string) {
  return fmpFetch("/earnings-surprises", { symbol: ticker });
}
export async function getAnalystEstimates(ticker: string) {
  // analyst-estimates requires period param on stable - try annual
  return fmpFetch("/analyst-estimates", { symbol: ticker, limit: "4" });
}
export async function getAnalystRecommendations(ticker: string) {
  return fmpFetch("/analyst-stock-recommendations", { symbol: ticker, limit: "5" });
}
export async function getInsiderTrading(ticker: string) {
  return fmpFetch("/insider-trading", { symbol: ticker, limit: "10" });
}
export async function getStockNews(ticker: string) {
  return fmpFetch("/news/stock-latest-news", { symbols: ticker, limit: "10" });
}
export async function getSectorPerformance() {
  return fmpFetch("/sector-performance");
}
export async function screenStocks(params: {
  marketCapMoreThan?: number;
  marketCapLessThan?: number;
  volumeMoreThan?: number;
  sector?: string;
}) {
  const p: Record<string, string> = {
    exchange: "NYSE,NASDAQ",
    marketCapMoreThan: String(params.marketCapMoreThan ?? 1_000_000_000),
    marketCapLessThan: String(params.marketCapLessThan ?? 50_000_000_000),
    volumeMoreThan: String(params.volumeMoreThan ?? 500_000),
    limit: "100",
  };
  if (params.sector) p.sector = params.sector;
  return fmpFetch("/stock-screener", p);
}
export async function getFMPQuote(ticker: string) {
  return fmpFetch("/quote", { symbol: ticker });
}
