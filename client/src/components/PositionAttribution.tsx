import { useState, useMemo } from "react";
import type { Holding } from "@shared/schema";

interface PositionAttributionProps {
  holdings: Holding[];
  totalValue: number;
}

type View = "today" | "total";

export function PositionAttribution({ holdings, totalValue }: PositionAttributionProps) {
  const [view, setView] = useState<View>("today");

  const rows = useMemo(() => {
    return [...holdings]
      .map(h => ({
        ticker: h.ticker,
        name: h.name ?? h.ticker,
        sector: (h as any).sector ?? "",
        dayChange: h.dayChange ?? 0,
        dayChangePct: h.dayChangePct ?? 0,
        gainLoss: (h as any).gainLoss ?? 0,
        gainLossPct: (h as any).gainLossPct ?? 0,
        value: h.value ?? 0,
        weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
      }))
      .sort((a, b) =>
        view === "today"
          ? Math.abs(b.dayChange) - Math.abs(a.dayChange)
          : Math.abs(b.gainLoss) - Math.abs(a.gainLoss)
      );
  }, [holdings, view, totalValue]);

  const maxAbs = useMemo(() => {
    if (rows.length === 0) return 1;
    return Math.max(
      ...rows.map(r => Math.abs(view === "today" ? r.dayChange : r.gainLoss)),
      1
    );
  }, [rows, view]);

  const totals = useMemo(() => {
    const todayTotal = holdings.reduce((s, h) => s + (h.dayChange ?? 0), 0);
    const gainLossTotal = holdings.reduce((s, h) => s + ((h as any).gainLoss ?? 0), 0);
    return { todayTotal, gainLossTotal };
  }, [holdings]);

  const activeTotal = view === "today" ? totals.todayTotal : totals.gainLossTotal;
  const isPositive = activeTotal >= 0;

  return (
    <div className="terminal-panel" style={{ height: "100%" }}>
      {/* Header */}
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Position Attribution</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isPositive ? "#00E6A8" : "#FF4458",
            }}
          >
            {isPositive ? "+" : ""}${Math.abs(activeTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {/* Toggle */}
          <div style={{ display: "flex", borderRadius: 3, overflow: "hidden", border: "1px solid #1C2840" }}>
            {(["today", "total"] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "2px 8px",
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  background: view === v ? "rgba(0,217,255,0.12)" : "transparent",
                  color: view === v ? "#00D9FF" : "#4A5A6E",
                  transition: "all 0.15s",
                }}
              >
                {v === "today" ? "Today" : "Total"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#3A4A5C", fontSize: 10, fontFamily: "'Inter', system-ui, sans-serif" }}>
            No positions
          </div>
        ) : (
          rows.map((row, i) => {
            const amount = view === "today" ? row.dayChange : row.gainLoss;
            const pct = view === "today" ? row.dayChangePct : row.gainLossPct;
            const pos = amount >= 0;
            const barWidth = maxAbs > 0 ? (Math.abs(amount) / maxAbs) * 100 : 0;
            const isTop = i < 3;

            return (
              <div
                key={row.ticker}
                style={{
                  padding: "5px 10px",
                  borderBottom: "1px solid rgba(28,40,64,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  background: i === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                }}
              >
                {/* Top row: ticker + amount + pct */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: pos ? "#00E6A8" : "#FF4458",
                        flexShrink: 0,
                        minWidth: 44,
                      }}
                    >
                      {row.ticker}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: "#3A4A5C",
                        fontFamily: "'Inter', system-ui, sans-serif",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 100,
                      }}
                    >
                      {row.name}
                    </span>
                    {isTop && (
                      <span style={{
                        fontSize: 7, fontWeight: 700, letterSpacing: 0.8,
                        padding: "1px 4px", borderRadius: 2,
                        background: pos ? "rgba(0,230,168,0.08)" : "rgba(255,68,88,0.08)",
                        color: pos ? "#00E6A8" : "#FF4458",
                        border: `1px solid ${pos ? "rgba(0,230,168,0.15)" : "rgba(255,68,88,0.15)"}`,
                        flexShrink: 0,
                      }}>
                        #{i + 1}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span
                      className="font-mono tabular-nums"
                      style={{ fontSize: 11, fontWeight: 600, color: pos ? "#00E6A8" : "#FF4458" }}
                    >
                      {pos ? "+" : ""}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: 9, fontWeight: 600, minWidth: 44, textAlign: "right",
                        color: pos ? "rgba(0,230,168,0.65)" : "rgba(255,68,88,0.65)",
                      }}
                    >
                      {pos ? "+" : ""}{pct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, background: "rgba(28,40,64,0.6)", borderRadius: 2, height: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        borderRadius: 2,
                        background: pos
                          ? `linear-gradient(90deg, rgba(0,230,168,0.4), rgba(0,230,168,0.8))`
                          : `linear-gradient(90deg, rgba(255,68,88,0.4), rgba(255,68,88,0.8))`,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <span
                    className="font-mono tabular-nums"
                    style={{ fontSize: 8, color: "#3A4A5C", minWidth: 28, textAlign: "right" }}
                  >
                    {row.weight.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: summary */}
      {rows.length > 0 && (
        <div
          style={{
            padding: "5px 10px",
            borderTop: "1px solid #1C2840",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ fontSize: 8, color: "#3A4A5C", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Inter', system-ui, sans-serif" }}>
            {rows.filter(r => (view === "today" ? r.dayChange : r.gainLoss) >= 0).length} winners
            {" / "}
            {rows.filter(r => (view === "today" ? r.dayChange : r.gainLoss) < 0).length} losers
          </span>
          <span style={{ fontSize: 8, color: "#3A4A5C", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Inter', system-ui, sans-serif" }}>
            {view === "today" ? "Daily" : "All-time"} P&L
          </span>
        </div>
      )}
    </div>
  );
}
