import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from "lucide-react";

type SortKey = "ticker" | "price" | "change" | "changePct" | "high" | "low" | "score";
type SortDir = "asc" | "desc";

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
  if (score >= 65) return "#00E6A8";
  if (score >= 50) return "#F0883E";
  return "#FF4458";
}

function scoreCircleClass(score: number) {
  if (score >= 65) return "score-circle-green";
  if (score >= 50) return "score-circle-yellow";
  return "score-circle-red";
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
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rawRows = displayTickers.map((ticker) => {
    const q = quotes?.[ticker];
    const score = mapoQuickScore(ticker, q);
    const isExcluded = PRESET_SCREENS[3].tickers.includes(ticker);
    return { ticker, q, score, isExcluded };
  });

  const rows = [...rawRows].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;
    switch (sortKey) {
      case "ticker": aVal = a.ticker; bVal = b.ticker; break;
      case "price": aVal = a.q?.c ?? 0; bVal = b.q?.c ?? 0; break;
      case "change": aVal = a.q?.d ?? 0; bVal = b.q?.d ?? 0; break;
      case "changePct": aVal = a.q?.dp ?? 0; bVal = b.q?.dp ?? 0; break;
      case "high": aVal = a.q?.h ?? 0; bVal = b.q?.h ?? 0; break;
      case "low": aVal = a.q?.l ?? 0; bVal = b.q?.l ?? 0; break;
      case "score": aVal = a.score; bVal = b.score; break;
    }
    if (typeof aVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    }
    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1C2840",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          background: "#080C14",
        }}
      >
        {/* Preset buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {PRESET_SCREENS.map((ps, i) => {
            const isActive = activePreset === i && customTickers.length === 0;
            return (
              <button
                key={ps.label}
                onClick={() => {
                  setActivePreset(i);
                  setCustomTickers([]);
                  setCustomInput("");
                }}
                style={{
                  padding: "4px 11px",
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  background: isActive ? "rgba(0,217,255,0.1)" : "#0B0F1A",
                  border: isActive ? "1px solid rgba(0,217,255,0.35)" : "1px solid #1C2840",
                  borderRadius: 3,
                  color: isActive ? "#00D9FF" : "#5A6B80",
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "#8B9AAB"; e.currentTarget.style.borderColor = "#2A3A54"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "#5A6B80"; e.currentTarget.style.borderColor = "#1C2840"; } }}
              >
                {ps.label}
              </button>
            );
          })}
        </div>

        {/* Custom search */}
        <form onSubmit={handleCustomSearch} style={{ display: "flex", gap: 6, flex: 1 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={11}
              color="#4A5A6E"
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter tickers: AAPL, NVDA, TSLA..."
              style={{
                width: "100%",
                background: "#0B0F1A",
                border: "1px solid #1C2840",
                borderRadius: 3,
                padding: "5px 10px 5px 26px",
                fontSize: 10,
                color: "#C9D1D9",
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(0,217,255,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "#1C2840")}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "5px 14px",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              background: "rgba(0,217,255,0.12)",
              border: "1px solid rgba(0,217,255,0.3)",
              borderRadius: 3,
              color: "#00D9FF",
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.12)")}
          >
            Screen
          </button>
        </form>
        {/* Row count */}
        <div style={{ fontSize: 8, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", flexShrink: 0, letterSpacing: 1.2 }}>
          {rows.length} ticker{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px 100px 80px 80px 80px 80px 100px 1fr",
          padding: "6px 16px",
          borderBottom: "1px solid #1C2840",
          background: "#0B0F1A",
          flexShrink: 0,
        }}
      >
        {(
          [
            { label: "TICKER", key: "ticker" as SortKey },
            { label: "PRICE", key: "price" as SortKey },
            { label: "CHG", key: "change" as SortKey },
            { label: "CHG %", key: "changePct" as SortKey },
            { label: "HIGH", key: "high" as SortKey },
            { label: "LOW", key: "low" as SortKey },
            { label: "SCORE", key: "score" as SortKey },
            { label: "SIGNAL", key: null },
          ] as { label: string; key: SortKey | null }[]
        ).map(({ label, key }) => (
          <div
            key={label}
            onClick={() => key && handleSort(key)}
            style={{
              fontSize: 7,
              color: sortKey === key ? "#00D9FF" : "#4A5A6E",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: key ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              gap: 3,
              userSelect: "none",
              transition: "color 0.12s",
            }}
          >
            {label}
            {key && sortKey === key && (
              sortDir === "desc" ? <ChevronDown size={8} /> : <ChevronUp size={8} />
            )}
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              fontSize: 9,
              color: "#3A4A5C",
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: 1.5,
              textTransform: "uppercase",
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
            const priceColor = isPos ? "#00E6A8" : "#FF4458";

            return (
              <div
                key={ticker}
                className="terminal-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 100px 80px 80px 80px 80px 100px 1fr",
                  padding: "8px 16px",
                  borderBottom: "1px solid rgba(28,40,64,0.5)",
                  alignItems: "center",
                  cursor: "default",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isExcluded ? "#3A4A5C" : "#C9D1D9",
                    fontFamily: "'JetBrains Mono', monospace",
                    textDecoration: isExcluded ? "line-through" : "none",
                    letterSpacing: 0.5,
                  }}
                >
                  {ticker}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isExcluded ? "#3A4A5C" : "#E8EDF2",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {price > 0 ? `$${price.toFixed(2)}` : "—"}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: isExcluded ? "#3A4A5C" : priceColor,
                    fontFamily: "'JetBrains Mono', monospace",
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
                    color: isExcluded ? "#3A4A5C" : priceColor,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  {q ? `${isPos ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
                </div>
                <div style={{ fontSize: 9, color: "#5A6B80", fontFamily: "'JetBrains Mono', monospace" }}>
                  {high > 0 ? `$${high.toFixed(2)}` : "—"}
                </div>
                <div style={{ fontSize: 9, color: "#5A6B80", fontFamily: "'JetBrains Mono', monospace" }}>
                  {low > 0 ? `$${low.toFixed(2)}` : "—"}
                </div>

                {/* MAPO Score */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    className={isExcluded ? "" : scoreCircleClass(score)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `2px solid ${isExcluded ? "#1C2840" : scoreColor(score)}`,
                      background: isExcluded ? "transparent" : `${scoreColor(score)}0D`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: isExcluded ? "#3A4A5C" : scoreColor(score),
                      fontFamily: "'JetBrains Mono', monospace",
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
                        padding: "2px 7px",
                        background: "rgba(255,68,88,0.08)",
                        border: "1px solid rgba(255,68,88,0.2)",
                        borderRadius: 3,
                        color: "#FF4458",
                        fontFamily: "'Inter', system-ui, sans-serif",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      EXCLUDED
                    </span>
                  ) : q ? (
                    <span
                      style={{
                        fontSize: 7,
                        padding: "2px 7px",
                        background: `${scoreColor(score)}12`,
                        border: `1px solid ${scoreColor(score)}35`,
                        borderRadius: 3,
                        color: scoreColor(score),
                        fontFamily: "'Inter', system-ui, sans-serif",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      {scoreLabel(score)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 8, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif" }}>—</span>
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
          padding: "5px 16px",
          borderTop: "1px solid #1C2840",
          fontSize: 7,
          color: "#2E3E52",
          fontFamily: "'Inter', system-ui, sans-serif",
          flexShrink: 0,
          letterSpacing: 0.5,
        }}
      >
        * MAPO Score is a quick heuristic based on price action. Use AI Analyst for full 6-factor scoring.
        Excluded tickers per MAPO exclusion list: BMNR, UP, MP, CLSK, NBIS, AMD, TE, IREN, IBIT
      </div>
    </div>
  );
}
