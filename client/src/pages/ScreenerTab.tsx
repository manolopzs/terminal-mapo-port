import { useState } from "react";
import { Search, Zap, RotateCcw, Database, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { startAgent, completeAgent, errorAgent, addLog, setLastOperation } from "@/lib/agent-bus";

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
];

const AGENT_CARDS = [
  { id: "discovery", name: "DISCOVERY", hint: "1,700+ stock dynamic screener" },
  { id: "exclusion-guard", name: "EXCLUSION GUARD", hint: "Blacklist + cooldown filter" },
  { id: "composite-scorer", name: "COMPOSITE SCORER", hint: "Claude AI 6-factor scoring" },
];

function scoreColor(score: number) {
  if (score >= 65) return "var(--color-green)";
  if (score >= 50) return "var(--color-orange)";
  return "var(--color-red)";
}

function aiActionFromRating(rating: string): string {
  const r = (rating ?? "").toUpperCase();
  if (r.includes("BUY")) return "BUY";
  if (r === "HOLD") return "HOLD";
  return "AVOID";
}

function aiActionColor(rating: string) {
  const r = (rating ?? "").toUpperCase();
  if (r.includes("BUY") || r === "STRONG BUY") return "var(--color-green)";
  if (r === "HOLD") return "var(--color-orange)";
  return "var(--color-red)";
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

const FACTOR_KEYS: { key: string; label: string }[] = [
  { key: "growth", label: "GROWTH" },
  { key: "macroAlignment", label: "MACRO" },
  { key: "financialHealth", label: "FIN HEALTH" },
  { key: "technical", label: "TECHNICAL" },
  { key: "sentiment", label: "SENTIMENT" },
  { key: "valuation", label: "VALUATION" },
];

const QUANT_SIGNAL_KEYS: { key: string; label: string }[] = [
  { key: "momentum", label: "Momentum" },
  { key: "goldenCross", label: "Golden Cross" },
  { key: "sue", label: "SUE" },
  { key: "revisions", label: "Revisions" },
  { key: "beta", label: "Beta" },
  { key: "valueFactor", label: "Value Factor" },
  { key: "donchian", label: "Donchian" },
];

function factorBarColor(score: number): string {
  if (score >= 65) return "#00E6A8";
  if (score >= 40) return "#F0883E";
  return "#FF4458";
}

function isSignalActive(key: string, signal: any): boolean {
  if (!signal) return false;
  if (key === "beta") return signal.lowVol === true;
  if (key === "donchian") return signal.valid === true && !signal.reject;
  return signal.confirmed === true;
}

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

  const [customInput, setCustomInput] = useState("");
  const [screenMode, setScreenMode] = useState<ScreenMode>("idle");
  const [screenTickers, setScreenTickers] = useState<string[]>([]);
  const [screenResults, setScreenResults] = useState<any[]>([]);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [screenLoading, setScreenLoading] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployProgressLabel, setDeployProgressLabel] = useState("");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [cachedUpdatedAt, setCachedUpdatedAt] = useState<string | null>(null);

  async function handleDeployAgents() {
    let tickers: string[] = [];
    if (customInput.trim()) {
      tickers = customInput
        .toUpperCase()
        .split(/[\s,;]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30);
    }

    setScreenTickers(tickers);
    setScreenMode("deploying");
    setScreenLoading(true);
    setScreenError(null);
    setScreenResults([]);
    setDeployProgress(0);
    setExpandedTicker(null);
    setCachedUpdatedAt(null);
    setDeployProgressLabel(tickers.length > 0 ? `Scoring ${tickers.length} tickers...` : `Scanning 1,700+ stocks...`);

    startAgent("discovery");
    startAgent("exclusion-guard");
    startAgent("composite-scorer");
    addLog({ agentName: "SCREENER", message: tickers.length > 0 ? `Scoring ${tickers.length} tickers` : `Full discovery scan`, type: "info" });
    setLastOperation(tickers.length > 0 ? "SCREEN: " + tickers.join(", ") : "FULL DISCOVERY SCAN");

    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 6, 85);
      setDeployProgress(Math.round(fakeProgress));
      if (fakeProgress < 30) {
        setDeployProgressLabel(tickers.length > 0 ? `Checking exclusions...` : `Scanning market universe...`);
      } else if (fakeProgress < 60) {
        setDeployProgressLabel(`Running AGI alignment scoring...`);
      } else {
        setDeployProgressLabel(`Claude AI scoring top candidates...`);
      }
    }, 500);

    try {
      const body = tickers.length > 0 ? { tickers } : {};
      const res = await fetch("/api/screen/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      addLog({ agentName: "SCREENER", message: `Screen complete: ${results.length} stocks scored`, type: "success" });

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
    }
  }

  async function handleCachedResults() {
    setScreenMode("deploying");
    setScreenLoading(true);
    setScreenError(null);
    setScreenResults([]);
    setScreenTickers([]);
    setDeployProgress(50);
    setDeployProgressLabel("Loading cached results...");
    setExpandedTicker(null);
    setCachedUpdatedAt(null);

    try {
      const res = await fetch("/api/screen/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cached: true }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const results: any[] = Array.isArray(data) ? data : data.results ?? [];
      if (data.updated_at) setCachedUpdatedAt(data.updated_at);

      setDeployProgress(100);
      setDeployProgressLabel("Cached results loaded.");
      setScreenResults(results);
      addLog({ agentName: "SCREENER", message: `Cached results: ${results.length} stocks`, type: "success" });

      setTimeout(() => {
        setScreenMode("results");
        setScreenLoading(false);
      }, 300);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      setScreenError(msg);
      setScreenLoading(false);
      addLog({ agentName: "SCREENER", message: `Cached load failed: ${msg}`, type: "error" });
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
    setExpandedTicker(null);
    setCachedUpdatedAt(null);
  }

  // ─── Idle view: deploy agents interface ───────────────────────────────────
  function renderIdleView() {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 40 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "var(--color-primary)", fontFamily: "'Inter', system-ui, sans-serif", marginBottom: 6 }}>
            MAPO AI SCREENER
          </div>
          <div style={{ fontSize: 10, color: "#4A5A6E", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 0.5 }}>
            Scan 1,700+ US stocks or score specific tickers with Claude AI
          </div>
        </div>

        {/* Input + deploy button */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", maxWidth: 600 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={11} color="#4A5A6E" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeployAgents(); }}
              placeholder="Custom tickers: AAPL, NVDA, TSLA... or leave empty for full scan"
              style={{
                width: "100%",
                background: "#0B0F1A",
                border: "1px solid #1C2840",
                borderRadius: 4,
                padding: "10px 12px 10px 30px",
                fontSize: 11,
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
            onClick={handleDeployAgents}
            style={{
              padding: "10px 24px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: "var(--color-primary-a12)",
              border: "1px solid rgba(212,168,83,0.4)",
              borderRadius: 4,
              color: "var(--color-primary)",
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(212,168,83,0.22)"; e.currentTarget.style.borderColor = "rgba(212,168,83,0.7)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-primary-a12)"; e.currentTarget.style.borderColor = "rgba(212,168,83,0.4)"; }}
          >
            <Zap size={12} />
            DEPLOY AGENTS
          </button>
          <button
            onClick={handleCachedResults}
            style={{
              padding: "10px 18px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: "rgba(0,230,168,0.06)",
              border: "1px solid rgba(0,230,168,0.3)",
              borderRadius: 4,
              color: "var(--color-green)",
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,230,168,0.14)"; e.currentTarget.style.borderColor = "rgba(0,230,168,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,230,168,0.06)"; e.currentTarget.style.borderColor = "rgba(0,230,168,0.3)"; }}
          >
            <Database size={12} />
            CACHED RESULTS
          </button>
        </div>

        {/* Preset quick-picks */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>
            or use preset:
          </span>
          {PRESET_SCREENS.map((ps) => (
            <button
              key={ps.label}
              onClick={() => { setCustomInput(ps.tickers.join(", ")); }}
              style={{
                padding: "4px 10px",
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
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-primary)"; e.currentTarget.style.borderColor = "var(--color-primary-a30)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#4A5A6E"; e.currentTarget.style.borderColor = "#1C2840"; }}
            >
              {ps.label}
            </button>
          ))}
        </div>

        {/* Agent cards preview */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {AGENT_CARDS.map((agent) => (
            <div key={agent.id} style={{
              background: "#0B0F1A",
              border: "1px solid #1C2840",
              borderRadius: 4,
              padding: "12px 16px",
              minWidth: 160,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#5A6B80", fontFamily: "'Inter', system-ui, sans-serif", textTransform: "uppercase", marginBottom: 4 }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 9, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif" }}>
                {agent.hint}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Deploying view: progress + agent cards ───────────────────────────────
  function renderDeployingView() {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          padding: "7px 12px",
          borderBottom: "1px solid #1C2840",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#080C14",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)", animation: "mapo-pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--color-primary)", fontFamily: "'Inter', system-ui, sans-serif" }}>
            AGENT DEPLOYMENT
          </span>
          <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>
            {screenTickers.length > 0 ? `— SCORING ${screenTickers.length} TICKERS` : `— FULL DISCOVERY SCAN`}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={handleReset} style={{
            padding: "3px 10px", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
            background: "transparent", border: "1px solid #1C2840", borderRadius: 3, color: "#3A4A5C",
            fontFamily: "'Inter', system-ui, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}>
            <RotateCcw size={8} /> CANCEL
          </button>
        </div>

        <div style={{ padding: 16, flex: 1 }}>
          {/* Agent cards */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {AGENT_CARDS.map((agent) => (
              <div key={agent.id} style={{
                flex: 1, background: "#0B0F1A", border: "1px solid rgba(212,168,83,0.18)",
                borderRadius: 4, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0, animation: "mapo-pulse 1.2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "var(--color-primary)", fontFamily: "'Inter', system-ui, sans-serif", textTransform: "uppercase" }}>
                    {agent.name}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>RUNNING...</div>
                <div style={{ fontSize: 8, color: "#2A3A50", fontFamily: "'Inter', system-ui, sans-serif", marginTop: 3 }}>{agent.hint}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ position: "relative", height: 6, background: "#0F1825", borderRadius: 3, overflow: "hidden", marginBottom: 6, border: "1px solid #1C2840" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, height: "100%", width: `${deployProgress}%`,
                background: "linear-gradient(90deg, #D4A853, #00E6A8)", borderRadius: 3,
                transition: "width 0.3s ease", boxShadow: "0 0 8px rgba(212,168,83,0.4)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#4A5A6E", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>{deployProgressLabel}</span>
              <span style={{ fontSize: 9, color: "var(--color-primary)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{deployProgress}%</span>
            </div>
          </div>

          {screenError && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--color-red-a08)", border: "1px solid rgba(255,68,88,0.25)", borderRadius: 3, fontSize: 10, color: "var(--color-red)", fontFamily: "'JetBrains Mono', monospace" }}>
              ERROR: {screenError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Results view ─────────────────────────────────────────────────────────
  function renderResultsView() {
    const accepted = screenResults.filter((r) => !r.rejected);
    const rejected = screenResults.filter((r) => r.rejected);

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "7px 12px", borderBottom: "1px solid #1C2840", display: "flex", alignItems: "center", gap: 10,
          background: "#080C14",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-green)", flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--color-green)", fontFamily: "'Inter', system-ui, sans-serif" }}>
            MISSION COMPLETE
          </span>
          <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>
            — {screenResults.length} RESULTS
          </span>
          {cachedUpdatedAt && (
            <span style={{ fontSize: 8, color: "#2E3E52", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5, marginLeft: 6 }}>
              CACHED {new Date(cachedUpdatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <div style={{ flex: 1 }} />

          {/* Summary counts */}
          {[
            { label: "BUY", color: "var(--color-green)", count: accepted.filter((r) => aiActionFromRating(r.rating ?? "") === "BUY").length },
            { label: "HOLD", color: "var(--color-orange)", count: accepted.filter((r) => aiActionFromRating(r.rating ?? "") === "HOLD").length },
            { label: "AVOID", color: "var(--color-red)", count: accepted.filter((r) => aiActionFromRating(r.rating ?? "") === "AVOID").length },
          ].map(({ label, color, count }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: 1, background: color }} />
              <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1 }}>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
            </div>
          ))}

          <button onClick={handleReset} style={{
            padding: "3px 10px", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
            background: "transparent", border: "1px solid #1C2840", borderRadius: 3, color: "#3A4A5C",
            fontFamily: "'Inter', system-ui, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            marginLeft: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#C9D1D9"; e.currentTarget.style.borderColor = "#2A3A54"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#3A4A5C"; e.currentTarget.style.borderColor = "#1C2840"; }}
          >
            <RotateCcw size={8} /> NEW SCAN
          </button>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "90px 80px 110px 1fr 110px",
          padding: "6px 16px", borderBottom: "1px solid #1C2840", background: "#0B0F1A", flexShrink: 0,
        }}>
          {["TICKER", "SCORE", "RATING", "KEY SIGNAL", "ACTION"].map((label) => (
            <div key={label} style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Inter', system-ui, sans-serif" }}>
              {label}
            </div>
          ))}
        </div>

        {/* Table rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {accepted.map((result) => {
            const ticker = result.ticker ?? "???";
            const score = result.score ?? result.scoring?.compositeScore ?? 0;
            const rating = result.rating ?? result.scoring?.rating ?? "HOLD";
            const action = aiActionFromRating(rating);
            const actionColor = aiActionColor(rating);
            const signalCount = result.signalCount ?? result.quantSignals?.compositeCount ?? result.quantSignals?.signals?.length ?? 0;
            const keySignal = result.keySignal ?? result.signal ?? result.screeningNotes ?? (signalCount > 0 ? `${signalCount} quant signals` : "—");
            const isExpanded = expandedTicker === ticker;
            const factors = result.factors ?? result.scoring?.factors ?? null;
            const quantSignals = result.quantSignals ?? null;
            const hasDetail = factors || quantSignals;

            return (
              <div key={ticker}>
                <div
                  style={{
                    display: "grid", gridTemplateColumns: "90px 80px 110px 1fr 110px",
                    padding: "9px 16px", borderBottom: isExpanded ? "none" : "1px solid rgba(28,40,64,0.5)", alignItems: "center",
                    background: action === "BUY" ? "rgba(0,230,168,0.025)" : action === "AVOID" ? "rgba(255,68,88,0.025)" : "transparent",
                    transition: "background 0.1s",
                    cursor: hasDetail ? "pointer" : "default",
                  }}
                  onClick={() => { if (hasDetail) setExpandedTicker(isExpanded ? null : ticker); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = action === "BUY" ? "rgba(0,230,168,0.06)" : action === "AVOID" ? "rgba(255,68,88,0.06)" : "var(--color-primary-a05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = action === "BUY" ? "rgba(0,230,168,0.025)" : action === "AVOID" ? "rgba(255,68,88,0.025)" : "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {hasDetail && (isExpanded
                      ? <ChevronDown size={10} color="#4A5A6E" style={{ flexShrink: 0 }} />
                      : <ChevronRight size={10} color="#2E3E52" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>{ticker}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: actionColor, fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(score)}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "var(--color-primary)", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 0.8, background: "var(--color-primary-a08)", border: "1px solid var(--color-primary-a20)", borderRadius: 2, padding: "1px 4px" }}>MAPO AI</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: actionColor, fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>{rating.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: "#5A6B80", fontFamily: "'Inter', system-ui, sans-serif", paddingRight: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{keySignal}</div>
                  <div>
                    <span style={{ fontSize: 10, padding: "3px 9px", background: `${actionColor}12`, border: `1px solid ${actionColor}35`, borderRadius: 3, color: actionColor, fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>{action}</span>
                  </div>
                </div>

                {/* Expandable detail panel */}
                {isExpanded && (
                  <div style={{
                    background: "#060A12",
                    borderLeft: "2px solid var(--color-primary)",
                    borderBottom: "1px solid rgba(28,40,64,0.5)",
                    padding: "12px 20px 14px 20px",
                    display: "flex",
                    gap: 32,
                  }}>
                    {/* Factor bars */}
                    {factors && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: "#4A5A6E", fontFamily: "'Inter', system-ui, sans-serif", textTransform: "uppercase", marginBottom: 8 }}>
                          Factor Breakdown
                        </div>
                        {FACTOR_KEYS.map(({ key, label }) => {
                          const f = (factors as any)[key];
                          const val = f?.adjusted ?? f?.base ?? 0;
                          const color = factorBarColor(val);
                          return (
                            <div key={key} style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "#5A6B80", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
                                <span style={{ fontSize: 8, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(val)}</span>
                              </div>
                              <div style={{ height: 4, background: "#1C2840", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(val, 100)}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 2, transition: "width 0.3s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quant signals */}
                    {quantSignals && (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: "#4A5A6E", fontFamily: "'Inter', system-ui, sans-serif", textTransform: "uppercase", marginBottom: 8 }}>
                          Quant Signals
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {QUANT_SIGNAL_KEYS.map(({ key, label }) => {
                            const signal = (quantSignals as any)[key];
                            const active = isSignalActive(key, signal);
                            return (
                              <div key={key} style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "2px 7px",
                                borderRadius: 3,
                                background: active ? "rgba(0,230,168,0.08)" : "rgba(90,107,128,0.08)",
                                border: `1px solid ${active ? "rgba(0,230,168,0.25)" : "rgba(90,107,128,0.15)"}`,
                              }}>
                                {active
                                  ? <Check size={8} color="#00E6A8" strokeWidth={3} />
                                  : <X size={8} color="#3A4A5C" strokeWidth={2} />
                                }
                                <span style={{
                                  fontSize: 8,
                                  fontWeight: 600,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  letterSpacing: 0.3,
                                  color: active ? "#00E6A8" : "#3A4A5C",
                                }}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                        {quantSignals.compositeCount != null && (
                          <div style={{ marginTop: 6, fontSize: 8, color: "#4A5A6E", fontFamily: "'JetBrains Mono', monospace" }}>
                            {quantSignals.compositeCount}/7 signals active
                          </div>
                        )}
                      </div>
                    )}

                    {/* No detail available fallback */}
                    {!factors && !quantSignals && (
                      <div style={{ fontSize: 9, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif", fontStyle: "italic" }}>
                        No detailed breakdown available.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Rejected */}
          {rejected.length > 0 && (
            <>
              <div style={{ padding: "5px 16px", background: "#080C14", borderBottom: "1px solid #1C2840", fontSize: 9, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1.5, textTransform: "uppercase" }}>
                REJECTED ({rejected.length})
              </div>
              {rejected.map((result) => (
                <div key={result.ticker} style={{
                  display: "grid", gridTemplateColumns: "90px 80px 110px 1fr 110px",
                  padding: "7px 16px", borderBottom: "1px solid rgba(28,40,64,0.3)", alignItems: "center", opacity: 0.5,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#3A4A5C", fontFamily: "'JetBrains Mono', monospace", textDecoration: "line-through" }}>{result.ticker}</div>
                  <div style={{ fontSize: 10, color: "#2E3E52" }}>—</div>
                  <div style={{ fontSize: 10, color: "#2E3E52" }}>REJECTED</div>
                  <div style={{ fontSize: 9, color: "#2E3E52", fontStyle: "italic" }}>{result.rejectReason ?? "No data"}</div>
                  <div />
                </div>
              ))}
            </>
          )}

          {accepted.length === 0 && rejected.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", fontSize: 9, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: 1.5, textTransform: "uppercase" }}>
              No results returned.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {screenMode === "idle" && renderIdleView()}
      {screenMode === "deploying" && renderDeployingView()}
      {screenMode === "results" && renderResultsView()}
    </div>
  );
}
