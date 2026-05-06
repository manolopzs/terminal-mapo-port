/**
 * Financial Modeling Prep API client (stable endpoints, post-Aug 2025)
 */
const FMP_BASE = "https://financialmodelingprep.com/stable";

// General response cache: cacheKey → {data, ts}
const _cache = new Map<string, { data: any; ts: number }>();
const _inflight = new Map<string, Promise<any>>();

async function fmpFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cacheKey = url.toString();
  const TTL = 300_000; // 5 minutes

  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  const existing = _inflight.get(cacheKey);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data === "string") return null;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data["Error Message"] || data["error"]) return null;
      }
      const result = Array.isArray(data) && data.length === 0 ? null : data;
      _cache.set(cacheKey, { data: result, ts: Date.now() });
      return result;
    } catch {
      return null;
    } finally {
      _inflight.delete(cacheKey);
    }
  })();

  _inflight.set(cacheKey, p);
  return p;
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

// Yahoo Finance fallback for US OTC tickers (PNK/Pink Sheets like SIVEF)
async function getYahooQuote(ticker: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
    const change = price - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    return {
      symbol: ticker.toUpperCase(),
      price,
      change: Math.round(change * 10000) / 10000,
      changesPercentage: Math.round(changePct * 10000) / 10000,
      previousClose: prev,
      open: meta.regularMarketDayLow,
      dayLow: meta.regularMarketDayLow,
      dayHigh: meta.regularMarketDayHigh,
    };
  } catch {
    return null;
  }
}

// Finnhub fallback (used as last resort)
async function getFinnhubQuote(ticker: string): Promise<any | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d?.c !== "number" || d.c <= 0) return null;
    return {
      symbol: ticker.toUpperCase(),
      price: d.c,
      change: d.d ?? 0,
      changesPercentage: d.dp ?? 0,
      dayLow: d.l,
      dayHigh: d.h,
      open: d.o,
      previousClose: d.pc,
    };
  } catch {
    return null;
  }
}

async function getQuoteWithFallback(ticker: string): Promise<any[] | null> {
  // 1. FMP (covers most US listed stocks)
  const fmpResult = await fmpFetch("/quote", { symbol: ticker });
  if (Array.isArray(fmpResult) && fmpResult.length > 0) return fmpResult;
  // 2. Yahoo (covers US OTC/pink sheets like SIVEF)
  const yahoo = await getYahooQuote(ticker);
  if (yahoo) return [yahoo];
  // 3. Finnhub (last resort, may return foreign exchange data)
  const finnhub = await getFinnhubQuote(ticker);
  return finnhub ? [finnhub] : null;
}

export async function getFMPQuote(ticker: string) {
  const symbols = ticker.split(",").map(s => s.trim()).filter(Boolean);
  if (symbols.length <= 1) {
    return getQuoteWithFallback(ticker);
  }
  // Batch: fetch each symbol in parallel, merge results
  const results = await Promise.allSettled(
    symbols.map(s => getQuoteWithFallback(s))
  );
  const merged: any[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      merged.push(...r.value);
    }
  }
  return merged.length > 0 ? merged : null;
}

// Daily price history for quant signals (SMA, momentum, beta, Donchian)
// Returns bars newest-first. Results are cached to avoid duplicate requests.
const _priceCache = new Map<string, { data: any[]; ts: number }>();
const _priceInflight = new Map<string, Promise<any[]>>();

export async function getDailyPrices(ticker: string): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const key = ticker.toUpperCase();
  const ttl = key === "SPY" ? 3_600_000 : 300_000; // SPY: 1hr, stocks: 5min

  const cached = _priceCache.get(key);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;

  // Deduplicate concurrent requests for the same ticker
  const existing = _priceInflight.get(key);
  if (existing) return existing;

  const p = fmpFetch("/historical-price-eod/full", { symbol: key }).then((data: any) => {
    if (!data || !Array.isArray(data)) return [];
    const bars = data
      .map((d: any) => ({
        date: d.date,
        open: d.open ?? d.adjOpen ?? 0,
        high: d.high ?? d.adjHigh ?? 0,
        low: d.low ?? d.adjLow ?? 0,
        close: d.close ?? d.adjClose ?? 0,
        volume: d.volume ?? 0,
      }))
      .sort((a: any, b: any) => b.date.localeCompare(a.date));
    _priceCache.set(key, { data: bars, ts: Date.now() });
    _priceInflight.delete(key);
    return bars;
  }).catch(() => { _priceInflight.delete(key); return []; });

  _priceInflight.set(key, p);
  return p;
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
    limit: "1000",
  };
  if (params.sector) p.sector = params.sector;
  if (params.betaMoreThan !== undefined) p.betaMoreThan = String(params.betaMoreThan);
  if (params.betaLessThan !== undefined) p.betaLessThan = String(params.betaLessThan);
  return fmpFetch("/company-screener", p);
}
