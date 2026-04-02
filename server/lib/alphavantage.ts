/**
 * Alpha Vantage API client
 * Handles: daily price history, RSI, SMA, EMA, technical indicators
 */
const AV_BASE = "https://www.alphavantage.co/query";

async function avFetch(params: Record<string, string>): Promise<any> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return null;
  const url = new URL(AV_BASE);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data["Error Message"] || data["Note"] || data["Information"]) return null;
    return data;
  } catch {
    return null;
  }
}

export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getDailyPrices(ticker: string, outputsize: "compact" | "full" = "full"): Promise<DailyBar[]> {
  const data = await avFetch({
    function: "TIME_SERIES_DAILY",
    symbol: ticker,
    outputsize,
  });
  if (!data) return [];
  const timeSeries = data["Time Series (Daily)"] || {};
  return Object.entries(timeSeries)
    .map(([date, vals]: [string, any]) => ({
      date,
      open: parseFloat(vals["1. open"]),
      high: parseFloat(vals["2. high"]),
      low: parseFloat(vals["3. low"]),
      close: parseFloat(vals["4. close"]),
      volume: parseInt(vals["5. volume"]),
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
}

export async function getRSI(ticker: string, period = 14): Promise<number | null> {
  const data = await avFetch({
    function: "RSI",
    symbol: ticker,
    interval: "daily",
    time_period: String(period),
    series_type: "close",
  });
  if (!data) return null;
  const techData = data["Technical Analysis: RSI"] || {};
  const latest = Object.values(techData)[0] as any;
  return latest ? parseFloat(latest["RSI"]) : null;
}
