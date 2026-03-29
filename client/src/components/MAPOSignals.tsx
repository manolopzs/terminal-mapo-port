import { useMemo } from "react";
import type { Holding } from "@shared/schema";

interface MAPOSignalsProps {
  holdings: Holding[];
  totalValue: number;
}

interface ScoreEntry {
  ticker: string;
  score: number;
  signal: string;
  date: string;
  factors: Record<string, number>;
}

function loadScoreHistory(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem("mapo_score_history");
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

function signalColor(signal: string) {
  if (signal.includes("STRONG BUY")) return "#00E6A8";
  if (signal.includes("BUY")) return "#00E6A8";
  if (signal.includes("HOLD")) return "#F0883E";
  return "#FF4458";
}

function scoreColor(score: number) {
  if (score >= 65) return "#00E6A8";
  if (score >= 50) return "#F0883E";
  return "#FF4458";
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

// MAPO position sizing: each position target = 1/N, capped at 25%
function targetAlloc(n: number, score: number) {
  if (n === 0) return 0;
  const base = 100 / n;
  if (score >= 80) return Math.min(base * 1.25, 25);
  if (score >= 65) return Math.min(base * 1.0, 25);
  if (score >= 50) return Math.min(base * 0.75, 25);
  return 0;
}

export function MAPOSignals({ holdings, totalValue }: MAPOSignalsProps) {
  const history = useMemo(() => loadScoreHistory(), []);
  const scoreMap = useMemo(() => {
    const map: Record<string, ScoreEntry> = {};
    for (const e of history) map[e.ticker.toUpperCase()] = e;
    return map;
  }, [history]);

  const n = holdings.filter((h) => h.type !== "Cash" && h.ticker !== "CASH").length;

  const rows = useMemo(() => {
    return [...holdings]
      .filter((h) => h.type !== "Cash" && h.ticker !== "CASH")
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((h) => {
        const entry = scoreMap[h.ticker.toUpperCase()];
        const currentAlloc = totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0;
        const target = entry ? targetAlloc(n, entry.score) : 100 / n;
        const diff = currentAlloc - target;
        return { holding: h, entry, currentAlloc, target, diff };
      });
  }, [holdings, scoreMap, totalValue, n]);

  const unscoredCount = rows.filter((r) => !r.entry).length;

  return (
    <div className="terminal-panel" style={{ flex: "1 1 0", minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">MAPO Signals</span>
        {unscoredCount > 0 ? (
          <span className="terminal-badge terminal-badge-orange">{unscoredCount} UNSCORED</span>
        ) : (
          <span className="terminal-badge">ALL SCORED</span>
        )}
      </div>

      <div className="flex-1 overflow-auto" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span style={{ fontSize: 9, color: "#4A5A6E" }}>No holdings</span>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0B0F1A", borderBottom: "1px solid #1C2840", position: "sticky", top: 0, zIndex: 1 }}>
                {["TICKER", "SCORE", "SIGNAL", "ALLOC", "vs TARGET", "LAST"].map((h) => (
                  <th
                    key={h}
                    style={{
                      fontSize: 9, fontWeight: 600, color: "#4A5A6E",
                      letterSpacing: 1.2, textTransform: "uppercase",
                      padding: "4px 6px",
                      textAlign: h === "TICKER" ? "left" : "right",
                      fontFamily: "'Inter', system-ui, sans-serif",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ holding, entry, currentAlloc, target, diff }) => {
                const diffColor = diff > 5 ? "#F0883E" : diff < -5 ? "#A371F7" : "#8B949E";
                const diffLabel = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

                return (
                  <tr
                    key={holding.id}
                    style={{ borderBottom: "1px solid rgba(28,40,64,0.4)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,217,255,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Ticker */}
                    <td style={{ padding: "5px 6px" }}>
                      <div
                        style={{
                          fontSize: 11, fontWeight: 700, color: "#00D9FF",
                          fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
                        }}
                      >
                        {holding.ticker}
                      </div>
                    </td>

                    {/* Score circle */}
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      {entry ? (
                        <div
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 28, height: 28, borderRadius: "50%",
                            border: `2px solid ${scoreColor(entry.score)}`,
                            background: `${scoreColor(entry.score)}0D`,
                            fontSize: 9, fontWeight: 700,
                            color: scoreColor(entry.score),
                            fontFamily: "'JetBrains Mono', monospace",
                            marginLeft: "auto",
                          }}
                        >
                          {entry.score}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 28, height: 28, borderRadius: "50%",
                            border: "2px dashed #2E3E52",
                            fontSize: 8, color: "#2E3E52",
                            fontFamily: "'JetBrains Mono', monospace",
                            marginLeft: "auto",
                          }}
                        >
                          ?
                        </div>
                      )}
                    </td>

                    {/* Signal */}
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      {entry ? (
                        <span
                          style={{
                            fontSize: 8, fontWeight: 700, letterSpacing: 0.8,
                            padding: "2px 5px", borderRadius: 2,
                            background: `${signalColor(entry.signal)}12`,
                            border: `1px solid ${signalColor(entry.signal)}30`,
                            color: signalColor(entry.signal),
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.signal.replace("STRONG BUY", "STR BUY")}
                        </span>
                      ) : (
                        <span style={{ fontSize: 8, color: "#F0883E", letterSpacing: 0.8 }}>
                          SCORE →
                        </span>
                      )}
                    </td>

                    {/* Current alloc */}
                    <td
                      className="font-mono tabular-nums"
                      style={{ fontSize: 10, color: "#8B949E", padding: "5px 6px", textAlign: "right" }}
                    >
                      {currentAlloc.toFixed(1)}%
                    </td>

                    {/* vs target */}
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      <div>
                        <span
                          className="font-mono tabular-nums"
                          style={{ fontSize: 10, fontWeight: 700, color: diffColor }}
                        >
                          {diffLabel}
                        </span>
                        <div style={{ fontSize: 8, color: "#3A4A5C", marginTop: 1 }}>
                          tgt {target.toFixed(1)}%
                        </div>
                      </div>
                    </td>

                    {/* Last scored */}
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      <span style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "monospace" }}>
                        {entry ? daysAgo(entry.date) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer: sizing legend */}
      <div
        style={{
          flexShrink: 0, borderTop: "1px solid #1C2840",
          padding: "4px 8px", background: "#070B14",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <span style={{ fontSize: 8, color: "#2E3E52", letterSpacing: 0.5 }}>
          vs target: <span style={{ color: "#F0883E" }}>+5%</span> overweight · <span style={{ color: "#A371F7" }}>−5%</span> underweight
        </span>
        <span style={{ fontSize: 8, color: "#2E3E52", marginLeft: "auto" }}>
          MAPO tab → score a ticker
        </span>
      </div>
    </div>
  );
}
