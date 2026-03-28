import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

const PRESET_SCREENS = [
  {
    label: "MAPO Watchlist",
    tickers: ["HIMS", "COHR", "SEZL", "OKTA", "HOOD", "RDDT", "APP", "PLTR", "CRWD", "NET"],
  },
  {
    label: "AI / AGI Thesis",
    tickers: ["NVDA", "MSFT", "META", "GOOGL", "AMZN", "TSM", "AMAT", "KLAC", "LRCX", "SMCI"],
  },
  {
    label: "High Growth",
    tickers: ["CELH", "AXON", "FICO", "DECK", "ONON", "CRDO", "MELI", "NU", "GLOB", "AEHR"],
  },
  {
    label: "MAPO Exclusions",
    tickers: ["BMNR", "UP", "MP", "CLSK", "NBIS", "AMD", "TE", "IREN", "IBIT"],
  },
];

function useScreenerQuotes(tickers: string[]) {
  return useQuery<Record<string, any>>({
    queryKey: ["/api/market/quotes", tickers.join(",")],
    queryFn: async () => {
      if (!tickers.length) return {};
      const res = await fetch(`/api/market/quotes?symbols=${tickers.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: tickers.length > 0,
    staleTime: 60_000,
  });
}

function mapoQuickScore(ticker: string, q: any): number {
  if (!q) return 0;
  const dp = q.dp ?? 0;
  const hi52 = q.h ?? 0;
  const lo52 = q.l ?? 0;
  const c = q.c ?? 0;

  // Simple heuristic scoring based on price action
  let score = 50;
  if (dp > 2) score += 10;
  else if (dp > 0) score += 5;
  else if (dp < -3) score -= 10;
  else if (dp < 0) score -= 5;

  // Not at 52-week high (MAPO entry rule: avoid buying at 52w high)
  if (hi52 > 0 && c / hi52 > 0.97) score -= 8;
  if (lo52 > 0 && c / hi52 < 0.5) score -= 5; // severely depressed

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(score: number) {
  if (score >= 65) return "#00C853";
  if (score >= 50) return "#FFB300";
  return "#FF4D4D";
}

function scoreLabel(score: number) {
  if (score >= 80) return "STRONG BUY";
  if (score >= 65) return "BUY";
  if (score >= 50) return "HOLD";
  return "AVOID";
}

export function ScreenerTab() {
  const [activePreset, setActivePreset] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [customTickers, setCustomTickers] = useState<string[]>([]);

  const displayTickers =
    customTickers.length > 0
      ? customTickers
      : PRESET_SCREENS[activePreset]?.tickers ?? [];

  const { data: quotes, isLoading } = useScreenerQuotes(displayTickers);

  function handleCustomSearch(e: React.FormEvent) {
    e.preventDefault();
    const tickers = customInput
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    setCustomTickers(tickers);
  }

  const rows = displayTickers.map((ticker) => {
    const q = quotes?.[ticker];
    const score = mapoQuickScore(ticker, q);
    const isExcluded = PRESET_SCREENS[3].tickers.includes(ticker);
    return { ticker, q, score, isExcluded };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1A2332",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Preset buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {PRESET_SCREENS.map((ps, i) => (
            <button
              key={ps.label}
              onClick={() => {
                setActivePreset(i);
                setCustomTickers([]);
                setCustomInput("");
              }}
              style={{
                padding: "4px 10px",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily: "monospace",
                background:
                  activePreset === i && customTickers.length === 0
                    ? "rgba(0,217,255,0.15)"
                    : "transparent",
                border:
                  activePreset === i && customTickers.length === 0
                    ? "1px solid #00D9FF"
                    : "1px solid #1A2332",
                borderRadius: 3,
                color:
                  activePreset === i && customTickers.length === 0 ? "#00D9FF" : "#8B949E",
                cursor: "pointer",
              }}
            >
              {ps.label}
            </button>
          ))}
        </div>

        {/* Custom search */}
        <form onSubmit={handleCustomSearch} style={{ display: "flex", gap: 6, flex: 1 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={11}
              color="#484F58"
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter tickers: AAPL, NVDA, TSLA..."
              style={{
                width: "100%",
                background: "#080C14",
                border: "1px solid #1A2332",
                borderRadius: 3,
                padding: "5px 10px 5px 26px",
                fontSize: 10,
                color: "#C9D1D9",
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00D9FF")}
              onBlur={(e) => (e.target.style.borderColor = "#1A2332")}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "5px 14px",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              background: "#00D9FF",
              border: "none",
              borderRadius: 3,
              color: "#080C14",
              fontFamily: "monospace",
              cursor: "pointer",
            }}
          >
            Screen
          </button>
        </form>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 100px 80px 80px 80px 80px 100px 1fr",
          padding: "6px 16px",
          borderBottom: "1px solid #1A2332",
          background: "#0D1117",
          flexShrink: 0,
        }}
      >
        {["TICKER", "PRICE", "CHG", "CHG %", "HIGH", "LOW", "SCORE", "SIGNAL"].map((h) => (
          <div
            key={h}
            style={{
              fontSize: 7,
              color: "#484F58",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              fontSize: 9,
              color: "#484F58",
              fontFamily: "monospace",
            }}
          >
            Fetching live quotes...
          </div>
        ) : (
          rows.map(({ ticker, q, score, isExcluded }) => {
            const price = q?.c ?? 0;
            const change = q?.d ?? 0;
            const changePct = q?.dp ?? 0;
            const high = q?.h ?? 0;
            const low = q?.l ?? 0;
            const isPos = change >= 0;
            const priceColor = isPos ? "#00C853" : "#FF4D4D";

            return (
              <div
                key={ticker}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 100px 80px 80px 80px 80px 100px 1fr",
                  padding: "8px 16px",
                  borderBottom: "1px solid #0D1117",
                  alignItems: "center",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(0,217,255,0.03)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isExcluded ? "#484F58" : "#C9D1D9",
                    fontFamily: "monospace",
                    textDecoration: isExcluded ? "line-through" : "none",
                  }}
                >
                  {ticker}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#E8EDF2",
                    fontFamily: "monospace",
                  }}
                >
                  {price > 0 ? `$${price.toFixed(2)}` : "—"}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: priceColor,
                    fontFamily: "monospace",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  {q ? (
                    <>
                      {isPos ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                      {isPos ? "+" : ""}{change.toFixed(2)}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: priceColor,
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                >
                  {q ? `${isPos ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
                </div>
                <div style={{ fontSize: 9, color: "#8B949E", fontFamily: "monospace" }}>
                  {high > 0 ? `$${high.toFixed(2)}` : "—"}
                </div>
                <div style={{ fontSize: 9, color: "#8B949E", fontFamily: "monospace" }}>
                  {low > 0 ? `$${low.toFixed(2)}` : "—"}
                </div>

                {/* MAPO Score */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `2px solid ${isExcluded ? "#2D3748" : scoreColor(score)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: isExcluded ? "#484F58" : scoreColor(score),
                      fontFamily: "monospace",
                    }}
                  >
                    {q ? score : "—"}
                  </div>
                </div>

                {/* Signal */}
                <div>
                  {isExcluded ? (
                    <span
                      style={{
                        fontSize: 7,
                        padding: "2px 6px",
                        background: "rgba(255,77,77,0.1)",
                        border: "1px solid rgba(255,77,77,0.25)",
                        borderRadius: 2,
                        color: "#FF4D4D",
                        fontFamily: "monospace",
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      EXCLUDED
                    </span>
                  ) : q ? (
                    <span
                      style={{
                        fontSize: 7,
                        padding: "2px 6px",
                        background: `${scoreColor(score)}18`,
                        border: `1px solid ${scoreColor(score)}40`,
                        borderRadius: 2,
                        color: scoreColor(score),
                        fontFamily: "monospace",
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      {scoreLabel(score)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 8, color: "#484F58" }}>No data</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      <div
        style={{
          padding: "6px 16px",
          borderTop: "1px solid #1A2332",
          fontSize: 7,
          color: "#2D3748",
          fontFamily: "monospace",
          flexShrink: 0,
        }}
      >
        * MAPO Score is a quick heuristic based on price action. Use AI Analyst for full 6-factor scoring.
        Excluded tickers per MAPO exclusion list: BMNR, UP, MP, CLSK, NBIS, AMD, TE, IREN, IBIT
      </div>
    </div>
  );
}
