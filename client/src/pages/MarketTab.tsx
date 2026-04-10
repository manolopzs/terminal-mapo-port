import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity } from "lucide-react";

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

interface MacroEvent {
  date: string;
  type: "FOMC" | "CPI" | "GDP" | "EARNINGS";
  label: string;
  impact: "HIGH" | "MEDIUM";
  daysUntil: number;
}

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

function useMarketPulse() {
  return useQuery<MarketPulseData>({
    queryKey: ["/api/market/pulse"],
    queryFn: async () => {
      const res = await fetch("/api/market/pulse");
      if (!res.ok) throw new Error("Failed to fetch pulse");
      return res.json();
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}

function useMacroCalendar() {
  return useQuery<MacroEvent[]>({
    queryKey: ["/api/macro/calendar"],
    queryFn: async () => {
      const res = await fetch("/api/macro/calendar");
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
    staleTime: 3_600_000,
    refetchInterval: 3_600_000,
  });
}

function QuoteCell({ data, label, symbol }: { data: any; label: string; symbol: string }) {
  if (!data) {
    return (
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1C2840" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace" }}>{symbol}</div>
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

  const color = isNeutral ? "#8B949E" : isPos ? "var(--color-green)" : "var(--color-red)";

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid #1C2840",
        cursor: "default",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,168,83,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace" }}>{symbol}</div>
          <div style={{ fontSize: 10, color: "#4A5A6E", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF2", fontFamily: "'JetBrains Mono', monospace" }}>
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
            <span style={{ fontSize: 9, color, fontFamily: "'JetBrains Mono', monospace" }}>
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
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {title}
      </span>
      {badge && (
        <span
          style={{
            fontSize: 10,
            color: "var(--color-primary)",
            background: "var(--color-primary-a10)",
            border: "1px solid var(--color-primary-a20)",
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

function getSentimentColor(score: number): string {
  if (score >= 75) return "var(--color-green)";
  if (score >= 55) return "var(--color-green)";
  if (score >= 45) return "#8B949E";
  if (score >= 25) return "var(--color-orange)";
  return "var(--color-red)";
}

function getVixRegimeColor(vix: number): string {
  if (vix >= 30) return "var(--color-red)";
  if (vix >= 20) return "var(--color-orange)";
  if (vix <= 15) return "var(--color-green)";
  return "var(--color-green)";
}

function SignalDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        animation: pulse ? "pulse-dot 1.5s ease-in-out infinite" : "none",
        boxShadow: pulse ? `0 0 6px ${color}` : "none",
      }}
    />
  );
}

function MarketPulseSection({ pulse }: { pulse: MarketPulseData }) {
  const { sentiment, context } = pulse;
  const sentimentColor = getSentimentColor(sentiment.score);

  return (
    <div
      style={{
        padding: "12px 14px",
        borderBottom: "2px solid #1C2840",
        background: "rgba(28,40,64,0.15)",
        animation: "market-pulse-fade-in 0.6s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Activity size={10} color="var(--color-primary)" />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace" }}>
          MARKET PULSE
        </span>
      </div>

      {/* Sentiment Gauge */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "#4A5A6E", fontFamily: "'JetBrains Mono', monospace" }}>SENTIMENT</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: sentimentColor, fontFamily: "'JetBrains Mono', monospace" }}>
            {sentiment.score} — {sentiment.label}
          </span>
        </div>
        {/* Sentiment bar */}
        <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 1 }}>
          <div style={{ width: `${sentiment.bearPct}%`, background: "var(--color-red)", borderRadius: "2px 0 0 2px", transition: "width 0.5s" }} />
          <div style={{ width: `${sentiment.neutPct}%`, background: "#4A5A6E", transition: "width 0.5s" }} />
          <div style={{ width: `${sentiment.bullPct}%`, background: "var(--color-green)", borderRadius: "0 2px 2px 0", transition: "width 0.5s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 8, color: "var(--color-red)", fontFamily: "'JetBrains Mono', monospace" }}>BEAR {sentiment.bearPct}%</span>
          <span style={{ fontSize: 8, color: "var(--color-green)", fontFamily: "'JetBrains Mono', monospace" }}>BULL {sentiment.bullPct}%</span>
        </div>
      </div>

      {/* Context */}
      {context && (
        <div style={{ fontSize: 9, color: "#8B949E", fontFamily: "'JetBrains Mono', monospace", fontStyle: "italic", lineHeight: 1.5 }}>
          {context}
        </div>
      )}
    </div>
  );
}

function MacroCalendarSection({ events }: { events: MacroEvent[] }) {
  if (!events || events.length === 0) return null;

  // Show only next 5 events
  const upcoming = events.slice(0, 5);

  const typeColors: Record<string, string> = {
    FOMC: "var(--color-red)",
    CPI: "var(--color-orange)",
    GDP: "var(--color-primary)",
    EARNINGS: "var(--color-green)",
  };

  return (
    <div style={{ padding: "12px 14px", borderTop: "1px solid #1C2840" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
        MACRO CALENDAR
      </div>
      {upcoming.map((e, i) => {
        const color = typeColors[e.type] || "#8B949E";
        const isImminent = e.daysUntil <= 3;
        return (
          <div
            key={`${e.date}-${e.type}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 4px",
              marginLeft: -4,
              marginRight: -4,
              borderBottom: i < upcoming.length - 1 ? "1px solid #0F1520" : "none",
              borderRadius: 3,
              cursor: "default",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,168,83,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <SignalDot color={color} pulse={isImminent} />
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color,
              fontFamily: "'JetBrains Mono', monospace",
              minWidth: 36,
            }}>
              {e.type}
            </span>
            <span style={{ fontSize: 9, color: "#8B949E", fontFamily: "'JetBrains Mono', monospace", flex: 1 }}>
              {e.label}
            </span>
            <span style={{
              fontSize: 9,
              color: isImminent ? color : "#4A5A6E",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: isImminent ? 700 : 400,
            }}>
              {e.daysUntil === 0 ? "TODAY" : e.daysUntil === 1 ? "TOMORROW" : `${e.daysUntil}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MarketTab({ portfolioHoldings }: { portfolioHoldings?: Array<{ ticker: string; name: string; gainLossPct: number; dayChangePct: number }> }) {
  // Build symbol list from indices + sectors + holdings (no hardcoded watchlist)
  const holdingSymbols = (portfolioHoldings ?? []).map(h => h.ticker);
  const allSymbols = Array.from(new Set([...INDICES.map(s => s.symbol), ...SECTORS.map(s => s.symbol), ...holdingSymbols]));
  const { data: quotes, isLoading, dataUpdatedAt, refetch, isFetching } = useMarketData(allSymbols);

  const { data: pulse } = useMarketPulse();
  const { data: macroEvents } = useMacroCalendar();

  const vix = quotes?.["VIX"]?.c ?? 0;
  const tltChange = quotes?.["TLT"]?.dp ?? 0;
  const uupChange = quotes?.["UUP"]?.dp ?? 0;

  const vixColor = getVixRegimeColor(vix);
  const vixPulse = vix > 30 || (vix > 0 && vix < 15);
  const vixNote =
    vix === 0 ? "loading"
    : vix > 30 ? `${vix.toFixed(1)} — fear / opportunity`
    : vix > 20 ? `${vix.toFixed(1)} — elevated vol`
    : `${vix.toFixed(1)} — calm`;

  const tltColor = tltChange > 0.5 ? "var(--color-orange)" : tltChange < -0.5 ? "var(--color-green)" : "#8B949E";
  const tltNote =
    tltChange > 0.5 ? `+${tltChange.toFixed(2)}% risk-off`
    : tltChange < -0.5 ? `${tltChange.toFixed(2)}% risk-on`
    : `${tltChange >= 0 ? "+" : ""}${tltChange.toFixed(2)}% neutral`;

  const uupColor = uupChange > 0.3 ? "var(--color-red)" : uupChange < -0.3 ? "var(--color-green)" : "#8B949E";
  const uupNote =
    uupChange > 0.3 ? `+${uupChange.toFixed(2)}% $ strong`
    : uupChange < -0.3 ? `${uupChange.toFixed(2)}% $ weak`
    : `${uupChange >= 0 ? "+" : ""}${uupChange.toFixed(2)}% neutral`;

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
        background: "#080C14",
      }}
    >
      {/* Col 1: Market Pulse + Major Indices */}
      <div style={{ borderRight: "1px solid #1C2840", overflowY: "auto" }}>
        {/* Market Pulse from API */}
        {pulse && <MarketPulseSection pulse={pulse} />}

        <SectionHeader title="Major Indices" badge="LIVE" />
        {INDICES.map((idx) => (
          <QuoteCell
            key={idx.symbol}
            symbol={idx.symbol}
            label={idx.label}
            data={quotes?.[idx.symbol]}
          />
        ))}

        {/* Market Signals — improved with color coding and dots */}
        <div style={{ padding: "14px", borderTop: "2px solid #1C2840", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#8B949E", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Market Signals
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: "#2E3E52", fontFamily: "'JetBrains Mono', monospace" }}>
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
          <div style={{ fontSize: 9, color: "#8B949E", lineHeight: 2.2, fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A5A6E" }}>
                <SignalDot color={vixColor} pulse={vixPulse} />
                VIX
              </span>
              <span style={{ color: vixColor }}>{vixNote}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A5A6E" }}>
                <SignalDot color={tltColor} />
                TLT
              </span>
              <span style={{ color: tltColor }}>{tltNote}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#4A5A6E" }}>
                <SignalDot color={uupColor} />
                UUP
              </span>
              <span style={{ color: uupColor }}>{uupNote}</span>
            </div>
          </div>
        </div>

        {/* Macro Calendar */}
        {macroEvents && macroEvents.length > 0 && <MacroCalendarSection events={macroEvents} />}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.4); }
          }
          @keyframes market-pulse-fade-in {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {/* Col 2: Sector Performance */}
      <div style={{ borderRight: "1px solid #1C2840", overflowY: "auto" }}>
        <SectionHeader title="Sector ETFs" badge="S&P SECTORS" />
        {isLoading ? (
          <div style={{ padding: 20, fontSize: 9, color: "#4A5A6E", fontFamily: "'JetBrains Mono', monospace" }}>
            Loading sector data...
          </div>
        ) : (
          <>
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
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,168,83,0.03)")}
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
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace" }}>
                          {sec.symbol}
                        </span>
                        <span style={{ fontSize: 10, color: "#4A5A6E", marginLeft: 6 }}>{sec.label}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isPos ? "var(--color-green)" : "var(--color-red)",
                          fontFamily: "'JetBrains Mono', monospace",
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
                          background: isPos ? "var(--color-green)" : "var(--color-red)",
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

      {/* Col 3: Your Holdings (from portfolio) */}
      <div style={{ overflowY: "auto" }}>
        <SectionHeader title="Your Holdings" badge="PORTFOLIO" />
        {portfolioHoldings && portfolioHoldings.length > 0 ? (
          portfolioHoldings.map((h) => {
            const pct = h.dayChangePct ?? 0;
            const pnlPct = h.gainLossPct ?? 0;
            const isPos = pct >= 0;
            const color = Math.abs(pct) < 0.01 ? "#8B949E" : isPos ? "var(--color-green)" : "var(--color-red)";
            return (
              <div
                key={h.ticker}
                style={{
                  padding: "9px 14px",
                  borderBottom: "1px solid #1C2840",
                  cursor: "default",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,168,83,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{h.ticker}</div>
                    <div style={{ fontSize: 10, color: "#4A5A6E" }}>{h.name.length > 18 ? h.name.slice(0, 18) + "\u2026" : h.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {isPos ? "+" : ""}{pct.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 9, color: pnlPct >= 0 ? "var(--color-green)" : "var(--color-red)", fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
                      P&L {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: "20px 14px", fontSize: 9, color: "#4A5A6E", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
            No holdings yet — add positions to see them here
          </div>
        )}
      </div>
    </div>
  );
}
