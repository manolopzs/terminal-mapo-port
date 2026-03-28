import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";

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
  if (score >= 80) return "#00C853";
  if (score >= 65) return "#4CAF50";
  if (score >= 50) return "#FFB300";
  return "#FF4D4D";
}

function signalBg(signal: string) {
  if (signal.includes("STRONG BUY")) return { bg: "rgba(0,200,83,0.1)", border: "rgba(0,200,83,0.3)", color: "#00C853" };
  if (signal.includes("BUY")) return { bg: "rgba(76,175,80,0.1)", border: "rgba(76,175,80,0.3)", color: "#4CAF50" };
  if (signal.includes("HOLD")) return { bg: "rgba(255,179,0,0.1)", border: "rgba(255,179,0,0.3)", color: "#FFB300" };
  return { bg: "rgba(255,77,77,0.1)", border: "rgba(255,77,77,0.3)", color: "#FF4D4D" };
}

const FACTORS: { key: keyof MAPOAnalysis["factors"]; label: string; weight: number }[] = [
  { key: "financialHealth", label: "Financial Health", weight: 25 },
  { key: "valuation", label: "Valuation", weight: 20 },
  { key: "growth", label: "Growth", weight: 20 },
  { key: "technical", label: "Technical", weight: 15 },
  { key: "sentiment", label: "Sentiment", weight: 10 },
  { key: "macroFit", label: "Macro Fit", weight: 10 },
];

export function MAPOScoreTab() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState<MAPOAnalysis | null>(null);

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
    onSuccess: (data) => setResult(data),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    analyze.mutate(sym);
  }

  const sig = result ? signalBg(result.signal) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Search bar */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1A2332",
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
              color="#484F58"
              style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Enter ticker (e.g. NVDA)"
              style={{
                width: "100%",
                background: "#080C14",
                border: "1px solid #1A2332",
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
              background: analyze.isPending ? "#1A2332" : "linear-gradient(135deg, #00D9FF 0%, #0066FF 100%)",
              border: "none",
              borderRadius: 3,
              color: analyze.isPending ? "#484F58" : "#080C14",
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
                color: "#484F58",
                fontFamily: "monospace",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Enter a ticker to run full MAPO 6-factor analysis
            </div>
            <div style={{ fontSize: 9, color: "#2D3748", maxWidth: 400, margin: "0 auto", lineHeight: 1.8 }}>
              Analysis uses: Financial Health (25%) · Valuation (20%) · Growth (20%) · Technical (15%) · Sentiment (10%) · Macro Fit (10%)
            </div>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {["HIMS", "OKTA", "COHR", "SEZL", "PLTR", "HOOD", "NVDA"].map((t) => (
                <button
                  key={t}
                  onClick={() => { setTicker(t); analyze.mutate(t); }}
                  style={{
                    padding: "4px 10px",
                    fontSize: 9,
                    fontFamily: "monospace",
                    background: "transparent",
                    border: "1px solid #1A2332",
                    borderRadius: 3,
                    color: "#8B949E",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#00D9FF";
                    e.currentTarget.style.color = "#00D9FF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#1A2332";
                    e.currentTarget.style.color = "#8B949E";
                  }}
                >
                  {t}
                </button>
              ))}
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

        {result && !analyze.isPending && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, maxWidth: 1100 }}>
            {/* Left: Score card */}
            <div>
              {/* Main score */}
              <div
                style={{
                  background: "#0D1117",
                  border: "1px solid #1A2332",
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
                  border: "1px solid #1A2332",
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
                          <span style={{ fontSize: 7, color: "#484F58", fontFamily: "monospace" }}>
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
                  border: "1px solid #1A2332",
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
                    border: "1px solid #1A2332",
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
                    border: "1px solid #1A2332",
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
                  border: "1px solid #1A2332",
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
  );
}
