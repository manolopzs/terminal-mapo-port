import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";

const SCORE_HISTORY_KEY = "mapo_score_history";

interface ScoreHistoryEntry {
  ticker: string;
  score: number;
  signal: string;
  date: string;
  factors: MAPOAnalysis["factors"];
}

function loadScoreHistory(): ScoreHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScoreHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveScoreHistory(history: ScoreHistoryEntry[]) {
  localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(history));
}

interface MAPOAnalysis {
  ticker: string;
  score: number;
  factors: {
    financialHealth: number;
    valuation: number;
    growth: number;
    technical: number;
    sentiment: number;
    macroFit: number;
  };
  signal: string;
  thesis: string;
  risks: string[];
  catalysts: string[];
  entryNote: string;
  rawResponse: string;
}

function scoreColor(score: number) {
  if (score >= 80) return "#00E6A8";
  if (score >= 65) return "#00E6A8";
  if (score >= 50) return "#F0883E";
  return "#FF4458";
}

function signalBg(signal: string) {
  if (signal.includes("STRONG BUY")) return { bg: "rgba(0,230,168,0.1)", border: "rgba(0,230,168,0.25)", color: "#00E6A8" };
  if (signal.includes("BUY")) return { bg: "rgba(0,230,168,0.07)", border: "rgba(0,230,168,0.2)", color: "#00E6A8" };
  if (signal.includes("HOLD")) return { bg: "rgba(240,136,62,0.1)", border: "rgba(240,136,62,0.25)", color: "#F0883E" };
  return { bg: "rgba(255,68,88,0.1)", border: "rgba(255,68,88,0.25)", color: "#FF4458" };
}

const FACTORS: { key: keyof MAPOAnalysis["factors"]; label: string; weight: number }[] = [
  { key: "financialHealth", label: "Financial Health", weight: 25 },
  { key: "valuation", label: "Valuation", weight: 20 },
  { key: "growth", label: "Growth", weight: 20 },
  { key: "technical", label: "Technical", weight: 15 },
  { key: "sentiment", label: "Sentiment", weight: 10 },
  { key: "macroFit", label: "Macro Fit", weight: 10 },
];

const QUICK_PICKS = ["HIMS", "OKTA", "COHR", "SEZL", "PLTR", "HOOD", "NVDA", "NET", "CRWD", "APP"];

export function MAPOScoreTab() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState<MAPOAnalysis | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>(() => loadScoreHistory());

  // Persist score history whenever it changes
  useEffect(() => {
    saveScoreHistory(scoreHistory);
  }, [scoreHistory]);

  const analyze = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await fetch("/api/mapo-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      return res.json() as Promise<MAPOAnalysis>;
    },
    onSuccess: (data) => {
      setResult(data);
      setHistory((prev) => {
        const updated = [data.ticker, ...prev.filter((t) => t !== data.ticker)];
        return updated.slice(0, 6);
      });
      // Save to persistent score history
      const entry: ScoreHistoryEntry = {
        ticker: data.ticker,
        score: data.score,
        signal: data.signal,
        date: new Date().toISOString(),
        factors: data.factors,
      };
      setScoreHistory((prev) => {
        // Deduplicate by ticker (keep latest), then cap at 20
        const deduped = [entry, ...prev.filter((h) => h.ticker !== data.ticker)];
        return deduped.slice(0, 20);
      });
    },
  });

  function runAnalysis(sym: string) {
    if (!sym) return;
    setResult(null); // clear stale result immediately
    analyze.mutate(sym);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runAnalysis(ticker.trim().toUpperCase());
  }

  const sig = result ? signalBg(result.signal) : null;

  function clearScoreHistory() {
    setScoreHistory([]);
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
    {/* Main analysis area */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Search bar */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1C2840",
          flexShrink: 0,
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            style={{
              fontSize: 9,
              color: "#00D9FF",
              fontFamily: "monospace",
              letterSpacing: 2,
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            MAPO 6-FACTOR SCORE
          </div>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <Search
              size={11}
              color="#4A5A6E"
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Enter ticker (e.g. NVDA)"
              style={{
                width: "100%",
                background: "#070B14",
                border: "1px solid #1C2840",
                borderRadius: 3,
                padding: "7px 10px 7px 28px",
                fontSize: 11,
                color: "#C9D1D9",
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
                textTransform: "uppercase",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00D9FF")}
              onBlur={(e) => (e.target.style.borderColor = "#1A2332")}
            />
          </div>
          <button
            type="submit"
            disabled={analyze.isPending}
            style={{
              padding: "7px 18px",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: analyze.isPending ? "#0E1828" : "linear-gradient(135deg, #00C4E8 0%, #0055DD 100%)",
              border: "none",
              borderRadius: 3,
              color: analyze.isPending ? "#4A5A6E" : "#070B14",
              fontFamily: "monospace",
              cursor: analyze.isPending ? "not-allowed" : "pointer",
            }}
          >
            {analyze.isPending ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                Analyzing...
              </span>
            ) : (
              "Analyze"
            )}
          </button>
        </form>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {!result && !analyze.isPending && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <div
              style={{
                fontSize: 11,
                color: "#4A5A6E",
                fontFamily: "monospace",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Enter a ticker to run full MAPO 6-factor analysis
            </div>
            <div style={{ fontSize: 9, color: "#2E3E52", maxWidth: 400, margin: "0 auto", lineHeight: 1.8 }}>
              Financial Health (25%) · Valuation (20%) · Growth (20%) · Technical (15%) · Sentiment (10%) · Macro Fit (10%)
            </div>

            {history.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 7, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>
                  Recent
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                  {history.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTicker(t); runAnalysis(t); }}
                      style={{ padding: "4px 10px", fontSize: 9, fontFamily: "monospace", background: "rgba(0,217,255,0.06)", border: "1px solid rgba(0,217,255,0.2)", borderRadius: 3, color: "#00D9FF", cursor: "pointer" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 7, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>
                Quick picks
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                {QUICK_PICKS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTicker(t); runAnalysis(t); }}
                    style={{ padding: "4px 10px", fontSize: 9, fontFamily: "monospace", background: "transparent", border: "1px solid #1C2840", borderRadius: 3, color: "#8B949E", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00D9FF"; e.currentTarget.style.color = "#00D9FF"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1A2332"; e.currentTarget.style.color = "#8B949E"; }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {analyze.isPending && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <Loader2 size={28} color="#00D9FF" style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
            <div style={{ fontSize: 9, color: "#8B949E", fontFamily: "monospace", marginTop: 14, letterSpacing: 2 }}>
              Running MAPO analysis...
            </div>
          </div>
        )}

        {analyze.isError && (
          <div
            style={{
              padding: 14,
              background: "rgba(255,77,77,0.08)",
              border: "1px solid rgba(255,77,77,0.2)",
              borderRadius: 4,
              fontSize: 10,
              color: "#FF4D4D",
              fontFamily: "monospace",
            }}
          >
            Analysis failed. Check that Anthropic API key is configured.
          </div>
        )}

        {result && !analyze.isPending && history.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {history.map((t) => (
              <button
                key={t}
                onClick={() => { setTicker(t); runAnalysis(t); }}
                style={{
                  padding: "3px 10px", fontSize: 8, fontFamily: "monospace",
                  background: t === result.ticker ? "rgba(0,217,255,0.1)" : "transparent",
                  border: t === result.ticker ? "1px solid rgba(0,217,255,0.3)" : "1px solid #1C2840",
                  borderRadius: 3, color: t === result.ticker ? "#00D9FF" : "#8B949E", cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {result && !analyze.isPending && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, maxWidth: 1100 }}>
            {/* Left: Score card */}
            <div>
              {/* Main score */}
              <div
                style={{
                  background: "#0D1117",
                  border: "1px solid #1C2840",
                  borderRadius: 4,
                  padding: 20,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#C9D1D9", fontFamily: "monospace", letterSpacing: 4, marginBottom: 16 }}>
                  {result.ticker}
                </div>
                {/* Circular score */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    border: `4px solid ${scoreColor(result.score)}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    boxShadow: `0 0 24px ${scoreColor(result.score)}30`,
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor(result.score), fontFamily: "monospace", lineHeight: 1 }}>
                    {result.score}
                  </div>
                  <div style={{ fontSize: 7, color: "#8B949E", letterSpacing: 1, textTransform: "uppercase" }}>
                    /100
                  </div>
                </div>

                {/* Signal badge */}
                {sig && (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "5px 14px",
                      background: sig.bg,
                      border: `1px solid ${sig.border}`,
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: sig.color,
                      fontFamily: "monospace",
                    }}
                  >
                    {result.signal}
                  </div>
                )}
              </div>

              {/* Factor breakdown */}
              <div
                style={{
                  background: "#0D1117",
                  border: "1px solid #1C2840",
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    color: "#8B949E",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 12,
                    fontFamily: "monospace",
                  }}
                >
                  Factor Breakdown
                </div>
                {FACTORS.map(({ key, label, weight }) => {
                  const val = result.factors[key];
                  const color = val >= 65 ? "#00C853" : val >= 50 ? "#FFB300" : "#FF4D4D";
                  return (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 3,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 9, color: "#8B949E", fontFamily: "monospace" }}>
                          {label}
                        </span>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 7, color: "#4A5A6E", fontFamily: "monospace" }}>
                            {weight}%
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, color, fontFamily: "monospace" }}>
                            {val}/100
                          </span>
                        </span>
                      </div>
                      <div style={{ height: 4, background: "#1A2332", borderRadius: 2 }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${val}%`,
                            background: color,
                            borderRadius: 2,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Analysis */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Thesis */}
              <div
                style={{
                  background: "#0D1117",
                  border: "1px solid #1C2840",
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 8, color: "#00D9FF", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
                  Investment Thesis
                </div>
                <div style={{ fontSize: 10, color: "#C9D1D9", lineHeight: 1.7 }}>{result.thesis}</div>
              </div>

              {/* Catalysts + Risks */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div
                  style={{
                    background: "#0D1117",
                    border: "1px solid #1C2840",
                    borderRadius: 4,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 8, color: "#00C853", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
                    Catalysts
                  </div>
                  {result.catalysts.map((c, i) => (
                    <div key={i} style={{ fontSize: 9, color: "#8B949E", lineHeight: 1.7, display: "flex", gap: 6 }}>
                      <span style={{ color: "#00C853", flexShrink: 0 }}>+</span>
                      {c}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    background: "#0D1117",
                    border: "1px solid #1C2840",
                    borderRadius: 4,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 8, color: "#FF4D4D", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
                    Key Risks
                  </div>
                  {result.risks.map((r, i) => (
                    <div key={i} style={{ fontSize: 9, color: "#8B949E", lineHeight: 1.7, display: "flex", gap: 6 }}>
                      <span style={{ color: "#FF4D4D", flexShrink: 0 }}>−</span>
                      {r}
                    </div>
                  ))}
                </div>
              </div>

              {/* Entry note */}
              <div
                style={{
                  background: "#0D1117",
                  border: "1px solid #1C2840",
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 8, color: "#FFB300", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
                  Entry / Action Note
                </div>
                <div style={{ fontSize: 10, color: "#C9D1D9", lineHeight: 1.7 }}>{result.entryNote}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>

    {/* History side panel — only when there's history */}
    {scoreHistory.length > 0 && (
      <div
        data-mapo="history-panel"
        style={{
          width: 200,
          flexShrink: 0,
          borderLeft: "1px solid #1C2840",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 10px",
            borderBottom: "1px solid #1C2840",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#4A5A6E",
            fontFamily: "monospace",
            flexShrink: 0,
          }}
        >
          History
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {scoreHistory.map((h) => {
            const sc = scoreColor(h.score);
            const sig = signalBg(h.signal);
            const dateStr = new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <button
                key={h.ticker + h.date}
                data-mapo={`history-row-${h.ticker}`}
                onClick={() => { setTicker(h.ticker); runAnalysis(h.ticker); }}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #0D1117",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 10, color: "#C9D1D9" }}>
                    {h.ticker}
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 11, color: sc }}>
                    {h.score}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 7, color: sig.color, fontFamily: "monospace", letterSpacing: 0.5 }}>
                    {h.signal}
                  </span>
                  <span style={{ fontSize: 7, color: "#4A5A6E", fontFamily: "monospace" }}>
                    {dateStr}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <button
          data-mapo="btn-clear-history"
          onClick={clearScoreHistory}
          style={{
            padding: "7px 10px",
            fontSize: 7,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontFamily: "monospace",
            background: "transparent",
            border: "none",
            borderTop: "1px solid #1C2840",
            color: "#4A5A6E",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FF4D4D"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4A5A6E"; }}
        >
          Clear History
        </button>
      </div>
    )}
    </div>
  );
}
