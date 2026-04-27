import { useMemo } from "react";
import { useDeleteHolding } from "@/hooks/use-portfolio";
import type { Holding } from "@shared/schema";

interface HoldingsTableProps {
  holdings: Holding[];
  totalValue: number;
}

export function HoldingsTable({ holdings, totalValue }: HoldingsTableProps) {
  const sorted = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const deleteHolding = useDeleteHolding();

  const totals = useMemo(() => {
    const totalCost = holdings.reduce((s, h) => s + (h.costBasis ?? 0), 0);
    const totalVal = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
    const totalDayChg = holdings.reduce((s, h) => s + (h.dayChange ?? 0), 0);
    const pnl = totalVal - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    return { totalCost, totalVal, totalDayChg, pnl, pnlPct };
  }, [holdings]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="terminal-panel flex-1" style={{ minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Holdings</span>
        <span className="terminal-badge">{holdings.length} POSITIONS</span>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: 0 }}>
        {holdings.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 120, color: "#4A5A6E", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            No positions. Log a trade to get started.
          </div>
        ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "#0B0F1A", zIndex: 1, borderBottom: "1px solid #1C2840" }}>
              {["TICKER", "VALUE", "ENTRY", "PRICE", "P&L", "DAY", "WT%"].map((h, i) => (
                <th key={h} style={{
                  fontSize: 9, fontWeight: 600, color: "#4A5A6E", letterSpacing: 1.5,
                  textTransform: "uppercase", padding: "7px 8px",
                  textAlign: i === 0 ? "left" : "right",
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const alloc = totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0;
              const pnl = h.gainLoss ?? 0;
              const pnlPct = h.gainLossPct ?? 0;
              const pnlColor = pnl >= 0 ? "var(--color-green)" : "var(--color-red)";
              const dayPct = h.dayChangePct ?? 0;
              const dayColor = dayPct > 0 ? "var(--color-green)" : dayPct < 0 ? "var(--color-red)" : "#5A6B80";
              const avgCost = (h.quantity ?? 0) > 0 ? (h.costBasis ?? 0) / (h.quantity ?? 1) : 0;
              const sector = (!h.sector || h.sector === "Unknown") ? "" : h.sector;
              const qty = (h.quantity ?? 0) % 1 === 0 ? (h.quantity ?? 0).toFixed(0) : (h.quantity ?? 0).toFixed(2);

              return (
                <tr key={h.id} style={{ borderBottom: "1px solid rgba(28,40,64,0.4)", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-a03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* TICKER + qty + sector */}
                  <td style={{ padding: "8px 8px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
                        {h.ticker}
                      </span>
                      <span style={{ fontSize: 9, color: "#4A5A6E", fontFamily: "'JetBrains Mono', monospace" }}>
                        {qty}sh
                      </span>
                    </div>
                    {sector && (
                      <div style={{ fontSize: 8, color: "#3A4A5C", fontFamily: "'Inter', system-ui, sans-serif", marginTop: 1, letterSpacing: 0.3 }}>
                        {sector}
                      </div>
                    )}
                  </td>

                  {/* VALUE */}
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#E8EDF2", fontFamily: "'JetBrains Mono', monospace" }}>
                      ${fmt(h.value ?? 0)}
                    </span>
                  </td>

                  {/* ENTRY */}
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <span style={{ fontSize: 10, color: "#5A6B80", fontFamily: "'JetBrains Mono', monospace" }}>
                      ${avgCost.toFixed(2)}
                    </span>
                  </td>

                  {/* PRICE */}
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <span style={{ fontSize: 10, color: "#C9D1D9", fontFamily: "'JetBrains Mono', monospace" }}>
                      ${(h.price ?? 0).toFixed(2)}
                    </span>
                  </td>

                  {/* P&L ($ + %) */}
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: pnlColor, fontFamily: "'JetBrains Mono', monospace", transition: "color 0.4s ease" }}>
                      {pnl >= 0 ? "+" : "\u2212"}${fmt(Math.abs(pnl))}
                    </div>
                    <div style={{ fontSize: 9, color: pnlColor, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7, marginTop: 1 }}>
                      {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                    </div>
                  </td>

                  {/* DAY */}
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: dayColor, fontFamily: "'JetBrains Mono', monospace", transition: "color 0.4s ease" }}>
                      {dayPct >= 0 ? "+" : ""}{dayPct.toFixed(2)}%
                    </span>
                  </td>

                  {/* WEIGHT with bar */}
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "#5A6B80", fontFamily: "'JetBrains Mono', monospace" }}>
                      {alloc.toFixed(1)}%
                    </div>
                    <div style={{ height: 2, background: "#1A2436", borderRadius: 1, marginTop: 2 }}>
                      <div style={{
                        height: "100%", width: `${Math.min(alloc * 4, 100)}%`, borderRadius: 1,
                        background: alloc > 25 ? "var(--color-orange)" : alloc > 15 ? "var(--color-primary)" : "#3A5A7C",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {holdings.length > 0 && (
        <div style={{
          flexShrink: 0, borderTop: "1px solid #1C2840", background: "#070B14",
          padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4A5A6E" }}>TOTAL P&L</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: totals.pnl >= 0 ? "var(--color-green)" : "var(--color-red)", fontFamily: "'JetBrains Mono', monospace" }}>
              {totals.pnl >= 0 ? "+" : "\u2212"}${fmt(Math.abs(totals.pnl))} ({totals.pnlPct >= 0 ? "+" : ""}{totals.pnlPct.toFixed(2)}%)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#3A4A5C" }}>TODAY</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: totals.totalDayChg >= 0 ? "var(--color-green)" : "var(--color-red)", fontFamily: "'JetBrains Mono', monospace" }}>
              {totals.totalDayChg >= 0 ? "+" : "\u2212"}${fmt(Math.abs(totals.totalDayChg))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
