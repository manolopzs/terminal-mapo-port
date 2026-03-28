import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1A2332" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace" }}>{symbol}</div>
            <div style={{ fontSize: 8, color: "#484F58", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
          </div>
          <div style={{ fontSize: 9, color: "#484F58" }}>—</div>
        </div>
      </div>
    );
  }

  const price = data.c ?? 0;
  const change = data.d ?? 0;
  const changePct = data.dp ?? 0;
  const isPos = change >= 0;
  const isNeutral = Math.abs(changePct) < 0.01;

  const color = isNeutral ? "#8B949E" : isPos ? "#00C853" : "#FF4D4D";

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid #1A2332",
        cursor: "default",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace" }}>{symbol}</div>
          <div style={{ fontSize: 8, color: "#484F58", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
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
        background: "#0D1117",
        borderBottom: "1px solid #1A2332",
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
            fontSize: 7,
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

export function MarketTab() {
  const allSymbols = [...INDICES, ...SECTORS, ...WATCHLIST].map((s) => s.symbol);
  const { data: quotes, isLoading } = useMarketData(allSymbols);

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
      <div style={{ borderRight: "1px solid #1A2332", overflowY: "auto" }}>
        <SectionHeader title="Major Indices" badge="LIVE" />
        {INDICES.map((idx) => (
          <QuoteCell
            key={idx.symbol}
            symbol={idx.symbol}
            label={idx.label}
            data={quotes?.[idx.symbol]}
          />
        ))}

        {/* Market status */}
        <div style={{ padding: "14px", borderTop: "2px solid #1A2332", marginTop: 4 }}>
          <div style={{ fontSize: 8, color: "#8B949E", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            Market Notes
          </div>
          <div style={{ fontSize: 9, color: "#484F58", lineHeight: 1.7 }}>
            • VIX &gt;20 = elevated volatility<br />
            • VIX &gt;30 = fear / opportunity zone<br />
            • TLT rising = risk-off rotation<br />
            • UUP rising = dollar strength headwind
          </div>
        </div>
      </div>

      {/* Col 2: Sector Performance */}
      <div style={{ borderRight: "1px solid #1A2332", overflowY: "auto" }}>
        <SectionHeader title="Sector ETFs" badge="S&P SECTORS" />
        {isLoading ? (
          <div style={{ padding: 20, fontSize: 9, color: "#484F58", fontFamily: "monospace" }}>
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
                    style={{ padding: "8px 14px", borderBottom: "1px solid #0D1117" }}
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
                        <span style={{ fontSize: 8, color: "#484F58", marginLeft: 6 }}>{sec.label}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isPos ? "#00C853" : "#FF4D4D",
                          fontFamily: "monospace",
                        }}
                      >
                        {isPos ? "+" : ""}{pct.toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ height: 3, background: "#1A2332", borderRadius: 2 }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${barWidth}%`,
                          background: isPos ? "#00C853" : "#FF4D4D",
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

      {/* Col 3: Mega Cap Watchlist */}
      <div style={{ overflowY: "auto" }}>
        <SectionHeader title="Mega Cap Watch" badge="LIVE" />
        {WATCHLIST.map((w) => (
          <QuoteCell
            key={w.symbol}
            symbol={w.symbol}
            label={w.label}
            data={quotes?.[w.symbol]}
          />
        ))}

        {/* MAPO macro notes */}
        <div
          style={{
            margin: 14,
            padding: 12,
            background: "#0D1117",
            border: "1px solid #1A2332",
            borderRadius: 3,
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: "#00D9FF",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 8,
              fontFamily: "monospace",
            }}
          >
            MAPO Macro Checklist
          </div>
          <div style={{ fontSize: 8, color: "#8B949E", lineHeight: 1.8, fontFamily: "monospace" }}>
            □ VIX environment (below/above 20)<br />
            □ Fed policy direction<br />
            □ 10Y yield trend<br />
            □ Dollar strength<br />
            □ Earnings season phase<br />
            □ Sector rotation signal<br />
            □ AGI thesis intact (NVDA/MSFT/META)
          </div>
        </div>
      </div>
    </div>
  );
}
