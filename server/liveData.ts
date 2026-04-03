/**
 * Live market data via Finnhub REST API (https://finnhub.io)
 * Free tier: 60 API calls / minute — sufficient for this portfolio.
 * Set FINNHUB_API_KEY environment variable to enable live data.
 */

const FINNHUB_BASE = "https://finnhub.io/api/v1";

// In-memory cache with TTL
const cache = new Map<string, { data: any; expiry: number }>();

async function cachedAsync<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiry > now) return entry.data as T;
  const data = await fn();
  cache.set(key, { data, expiry: now + ttlMs });
  return data;
}

async function finnhub(path: string): Promise<any> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const url = `${FINNHUB_BASE}${path}${path.includes("?") ? "&" : "?"}token=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Finnhub ${res.status}: ${path}`);
  return res.json();
}

export interface LiveQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  previousClose: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  volume: number;
  marketCap: number;
  marketStatus: string;
}

export async function fetchLiveQuotes(rawTickers: string[]): Promise<LiveQuote[]> {
  if (rawTickers.length === 0 || !process.env.FINNHUB_API_KEY) return [];

  const tickers = rawTickers
    .map(t => t.replace(/[^A-Z0-9.\-]/gi, "").toUpperCase())
    .filter(t => t.length > 0 && t.length <= 10);

  // Fetch real market status once, share across all quotes
  const marketStatusResult = await Promise.allSettled([
    finnhub("/stock/market-status?exchange=US"),
  ]);
  const statusData = marketStatusResult[0].status === "fulfilled" ? marketStatusResult[0].value : null;
  const marketStatus = statusData?.isOpen === true ? "open" : statusData?.isOpen === false ? "closed" : "unknown";

  const cacheKey = `quotes:${[...tickers].sort().join(",")}`;
  return cachedAsync(cacheKey, 60_000, async () => {
    const results = await Promise.allSettled(
      tickers.map(async (symbol): Promise<LiveQuote | null> => {
        try {
          const data = await finnhub(`/quote?symbol=${symbol}`);
          if (!data || !data.c || data.c === 0) return null;
          return {
            symbol,
            name: symbol,
            price: data.c,
            change: data.d ?? 0,
            changesPercentage: data.dp ?? 0,
            previousClose: data.pc ?? 0,
            dayLow: data.l ?? 0,
            dayHigh: data.h ?? 0,
            yearLow: 0,
            yearHigh: 0,
            volume: 0,
            marketCap: 0,
            marketStatus,
          };
        } catch {
          return null;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<LiveQuote> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map(r => r.value as LiveQuote);
  });
}

export interface ExtendedQuote {
  symbol: string;
  week52High: number;
  week52Low: number;
  currentPrice: number;
}

export async function fetchExtendedQuotes(rawTickers: string[]): Promise<ExtendedQuote[]> {
  if (rawTickers.length === 0 || !process.env.FINNHUB_API_KEY) return [];

  const tickers = rawTickers
    .map(t => t.replace(/[^A-Z0-9.\-]/gi, "").toUpperCase())
    .filter(t => t.length > 0 && t.length <= 10);

  const cacheKey = `extended-quotes:${[...tickers].sort().join(",")}`;
  return cachedAsync(cacheKey, 3_600_000, async () => {
    const results = await Promise.allSettled(
      tickers.map(async (symbol): Promise<ExtendedQuote | null> => {
        try {
          const [metricData, quoteData] = await Promise.allSettled([
            finnhub(`/stock/metric?symbol=${symbol}&metric=all`),
            finnhub(`/quote?symbol=${symbol}`),
          ]);

          const metric = metricData.status === "fulfilled" ? metricData.value?.metric : null;
          const quote = quoteData.status === "fulfilled" ? quoteData.value : null;

          const week52High = metric?.["52WeekHigh"] ?? 0;
          const week52Low = metric?.["52WeekLow"] ?? 0;
          const currentPrice = quote?.c ?? 0;

          return {
            symbol,
            week52High,
            week52Low,
            currentPrice,
          };
        } catch {
          return { symbol, week52High: 0, week52Low: 0, currentPrice: 0 };
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ExtendedQuote> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map(r => r.value as ExtendedQuote);
  });
}

export interface EarningsEvent {
  ticker: string;
  date: string;
  time: string;
  fiscalPeriod: string;
  status: string;
}

export async function fetchEarningsSchedule(rawTickers: string[]): Promise<EarningsEvent[]> {
  if (rawTickers.length === 0 || !process.env.FINNHUB_API_KEY) return [];

  const tickers = rawTickers
    .map(t => t.replace(/[^A-Z0-9.\-]/gi, "").toUpperCase())
    .filter(t => t.length > 0 && t.length <= 10);

  const cacheKey = `earnings:${[...tickers].sort().join(",")}`;
  return cachedAsync(cacheKey, 3_600_000, async () => {
    const today = new Date().toISOString().split("T")[0];
    const in90Days = new Date(Date.now() + 90 * 864e5).toISOString().split("T")[0];

    const results = await Promise.allSettled(
      tickers.map(async (symbol): Promise<EarningsEvent | null> => {
        try {
          const data = await finnhub(`/calendar/earnings?from=${today}&to=${in90Days}&symbol=${symbol}`);
          const item = data?.earningsCalendar?.[0];
          if (!item) return null;
          return {
            ticker: symbol,
            date: item.date ?? "",
            time: item.hour === "bmo" ? "Before Open" : item.hour === "amc" ? "After Close" : item.hour ?? "",
            fiscalPeriod: item.quarter ? `Q${item.quarter} ${item.year}` : "",
            status: "upcoming",
          };
        } catch {
          return null;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<EarningsEvent> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map(r => r.value as EarningsEvent);
  });
}

export interface MarketSentiment {
  sentiment: string;
  marketStatus: string;
}

export async function fetchMarketSentiment(): Promise<MarketSentiment> {
  if (!process.env.FINNHUB_API_KEY) return { sentiment: "UNCERTAIN", marketStatus: "unknown" };

  return cachedAsync("market-sentiment", 300_000, async () => {
    try {
      // Use SPY quote to derive sentiment from daily change
      const [spy, statusData] = await Promise.allSettled([
        finnhub("/quote?symbol=SPY"),
        finnhub("/stock/market-status?exchange=US"),
      ]);

      const spyData = spy.status === "fulfilled" ? spy.value : null;
      const isOpen = statusData.status === "fulfilled" ? statusData.value?.isOpen : null;

      let sentiment = "NEUTRAL";
      if (spyData?.dp != null) {
        if (spyData.dp > 0.5) sentiment = "BULLISH";
        else if (spyData.dp < -0.5) sentiment = "BEARISH";
        else sentiment = "NEUTRAL";
      }

      return {
        sentiment,
        marketStatus: isOpen === true ? "open" : isOpen === false ? "closed" : "unknown",
      };
    } catch {
      return { sentiment: "UNCERTAIN", marketStatus: "unknown" };
    }
  });
}

export interface MarketPulseData {
  indices: Array<{ symbol: string; label: string; price: number; changePct: number }>;
  sentiment: {
    score: number;        // 0–100 (0=Extreme Fear, 100=Extreme Greed)
    label: string;        // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
    bullPct: number;
    bearPct: number;
    neutPct: number;
  };
  context: string;
  marketStatus: string;
}

export async function fetchMarketPulse(): Promise<MarketPulseData> {
  return cachedAsync("market-pulse", 300_000, async () => {
    const SYMBOLS = ["SPY", "QQQ", "IWM", "VIX", "GLD", "TLT"];
    const LABELS: Record<string, string> = {
      SPY: "S&P 500", QQQ: "NASDAQ", IWM: "Russell 2K", VIX: "VIX", GLD: "Gold", TLT: "20Y Bond",
    };

    // Fetch index quotes + market status + CNN Fear & Greed in parallel
    const [quotesRes, statusRes, fgRes] = await Promise.allSettled([
      Promise.all(SYMBOLS.map(s => finnhub(`/quote?symbol=${s}`))),
      finnhub("/stock/market-status?exchange=US"),
      fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    // Build index rows
    const rawQuotes = quotesRes.status === "fulfilled" ? quotesRes.value : [];
    const indices = SYMBOLS.map((sym, i) => {
      const q = rawQuotes[i];
      return {
        symbol: sym,
        label: LABELS[sym],
        price: q?.c ?? 0,
        changePct: q?.dp ?? 0,
      };
    });

    const marketStatus = statusRes.status === "fulfilled"
      ? (statusRes.value?.isOpen ? "open" : "closed")
      : "unknown";

    // CNN Fear & Greed score (0-100)
    let fgScore: number | null = null;
    if (fgRes.status === "fulfilled" && fgRes.value) {
      fgScore = fgRes.value?.fear_and_greed?.score ?? null;
    }

    // Fallback: derive score from VIX + SPY change
    if (fgScore === null) {
      const vixPct = rawQuotes[3]?.c ?? 20; // VIX current
      const spyDp = rawQuotes[0]?.dp ?? 0;
      // VIX 10 → score 90 (greed), VIX 40 → score 10 (fear)
      const vixScore = Math.max(10, Math.min(90, 90 - (vixPct - 10) * 2.67));
      // SPY trend nudge: ±0.5% day change shifts score ±10
      const trendNudge = Math.min(15, Math.max(-15, spyDp * 10));
      fgScore = Math.round(Math.max(0, Math.min(100, vixScore + trendNudge)));
    }

    const score = fgScore;
    let label: string;
    if (score >= 75) label = "Extreme Greed";
    else if (score >= 55) label = "Greed";
    else if (score >= 45) label = "Neutral";
    else if (score >= 25) label = "Fear";
    else label = "Extreme Fear";

    // Retail sentiment bar: map score to bull/bear/neut distribution
    // Score 100 → 65% bull, 10% bear, 25% neut
    // Score 0   → 15% bull, 60% bear, 25% neut
    const bullPct = Math.round(15 + (score / 100) * 50);
    const bearPct = Math.round(60 - (score / 100) * 50);
    const neutPct = 100 - bullPct - bearPct;

    // Context line
    const spyDp = rawQuotes[0]?.dp ?? 0;
    const vixVal = rawQuotes[3]?.c ?? 0;
    const bondDp = rawQuotes[5]?.dp ?? 0;
    let context = "";
    if (vixVal > 30) context = "High volatility regime — elevated tail risk";
    else if (vixVal > 20) context = "Elevated uncertainty, risk-off posture";
    else if (score >= 75) context = "Retail optimism stretched — watch for reversal";
    else if (score <= 25) context = "Fear-driven selling, potential contrarian entry";
    else if (spyDp > 1 && bondDp < -0.5) context = "Risk-on rotation: equities bid, bonds sold";
    else if (spyDp < -1 && bondDp > 0.5) context = "Flight to safety — classic risk-off";
    else if (spyDp > 0.5) context = "Broad market advancing with low volatility";
    else if (spyDp < -0.5) context = "Broad market under pressure";
    else context = "Consolidation — low conviction tape";

    return { indices, sentiment: { score, label, bullPct, bearPct, neutPct }, context, marketStatus };
  });
}

export async function fetchPortfolioNews(
  rawTickers: string[]
): Promise<Array<{ ticker: string; headline: string; time: string; source: string }>> {
  if (rawTickers.length === 0 || !process.env.FINNHUB_API_KEY) return [];

  const tickers = rawTickers
    .map(t => t.replace(/[^A-Z0-9.\-]/gi, "").toUpperCase())
    .filter(t => t.length > 0 && t.length <= 10)
    .slice(0, 4);

  const cacheKey = `news:${[...tickers].sort().join(",")}`;
  return cachedAsync(cacheKey, 600_000, async () => {
    const from = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
    const to = new Date().toISOString().split("T")[0];

    const newsResults = await Promise.allSettled(
      tickers.map(async (symbol) => {
        const items = await finnhub(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
        return { symbol, items: Array.isArray(items) ? items.slice(0, 3) : [] };
      })
    );

    const seen = new Set<string>();
    const output: Array<{ ticker: string; headline: string; time: string; source: string }> = [];

    for (const r of newsResults) {
      if (r.status !== "fulfilled") continue;
      const { symbol, items } = r.value;
      for (const item of items) {
        const headline = (item.headline ?? "").slice(0, 120);
        if (!headline || seen.has(headline)) continue;
        seen.add(headline);
        const hoursAgo = Math.round((Date.now() - item.datetime * 1000) / 3_600_000);
        output.push({
          ticker: symbol,
          headline,
          time: hoursAgo < 1 ? "now" : hoursAgo < 24 ? `${hoursAgo}h ago` : "today",
          source: item.source ?? "News",
        });
      }
    }

    return output.slice(0, 12);
  });
}
