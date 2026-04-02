import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

const INDICES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "NASDAQ 100" },
  { symbol: "DIA", label: "DOW JONES" },
  { symbol: "IWM", label: "RUSSELL 2000" },
  { symbol: "VIX", label: "VIX" },
  { symbol: "GLD", label: "GOLD" },
  { symbol: "TLT", label: "BONDS 20Y" },
  { symbol: "UUP", label: "US DOLLAR" },
];

const SECTORS = [
  { symbol: "XLK", label: "Technology" },
  { symbol: "XLF", label: "Financials" },
  { symbol: "XLE", label: "Energy" },
  { symbol: "XLV", label: "Health Care" },
  { symbol: "XLY", label: "Cons. Disc." },
  { symbol: "XLI", label: "Industrials" },
  { symbol: "XLC", label: "Comm. Svcs" },
  { symbol: "XLP", label: "Cons. Staples" },
  { symbol: "XLRE", label: "Real Estate" },
  { symbol: "XLB", label: "Materials" },
  { symbol: "XLU", label: "Utilities" },
];

const WATCHLIST = [
  { symbol: "NVDA", label: "Nvidia" },
  { symbol: "AAPL", label: "Apple" },
  { symbol: "MSFT", label: "Microsoft" },
  { symbol: "TSLA", label: "Tesla" },
  { symbol: "META", label: "Meta" },
  { symbol: "AMZN", label: "Amazon" },
  { symbol: "GOOGL", label: "Alphabet" },
  { symbol: "JPM", label: "JPMorgan" },
];

function useMarketData(symbols: string[]) {
  return useQuery<Record<string, any>>({
    queryKey: ["/api/market/quotes", symbols.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/market/quotes?symbols=${symbols.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

function QuoteCell({ data, label, symbol }: { data: any; label: string; symbol: string }) {
  if (!data) {
    return (
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1C2840" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace" }}>{symbol}</div>
            <div style={{ fontSize: 10, color: "#4A5A6E", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
          </div>
          <div style={{ fontSize: 9, color: "#4A5A6E" }}>—</div>
        </div>
      </div>
    );
  }

  const price = data.c ?? 0;
  const change = data.d ?? 0;
  const changePct = data.dp ?? 0;
  const isPos = change >= 0;
  const isNeutral = Math.abs(changePct) < 0.01;

  const color = isNeutral ? "#8B949E" : isPos ? "#00E6A8" : "#FF4458";

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid #1C2840",
        cursor: "default",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace" }}>{symbol}</div>
          <div style={{ fontSize: 10, color: "#4A5A6E", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF2", fontFamily: "monospace" }}>
            {price > 0 ? `$${price.toFixed(2)}` : "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
            {isNeutral ? (
              <Minus size={8} color={color} />
            ) : isPos ? (
              <TrendingUp size={8} color={color} />
            ) : (
              <TrendingDown size={8} color={color} />
            )}
            <span style={{ fontSize: 9, color, fontFamily: "monospace" }}>
              {isPos ? "+" : ""}{changePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div
      style={{
        padding: "8px 14px",
        background: "#0B0F1A",
        borderBottom: "1px solid #1C2840",
        display: "flex",
        alignItems: "center",
        gap: 8,
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#C9D1D9",
          fontFamily: "monospace",
        }}
      >
        {title}
      </span>
      {badge && (
        <span
          style={{
            fontSize: 10,
            color: "#00D9FF",
            background: "rgba(0,217,255,0.1)",
            border: "1px solid rgba(0,217,255,0.2)",
            borderRadius: 2,
            padding: "1px 5px",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export function MarketTab({ portfolioHoldings }: { portfolioHoldings?: Array<{ ticker: string; name: string; gainLossPct: number; dayChangePct: number }> }) {
  const allSymbols = [...INDICES, ...SECTORS, ...WATCHLIST].map((s) => s.symbol);
  const { data: quotes, isLoading, dataUpdatedAt, refetch, isFetching } = useMarketData(allSymbols);

  const vix = quotes?.["VIX"]?.c ?? 0;
  const tltChange = quotes?.["TLT"]?.dp ?? 0;
  const uupChange = quotes?.["UUP"]?.dp ?? 0;

  const vixNote =
    vix === 0 ? "— loading"
    : vix > 30 ? `${vix.toFixed(1)} — fear / opportunity zone`
    : vix > 20 ? `${vix.toFixed(1)} — elevated volatility`
    : `${vix.toFixed(1)} — calm / low volatility`;

  const tltNote =
    tltChange > 0.5 ? `+${tltChange.toFixed(2)}% — risk-off rotation`
    : tltChange < -0.5 ? `${tltChange.toFixed(2)}% — risk-on (bonds selling)`
    : `${tltChange >= 0 ? "+" : ""}${tltChange.toFixed(2)}% — neutral`;

  const uupNote =
    uupChange > 0.3 ? `+${uupChange.toFixed(2)}% — dollar strength headwind`
    : uupChange < -0.3 ? `${uupChange.toFixed(2)}% — weak dollar (EM/growth tailwind)`
    : `${uupChange >= 0 ? "+" : ""}${uupChange.toFixed(2)}% — neutral`;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Col 1: Major Indices */}
      <div style={{ borderRight: "1px solid #1C2840", overflowY: "auto" }}>
        <SectionHeader title="Major Indices" badge="LIVE" />
        {INDICES.map((idx) => (
          <QuoteCell
            key={idx.symbol}
            symbol={idx.symbol}
            label={idx.label}
            data={quotes?.[idx.symbol]}
          />
        ))}

        {/* Market Notes — dynamic */}
        <div style={{ padding: "14px", borderTop: "2px solid #1C2840", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#8B949E", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Market Signals
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: "#2E3E52", fontFamily: "monospace" }}>
                  {lastUpdated}
                </span>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                style={{ background: "none", border: "none", cursor: isFetching ? "default" : "pointer", padding: 2, color: isFetching ? "#2E3E52" : "#4A5A6E" }}
              >
                <RefreshCw size={9} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#8B949E", lineHeight: 2, fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#4A5A6E" }}>VIX</span>
              <span style={{ color: vix > 30 ? "#FF4458" : vix > 20 ? "#F0883E" : "#00E6A8" }}>{vixNote}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#4A5A6E" }}>TLT</span>
              <span style={{ color: tltChange > 0.5 ? "#F0883E" : tltChange < -0.5 ? "#00E6A8" : "#8B949E" }}>{tltNote}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#4A5A6E" }}>UUP</span>
              <span style={{ color: uupChange > 0.3 ? "#FF4458" : uupChange < -0.3 ? "#00E6A8" : "#8B949E" }}>{uupNote}</span>
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Col 2: Sector Performance */}
      <div style={{ borderRight: "1px solid #1C2840", overflowY: "auto" }}>
        <SectionHeader title="Sector ETFs" badge="S&P SECTORS" />
        {isLoading ? (
          <div style={{ padding: 20, fontSize: 9, color: "#4A5A6E", fontFamily: "monospace" }}>
            Loading sector data...
          </div>
        ) : (
          <>
            {/* Sort sectors by % change */}
            {[...SECTORS]
              .sort((a, b) => {
                const dp_a = quotes?.[a.symbol]?.dp ?? 0;
                const dp_b = quotes?.[b.symbol]?.dp ?? 0;
                return dp_b - dp_a;
              })
              .map((sec) => {
                const q = quotes?.[sec.symbol];
                const pct = q?.dp ?? 0;
                const barWidth = Math.min(Math.abs(pct) * 10, 100);
                const isPos = pct >= 0;
                return (
                  <div
                    key={sec.symbol}
                    style={{ padding: "8px 14px", borderBottom: "1px solid #0B0F1A" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace" }}>
                          {sec.symbol}
                        </span>
                        <span style={{ fontSize: 10, color: "#4A5A6E", marginLeft: 6 }}>{sec.label}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isPos ? "#00E6A8" : "#FF4458",
                          fontFamily: "monospace",
                        }}
                      >
                        {isPos ? "+" : ""}{pct.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ height: 3, background: "#1C2840", borderRadius: 2 }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${barWidth}%`,
                          background: isPos ? "#00E6A8" : "#FF4458",
                          borderRadius: 2,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>

      {/* Col 3: Portfolio Holdings + Mega Cap Watchlist */}
      <div style={{ overflowY: "auto" }}>
        {portfolioHoldings && portfolioHoldings.length > 0 && (
          <>
            <SectionHeader title="Your Holdings" badge="PORTFOLIO" />
            {portfolioHoldings.map((h) => {
              const pct = h.dayChangePct ?? 0;
              const pnlPct = h.gainLossPct ?? 0;
              const isPos = pct >= 0;
              const color = Math.abs(pct) < 0.01 ? "#8B949E" : isPos ? "#00E6A8" : "#FF4458";
              return (
                <div
                  key={h.ticker}
                  style={{
                    padding: "9px 14px",
                    borderBottom: "1px solid #1C2840",
                    cursor: "default",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#00D9FF", fontFamily: "monospace" }}>{h.ticker}</div>
                      <div style={{ fontSize: 10, color: "#4A5A6E" }}>{h.name.length > 18 ? h.name.slice(0, 18) + "…" : h.name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "monospace" }}>
                        {isPos ? "+" : ""}{pct.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: 9, color: pnlPct >= 0 ? "#00E6A8" : "#FF4458", fontFamily: "monospace", opacity: 0.7 }}>
                        P&L {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <SectionHeader title="Mega Cap Watch" badge="LIVE" />
        {WATCHLIST.map((w) => (
          <QuoteCell
            key={w.symbol}
            symbol={w.symbol}
            label={w.label}
            data={quotes?.[w.symbol]}
          />
        ))}

      </div>
    </div>
  );
}
