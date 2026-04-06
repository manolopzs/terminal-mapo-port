import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Zap, RotateCcw } from "lucide-react";
import { startAgent, completeAgent, errorAgent, addLog, setLastOperation } from "@/lib/agent-bus";

type SortKey = "ticker" | "price" | "change" | "changePct" | "high" | "low" | "score";
type SortDir = "asc" | "desc";
type ScreenMode = "idle" | "deploying" | "results";

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

const AGENT_CARDS = [
  { id: "discovery", name: "DISCOVERY", hint: "80-ticker universe scan" },
  { id: "exclusion-guard", name: "EXCLUSION GUARD", hint: "Blacklist + cooldown filter" },
  { id: "composite-scorer", name: "COMPOSITE SCORER", hint: "Claude AI 6-factor scoring" },
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

  let score = 50;
  if (dp > 2) score += 10;
  else if (dp > 0) score += 5;
  else if (dp < -3) score -= 10;
  else if (dp < 0) score -= 5;

  if (hi52 > 0 && c / hi52 > 0.97) score -= 8;
  if (lo52 > 0 && c / hi52 < 0.5) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(score: number) {
  if (score >= 65) return "var(--color-green)";
  if (score >= 50) return "var(--color-orange)";
  return "var(--color-red)";
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

function aiActionColor(rating: string) {
  const r = (rating ?? "").toUpperCase();
  if (r.includes("BUY") || r === "STRONG BUY") return "var(--color-green)";
  if (r === "HOLD") return "var(--color-orange)";
  return "var(--color-red)";
}

function aiActionFromRating(rating: string): string {
  const r = (rating ?? "").toUpperCase();
  if (r.includes("BUY")) return "BUY";
  if (r === "HOLD") return "HOLD";
  return "AVOID";
}

// CSS keyframes injected once
const PULSE_STYLE = `
@keyframes mapo-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(212,168,83,0.8); }
  50% { opacity: 0.4; box-shadow: 0 0 2px var(--color-primary-a20); }
}
@keyframes mapo-bar {
  0% { width: 0%; }
  100% { width: 100%; }
}
`;

function injectStyle() {
  if (typeof document !== "undefined" && !document.getElementById("mapo-screener-style")) {
    const el = document.createElement("style");
    el.id = "mapo-screener-style";
    el.textContent = PULSE_STYLE;
    document.head.appendChild(el);
  }
}

export function ScreenerTab() {
  injectStyle();

  // Existing state
  const [activePreset, setActivePreset] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Agent screen state
  const [screenMode, setScreenMode] = useState<ScreenMode>("idle");
  const [screenTickers, setScreenTickers] = useState<string[]>([]);
  const [screenResults, setScreenResults] = useState<any[]>([]);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [screenLoading, setScreenLoading] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployProgressLabel, setDeployProgressLabel] = useState("");

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

  async function handleDeployAgents() {
    // Parse tickers from custom input or current preset
    let tickers: string[] = [];
    if (customInput.trim()) {
      tickers = customInput
        .toUpperCase()
        .split(/[\s,;]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30);
    } else {
      tickers = PRESET_SCREENS[activePreset]?.tickers ?? [];
    }

    if (!tickers.length) return;

    setScreenTickers(tickers);
    setScreenMode("deploying");
    setScreenLoading(true);
    setScreenError(null);
    setScreenResults([]);
    setDeployProgress(0);
    setDeployProgressLabel(`Initializing agents...`);

    // Fire agent bus events
    startAgent("discovery");
    startAgent("exclusion-guard");
    startAgent("composite-scorer");
    addLog({ agentName: "SCREENER", message: `Deploying agents: screening ${tickers.length} tickers`, type: "info" });
    setLastOperation("SCREEN: " + tickers.join(", "));

    // Fake progress animation while waiting for real API
    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 8, 85);
      const analyzed = Math.floor((fakeProgress / 100) * tickers.length);
      setDeployProgress(Math.round(fakeProgress));
      setDeployProgressLabel(`Analyzing ${analyzed}/${tickers.length} tickers...`);
    }, 400);

    try {
      const res = await fetch("/api/screen/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : data.results ?? [];

      setDeployProgress(100);
      setDeployProgressLabel("Analysis complete.");
      setScreenResults(results);

      completeAgent("discovery");
      completeAgent("exclusion-guard");
      completeAgent("composite-scorer", `${results.length} results`);
      addLog({ agentName: "SCREENER", message: `Screen complete: ${results.length} stocks analyzed`, type: "success" });

      // Brief pause to show 100% then flip to results
      setTimeout(() => {
        setScreenMode("results");
        setScreenLoading(false);
      }, 600);
    } catch (err: any) {
      clearInterval(progressInterval);
      const msg = err?.message ?? "Unknown error";
      setScreenError(msg);
      setScreenLoading(false);

      errorAgent("discovery", msg);
      errorAgent("exclusion-guard", msg);
      errorAgent("composite-scorer", msg);
      addLog({ agentName: "SCREENER", message: `Screen failed: ${msg}`, type: "error" });

      // Stay in deploying mode but show error
    }
  }

  function handleReset() {
    setScreenMode("idle");
    setScreenResults([]);
    setScreenError(null);
    setScreenLoading(false);
    setScreenTickers([]);
    setDeployProgress(0);
    setDeployProgressLabel("");
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────

  function renderAgentSection() {
    if (screenMode === "idle") {
      return (
        <div
          style={{
            margin: "10px 16px 0",
            border: "1px solid #1C2840",
            borderRadius: 4,
            background: "#080C14",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #1C2840",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#3A4A5C",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              AGENT SCREENING
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, color: "#2A3A50", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>
              POWERED BY MAPO AI
            </span>
          </div>

          {/* Body */}
          <div
            style={{
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {/* Custom tickers input */}
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
              <Search
                size={10}
                color="#4A5A6E"
                style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDeployAgents(); }}
                placeholder="Custom tickers: AAPL, NVDA, TSLA..."
                style={{
                  width: "100%",
                  background: "#0B0F1A",
                  border: "1px solid #1C2840",
                  borderRadius: 3,
                  padding: "6px 10px 6px 26px",
                  fontSize: 10,
                  color: "#C9D1D9",
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary-a50)")}
                onBlur={(e) => (e.target.style.borderColor = "#1C2840")}
              />
            </div>

            {/* Deploy button */}
            <button
              onClick={handleDeployAgents}
              style={{
                padding: "6px 16px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                background: "var(--color-primary-a12)",
                border: "1px solid rgba(212,168,83,0.4)",
                borderRadius: 3,
                color: "var(--color-primary)",
                fontFamily: "'Inter', system-ui, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(212,168,83,0.22)";
                e.currentTarget.style.borderColor = "rgba(212,168,83,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--color-primary-a12)";
                e.currentTarget.style.borderColor = "rgba(212,168,83,0.4)";
              }}
            >
              <Zap size={10} />
              DEPLOY AGENTS
            </button>

            {/* Preset quick-picks */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 9,
                  color: "#2E3E52",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  letterSpacing: 1,
                  flexShrink: 0,
                }}
              >
                or use preset:
              </span>
              {PRESET_SCREENS.slice(0, 3).map((ps) => (
                <button
                  key={ps.label}
                  onClick={() => {
                    setCustomInput(ps.tickers.join(", "));
                  }}
                  style={{
                    padding: "3px 9px",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    background: "#0B0F1A",
                    border: "1px solid #1C2840",
                    borderRadius: 3,
                    color: "#4A5A6E",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-primary)";
                    e.currentTarget.style.borderColor = "var(--color-primary-a30)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#4A5A6E";
                    e.currentTarget.style.borderColor = "#1C2840";
                  }}
                >
                  {ps.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // deploying or results header
    return (
      <div
        style={{
          margin: "10px 16px 0",
          border: screenMode === "deploying" ? "1px solid var(--color-primary-a25)" : "1px solid rgba(0,230,168,0.2)",
          borderRadius: 4,
          background: "#080C14",
          overflow: "hidden",
        }}
      >
        {/* Mission control header */}
        <div
          style={{
            padding: "7px 12px",
            borderBottom: "1px solid #1C2840",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: screenMode === "deploying" ? "var(--color-primary)" : "var(--color-green)",
              animation: screenMode === "deploying" ? "mapo-pulse 1.2s ease-in-out infinite" : "none",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: screenMode === "deploying" ? "var(--color-primary)" : "var(--color-green)",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {screenMode === "deploying" ? "AGENT DEPLOYMENT" : "MISSION COMPLETE"}
          </span>
          <span
            style={{
              fontSize: 9,
              color: "#3A4A5C",
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: 1,
            }}
          >
            {screenMode === "deploying"
              ? `— SCREENING ${screenTickers.length} TICKERS`
              : `— ${screenResults.length} RESULTS`}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleReset}
            style={{
              padding: "3px 10px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              background: "transparent",
              border: "1px solid #1C2840",
              borderRadius: 3,
              color: "#3A4A5C",
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#C9D1D9";
              e.currentTarget.style.borderColor = "#2A3A54";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#3A4A5C";
              e.currentTarget.style.borderColor = "#1C2840";
            }}
          >
            <RotateCcw size={8} />
            RESET
          </button>
        </div>

        {/* Agent cards + progress (deploying state) */}
        {screenMode === "deploying" && (
          <div style={{ padding: "12px" }}>
            {/* Agent cards row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              {AGENT_CARDS.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    flex: 1,
                    background: "#0B0F1A",
                    border: "1px solid rgba(212,168,83,0.18)",
                    borderRadius: 4,
                    padding: "10px 12px",
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "var(--color-primary)",
                        flexShrink: 0,
                        animation: "mapo-pulse 1.2s ease-in-out infinite",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        color: "var(--color-primary)",
                        fontFamily: "'Inter', system-ui, sans-serif",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {agent.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#3A4A5C",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: 0.5,
                    }}
                  >
                    RUNNING...
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: "#2A3A50",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      marginTop: 3,
                    }}
                  >
                    {agent.hint}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div>
              <div
                style={{
                  position: "relative",
                  height: 6,
                  background: "#0F1825",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 6,
                  border: "1px solid #1C2840",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${deployProgress}%`,
                    background: "linear-gradient(90deg, #D4A853, #00E6A8)",
                    borderRadius: 3,
                    transition: "width 0.3s ease",
                    boxShadow: "0 0 8px rgba(212,168,83,0.4)",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 9,
                    color: "#4A5A6E",
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 0.5,
                  }}
                >
                  {deployProgressLabel}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: "var(--color-primary)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  {deployProgress}%
                </span>
              </div>
            </div>

            {/* Error display */}
            {screenError && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  background: "var(--color-red-a08)",
                  border: "1px solid rgba(255,68,88,0.25)",
                  borderRadius: 3,
                  fontSize: 10,
                  color: "var(--color-red)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                ERROR: {screenError}
              </div>
            )}
          </div>
        )}

        {/* Results summary bar (results state) */}
        {screenMode === "results" && (
          <div
            style={{
              padding: "6px 12px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              borderBottom: "1px solid #1C2840",
            }}
          >
            {[
              { label: "BUY", color: "var(--color-green)", count: screenResults.filter((r) => !r.rejected && aiActionFromRating(r.rating ?? r.scoring?.rating ?? "") === "BUY").length },
              { label: "HOLD", color: "var(--color-orange)", count: screenResults.filter((r) => !r.rejected && aiActionFromRating(r.rating ?? r.scoring?.rating ?? "") === "HOLD").length },
              { label: "AVOID", color: "var(--color-red)", count: screenResults.filter((r) => !r.rejected && aiActionFromRating(r.rating ?? r.scoring?.rating ?? "") === "AVOID").length },
              { label: "REJECTED", color: "#2A3A50", count: screenResults.filter((r) => r.rejected).length },
            ].map(({ label, color, count }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>
                  {label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {count}
                </span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, color: "#2A3A50", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>
              SOURCE: MAPO AI v2
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderAiResultsTable() {
    const accepted = screenResults.filter((r) => !r.rejected);
    const rejected = screenResults.filter((r) => r.rejected);

    return (
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* AI Results header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "90px 80px 110px 1fr 110px",
            padding: "6px 16px",
            borderBottom: "1px solid #1C2840",
            background: "#0B0F1A",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          {["TICKER", "SCORE", "RATING", "KEY SIGNAL", "ACTION"].map((label) => (
            <div
              key={label}
              style={{
                fontSize: 10,
                color: "#4A5A6E",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Accepted rows */}
        {accepted.map((result) => {
          const ticker = result.ticker ?? "???";
          const score = result.score ?? result.scoring?.compositeScore ?? 0;
          const rating = result.rating ?? result.scoring?.rating ?? "HOLD";
          const action = aiActionFromRating(rating);
          const actionColor = aiActionColor(rating);
          const signalCount = result.signalCount ?? result.quantSignals?.compositeCount ?? result.quantSignals?.signals?.length ?? 0;
          const keySignal = result.keySignal ?? result.signal ?? result.screeningNotes ?? (signalCount > 0 ? `${signalCount} quant signals` : "—");

          return (
            <div
              key={ticker}
              className="terminal-row"
              style={{
                display: "grid",
                gridTemplateColumns: "90px 80px 110px 1fr 110px",
                padding: "9px 16px",
                borderBottom: "1px solid rgba(28,40,64,0.5)",
                alignItems: "center",
                background:
                  action === "BUY"
                    ? "rgba(0,230,168,0.025)"
                    : action === "AVOID"
                    ? "rgba(255,68,88,0.025)"
                    : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                const base =
                  action === "BUY"
                    ? "rgba(0,230,168,0.06)"
                    : action === "AVOID"
                    ? "rgba(255,68,88,0.06)"
                    : "var(--color-primary-a05)";
                e.currentTarget.style.background = base;
              }}
              onMouseLeave={(e) => {
                const base =
                  action === "BUY"
                    ? "rgba(0,230,168,0.025)"
                    : action === "AVOID"
                    ? "rgba(255,68,88,0.025)"
                    : "transparent";
                e.currentTarget.style.background = base;
              }}
            >
              {/* Ticker */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#C9D1D9",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.5,
                }}
              >
                {ticker}
              </div>

              {/* Score with MAPO AI badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: actionColor,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {Math.round(score)}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: "var(--color-primary)",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    letterSpacing: 0.8,
                    background: "var(--color-primary-a08)",
                    border: "1px solid var(--color-primary-a20)",
                    borderRadius: 2,
                    padding: "1px 4px",
                  }}
                >
                  MAPO AI
                </span>
              </div>

              {/* Rating */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: actionColor,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {rating.toUpperCase()}
              </div>

              {/* Key Signal */}
              <div
                style={{
                  fontSize: 10,
                  color: "#5A6B80",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  paddingRight: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {keySignal}
              </div>

              {/* Action badge */}
              <div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "3px 9px",
                    background: `${actionColor}12`,
                    border: `1px solid ${actionColor}35`,
                    borderRadius: 3,
                    color: actionColor,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {action}
                </span>
              </div>
            </div>
          );
        })}

        {/* Rejected rows */}
        {rejected.length > 0 && (
          <>
            <div
              style={{
                padding: "5px 16px",
                background: "#080C14",
                borderBottom: "1px solid #1C2840",
                fontSize: 9,
                color: "#2E3E52",
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              REJECTED ({rejected.length})
            </div>
            {rejected.map((result) => {
              const ticker = result.ticker ?? "???";
              return (
                <div
                  key={ticker}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 80px 110px 1fr 110px",
                    padding: "7px 16px",
                    borderBottom: "1px solid rgba(28,40,64,0.3)",
                    alignItems: "center",
                    opacity: 0.5,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#3A4A5C",
                      fontFamily: "'JetBrains Mono', monospace",
                      textDecoration: "line-through",
                    }}
                  >
                    {ticker}
                  </div>
                  <div style={{ fontSize: 10, color: "#2E3E52", fontFamily: "'JetBrains Mono', monospace" }}>—</div>
                  <div style={{ fontSize: 10, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif" }}>REJECTED</div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#2E3E52",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontStyle: "italic",
                    }}
                  >
                    {result.rejectReason ?? "No data available"}
                  </div>
                  <div />
                </div>
              );
            })}
          </>
        )}

        {accepted.length === 0 && rejected.length === 0 && (
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
            No results returned.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── AGENT SCREENING SECTION ── */}
      {renderAgentSection()}

      {/* ── TOP BAR (preset selector + custom search) — always visible ── */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1C2840",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          background: "#080C14",
          marginTop: 8,
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
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  background: isActive ? "var(--color-primary-a10)" : "#0B0F1A",
                  border: isActive ? "1px solid var(--color-primary-a35)" : "1px solid #1C2840",
                  borderRadius: 3,
                  color: isActive ? "var(--color-primary)" : "#5A6B80",
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
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary-a50)")}
              onBlur={(e) => (e.target.style.borderColor = "#1C2840")}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "5px 14px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              background: "var(--color-primary-a12)",
              border: "1px solid var(--color-primary-a30)",
              borderRadius: 3,
              color: "var(--color-primary)",
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-a20)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-primary-a12)")}
          >
            Screen
          </button>
        </form>
        {/* Row count */}
        <div style={{ fontSize: 10, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", flexShrink: 0, letterSpacing: 1.2 }}>
          {screenMode === "results" ? `${screenResults.length} AI results` : `${rows.length} ticker${rows.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* ── CONTENT: AI results table OR market quotes table ── */}
      {screenMode === "results" ? (
        renderAiResultsTable()
      ) : (
        <>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 100px 80px 80px 180px 100px 1fr",
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
                { label: "DAY RANGE", key: null },
                { label: "SCORE", key: "score" as SortKey },
                { label: "SIGNAL", key: null },
              ] as { label: string; key: SortKey | null }[]
            ).map(({ label, key }) => (
              <div
                key={label}
                onClick={() => key && handleSort(key)}
                style={{
                  fontSize: 10,
                  color: sortKey === key ? "var(--color-primary)" : "#4A5A6E",
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
                const priceColor = isPos ? "var(--color-green)" : "var(--color-red)";

                return (
                  <div
                    key={ticker}
                    className="terminal-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 100px 80px 80px 180px 100px 1fr",
                      padding: "8px 16px",
                      borderBottom: "1px solid rgba(28,40,64,0.5)",
                      alignItems: "center",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,168,83,0.03)")}
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
                    {/* Day Range bar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: 8 }}>
                      {q && high > 0 && low > 0 && price > 0 ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'JetBrains Mono', monospace" }}>
                              ${low.toFixed(2)}
                            </span>
                            <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'JetBrains Mono', monospace" }}>
                              ${high.toFixed(2)}
                            </span>
                          </div>
                          <div style={{ position: "relative", height: 4, background: "#1A2436", borderRadius: 2 }}>
                            <div
                              style={{
                                position: "absolute",
                                height: "100%",
                                left: 0,
                                width: `${Math.min(Math.max(((price - low) / (high - low)) * 100, 2), 98)}%`,
                                background: isPos ? "var(--color-green)" : "var(--color-red)",
                                borderRadius: 2,
                                transition: "width 0.4s ease",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: -1,
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: isPos ? "var(--color-green)" : "var(--color-red)",
                                border: "1px solid #0A0E1A",
                                left: `calc(${Math.min(Math.max(((price - low) / (high - low)) * 100, 2), 95)}% - 3px)`,
                                boxShadow: `0 0 4px ${isPos ? "rgba(0,230,168,0.6)" : "rgba(255,68,88,0.6)"}`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 9, color: "#2E3E52" }}>—</span>
                      )}
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
                            fontSize: 10,
                            padding: "2px 7px",
                            background: "var(--color-red-a08)",
                            border: "1px solid var(--color-red-a20)",
                            borderRadius: 3,
                            color: "var(--color-red)",
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
                            fontSize: 10,
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
                        <span style={{ fontSize: 10, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif" }}>—</span>
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
              fontSize: 10,
              color: "#2E3E52",
              fontFamily: "'Inter', system-ui, sans-serif",
              flexShrink: 0,
              letterSpacing: 0.5,
            }}
          >
            * MAPO Score is a quick heuristic based on price action. Use AI Analyst for full 6-factor scoring.
            Excluded tickers per MAPO exclusion list: BMNR, UP, MP, CLSK, NBIS, AMD, TE, IREN, IBIT
          </div>
        </>
      )}
    </div>
  );
}
