import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface LiveQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketStatus: string;
}

interface QuotesResponse {
  quotes: LiveQuote[];
  updatedAt: string;
}

const FALLBACK_TICKERS = [
  { symbol: "SPY", price: "527.35", change: 0.42 },
  { symbol: "QQQ", price: "441.20", change: 0.65 },
  { symbol: "DIA", price: "390.15", change: -0.12 },
  { symbol: "IWM", price: "201.45", change: 0.38 },
  { symbol: "VOO", price: "527.00", change: 0.35 },
  { symbol: "VIX", price: "18.52", change: -3.2 },
  { symbol: "GLD", price: "215.80", change: 0.15 },
  { symbol: "TLT", price: "92.30", change: -0.45 },
];

const MARKET_SYMBOLS = ["SPY", "QQQ", "DIA", "IWM", "VOO", "VIX", "GLD", "TLT"];

export function TickerTape() {
  const { data } = useQuery<QuotesResponse>({
    queryKey: ["/api/live/quotes"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000, // Auto-refresh every minute
  });

  const marketQuotes = data?.quotes?.filter(q => MARKET_SYMBOLS.includes(q.symbol)) ?? [];

  // Build ticker items: use live data if available, fallback otherwise
  const items = MARKET_SYMBOLS.map(sym => {
    const live = marketQuotes.find(q => q.symbol === sym);
    if (live) {
      return {
        symbol: live.symbol,
        price: live.price >= 1000 ? live.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : live.price.toFixed(2),
        change: live.changesPercentage,
      };
    }
    const fb = FALLBACK_TICKERS.find(f => f.symbol === sym);
    return fb ?? { symbol: sym, price: "—", change: 0 };
  });

  // Also add any holding-specific quotes that aren't market tickers
  const holdingQuotes = data?.quotes?.filter(q => !MARKET_SYMBOLS.includes(q.symbol)).slice(0, 10) ?? [];
  for (const hq of holdingQuotes) {
    items.push({
      symbol: hq.symbol,
      price: hq.price.toFixed(2),
      change: hq.changesPercentage,
    });
  }

  const doubled = [...items, ...items];

  return (
    <div
      className="flex items-center overflow-hidden flex-shrink-0"
      style={{
        height: 30,
        minHeight: 30,
        background: "#060A12",
        borderBottom: "1px solid #1C2840",
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          background: "var(--color-primary-a08)",
          color: "var(--color-primary)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          padding: "0 10px",
          height: "100%",
          borderRight: "1px solid #1C2840",
          zIndex: 1,
          textTransform: "uppercase",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        MKT
      </div>
      <div className="overflow-hidden flex-1">
        <div className="animate-ticker flex items-center whitespace-nowrap">
          {doubled.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1" style={{ fontSize: 10, padding: "0 10px", borderRight: "1px solid rgba(28,40,64,0.6)" }}>
              <span style={{ color: "#5A6B80", fontWeight: 700, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {t.symbol}
              </span>
              <span className="font-mono tabular-nums" style={{ color: "#A0AABB", fontSize: 11 }}>
                {t.price}
              </span>
              <span
                className="font-mono tabular-nums"
                style={{ color: t.change >= 0 ? "var(--color-green)" : "var(--color-red)", fontWeight: 600, fontSize: 11 }}
              >
                {t.change >= 0 ? "+" : ""}
                {t.change.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
