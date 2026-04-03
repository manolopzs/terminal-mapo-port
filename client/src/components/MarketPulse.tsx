import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface MarketPulseData {
  indices: Array<{ symbol: string; label: string; price: number; changePct: number }>;
  sentiment: {
    score: number;
    label: string;
    bullPct: number;
    bearPct: number;
    neutPct: number;
  };
  context: string;
  marketStatus: string;
}

const SENTIMENT_COLOR: Record<string, string> = {
  "Extreme Greed": "var(--color-green)",
  "Greed": "#6EC97A",
  "Neutral": "var(--color-primary)",
  "Fear": "var(--color-orange)",
  "Extreme Fear": "var(--color-red)",
};

const INDEX_META: Record<string, { short: string; muted?: boolean }> = {
  SPY: { short: "S&P" },
  QQQ: { short: "NDX" },
  IWM: { short: "RUT" },
  VIX: { short: "VIX", muted: true },
  GLD: { short: "GLD" },
  TLT: { short: "BOND" },
};

export function MarketPulse() {
  const { data, isLoading } = useQuery<MarketPulseData>({
    queryKey: ["/api/market/pulse"],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="terminal-panel" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Market Pulse</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {data?.marketStatus && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              color: data.marketStatus === "open" ? "var(--color-green)" : "#4A5A6E",
            }}>
              {data.marketStatus === "open" ? "● OPEN" : "● CLOSED"}
            </span>
          )}
          <span className="terminal-badge">LIVE</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Index grid — 3 cols × 2 rows */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, flexShrink: 0 }}>
          {(data?.indices ?? PLACEHOLDER_INDICES).map((idx) => {
            const meta = INDEX_META[idx.symbol] ?? { short: idx.symbol };
            const isVix = idx.symbol === "VIX";
            // VIX: green = down, red = up (inverse)
            const pct = idx.changePct;
            const color = isLoading ? "#2A3A4C"
              : isVix
                ? (pct > 0 ? "var(--color-red)" : pct < 0 ? "var(--color-green)" : "#6A7A8E")
                : (pct > 0 ? "var(--color-green)" : pct < 0 ? "var(--color-red)" : "#6A7A8E");

            return (
              <div key={idx.symbol} style={{
                padding: "6px 8px",
                background: "#080C14",
                border: "1px solid #1C2840",
                borderRadius: 3,
              }}>
                <div style={{ fontSize: 7, color: "#3A4A5C", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
                  {meta.short}
                </div>
                <div className="font-mono tabular-nums" style={{
                  fontSize: 13, fontWeight: 700,
                  color: isLoading ? "#2A3A4C" : "#C9D1D9",
                  lineHeight: 1.1,
                }}>
                  {isLoading ? "—" : idx.price > 0 ? (isVix ? idx.price.toFixed(2) : idx.price >= 100 ? idx.price.toFixed(0) : idx.price.toFixed(2)) : "—"}
                </div>
                <div className="font-mono tabular-nums" style={{ fontSize: 9, color, marginTop: 2, fontWeight: 600 }}>
                  {isLoading ? "" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sentiment section */}
        <div style={{
          background: "#080C14",
          border: "1px solid #1C2840",
          borderRadius: 3,
          padding: "8px 10px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 7, color: "#3A4A5C", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Retail Sentiment
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                color: data ? SENTIMENT_COLOR[data.sentiment.label] ?? "var(--color-primary)" : "#2A3A4C",
              }}>
                {data?.sentiment.label ?? "—"}
              </span>
              {data && (
                <span className="font-mono tabular-nums" style={{ fontSize: 8, color: "#4A5A6E" }}>
                  {data.sentiment.score}/100
                </span>
              )}
            </div>
          </div>

          {/* Bull / Neut / Bear segmented bar */}
          <div style={{ height: 6, borderRadius: 3, overflow: "hidden", display: "flex", gap: 1 }}>
            <div style={{
              flex: data?.sentiment.bullPct ?? 38,
              background: "var(--color-green)",
              opacity: isLoading ? 0.15 : 0.85,
              transition: "flex 0.6s ease",
            }} />
            <div style={{
              flex: data?.sentiment.neutPct ?? 24,
              background: "var(--color-primary)",
              opacity: isLoading ? 0.15 : 0.6,
              transition: "flex 0.6s ease",
            }} />
            <div style={{
              flex: data?.sentiment.bearPct ?? 38,
              background: "var(--color-red)",
              opacity: isLoading ? 0.15 : 0.85,
              transition: "flex 0.6s ease",
            }} />
          </div>

          {/* Labels under bar */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: 1, background: "var(--color-green)", opacity: 0.8 }} />
              <span style={{ fontSize: 7, color: "#4A5A6E" }}>
                Bull {data ? `${data.sentiment.bullPct}%` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: 1, background: "var(--color-primary)", opacity: 0.7 }} />
              <span style={{ fontSize: 7, color: "#4A5A6E" }}>
                Neut {data ? `${data.sentiment.neutPct}%` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: 1, background: "var(--color-red)", opacity: 0.8 }} />
              <span style={{ fontSize: 7, color: "#4A5A6E" }}>
                Bear {data ? `${data.sentiment.bearPct}%` : "—"}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const PLACEHOLDER_INDICES = [
  { symbol: "SPY", label: "S&P 500", price: 0, changePct: 0 },
  { symbol: "QQQ", label: "NASDAQ", price: 0, changePct: 0 },
  { symbol: "IWM", label: "Russell 2K", price: 0, changePct: 0 },
  { symbol: "VIX", label: "VIX", price: 0, changePct: 0 },
  { symbol: "GLD", label: "Gold", price: 0, changePct: 0 },
  { symbol: "TLT", label: "20Y Bond", price: 0, changePct: 0 },
];
