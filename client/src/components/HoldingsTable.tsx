import { useMemo } from "react";
import { Trash2 } from "lucide-react";
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

  return (
    <div className="terminal-panel flex-1" style={{ minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Holdings</span>
        <span className="terminal-badge">{holdings.length} POSITIONS</span>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 420 }}>
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "2%" }} />
          </colgroup>
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: "#0B0F1A",
                zIndex: 1,
                borderBottom: "1px solid #1C2840",
              }}
            >
              {["TICKER", "VALUE", "QTY", "ENTRY", "PRICE", "P&L $", "P&L%", "DAY%", "ALLOC", "SECTOR", ""].map((h) => (
                <th
                  key={h || "actions"}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#4A5A6E",
                    letterSpacing: 1.3,
                    textTransform: "uppercase",
                    padding: h === "TICKER" ? "6px 6px 6px 10px" : "6px 6px",
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
            {sorted.map((h) => {
              const alloc = totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0;
              const chgPct = h.dayChangePct ?? 0;
              const chgColor = chgPct > 0 ? "var(--color-green)" : chgPct < 0 ? "var(--color-red)" : "#8B949E";
              const pnlPct = h.gainLossPct ?? 0;
              const pnlColor = pnlPct >= 0 ? "var(--color-green)" : "var(--color-red)";
              const avgCost = (h.quantity ?? 0) > 0 ? (h.costBasis ?? 0) / (h.quantity ?? 1) : 0;
              const shortName = h.name.length > 15 ? h.name.slice(0, 15) + "…" : h.name;
              return (
                <tr
                  key={h.id}
                  className="group"
                  style={{
                    borderBottom: "1px solid rgba(28, 40, 64, 0.5)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-a03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* TICKER + name */}
                  <td style={{ padding: "6px 6px 6px 10px" }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        fontFamily: "'JetBrains Mono', monospace",
                        lineHeight: 1.15,
                        letterSpacing: 0.5,
                      }}
                    >
                      {h.ticker}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#3A4A5C",
                        lineHeight: 1.1,
                        marginTop: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {shortName}
                    </div>
                  </td>

                  {/* VALUE */}
                  <td style={{ padding: "6px 6px", textAlign: "right" }}>
                    <div
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#E8EDF2",
                        lineHeight: 1.15,
                      }}
                    >
                      ${(h.value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </div>
                  </td>

                  {/* QTY */}
                  <td
                    className="font-mono tabular-nums"
                    style={{ fontSize: 10, color: "#6A7A8E", padding: "6px 6px", textAlign: "right" }}
                  >
                    {(h.quantity ?? 0) < 1
                      ? (h.quantity ?? 0).toFixed(3)
                      : (h.quantity ?? 0) % 1 === 0
                        ? (h.quantity ?? 0).toFixed(0)
                        : (h.quantity ?? 0).toFixed(2)}
                  </td>

                  {/* ENTRY (avg cost) */}
                  <td
                    className="font-mono tabular-nums"
                    style={{ fontSize: 10, color: "#5A6B80", padding: "6px 6px", textAlign: "right" }}
                  >
                    ${avgCost.toFixed(2)}
                  </td>

                  {/* PRICE */}
                  <td
                    className="font-mono tabular-nums"
                    style={{ fontSize: 10, color: "#C9D1D9", padding: "6px 6px", textAlign: "right" }}
                  >
                    ${(h.price ?? 0).toFixed(2)}
                  </td>

                  {/* P&L $ */}
                  <td
                    className="font-mono tabular-nums"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: pnlColor,
                      padding: "6px 6px",
                      textAlign: "right",
                    }}
                  >
                    {(h.gainLoss ?? 0) >= 0 ? "+" : ""}$
                    {Math.abs(h.gainLoss ?? 0).toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>

                  {/* P&L% */}
                  <td
                    className="font-mono tabular-nums"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: pnlColor,
                      padding: "6px 6px",
                      textAlign: "right",
                    }}
                  >
                    {pnlPct >= 0 ? "+" : ""}
                    {pnlPct.toFixed(1)}%
                  </td>

                  {/* DAY% */}
                  <td
                    className="font-mono tabular-nums"
                    style={{
                      fontSize: 10,
                      color: chgColor,
                      padding: "6px 6px",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {chgPct >= 0 ? "+" : ""}
                    {chgPct.toFixed(2)}%
                  </td>

                  {/* ALLOC% with mini bar */}
                  <td style={{ padding: "6px 6px", textAlign: "right" }}>
                    <div
                      className="font-mono tabular-nums"
                      style={{ fontSize: 9, color: "#5A6B80", lineHeight: 1.15 }}
                    >
                      {alloc.toFixed(1)}%
                    </div>
                    <div
                      style={{
                        height: 2,
                        background: "#1A2436",
                        borderRadius: 1,
                        marginTop: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(alloc * 4, 100)}%`,
                          background:
                            alloc > 25
                              ? "var(--color-orange)"
                              : alloc > 15
                                ? "var(--color-primary)"
                                : "#3A5A7C",
                          borderRadius: 1,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </td>

                  {/* SECTOR */}
                  <td
                    style={{
                      fontSize: 9,
                      color: "#4A5A6E",
                      padding: "6px 6px",
                      textAlign: "right",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      letterSpacing: 0.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.sector ?? "—"}
                  </td>

                  {/* DELETE */}
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button
                      onClick={() => deleteHolding.mutate(h.id)}
                      disabled={deleteHolding.isPending}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#8B949E",
                        padding: "1px 2px",
                        opacity: 0.25,
                        transition: "opacity 100ms, color 100ms",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.color = "var(--color-red)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0.25";
                        e.currentTarget.style.color = "#8B949E";
                      }}
                      data-testid={`delete-holding-${h.id}`}
                    >
                      <Trash2 size={9} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer — always visible */}
      {holdings.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid #1C2840",
            background: "#070B14",
            padding: "5px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#4A5A6E",
              }}
            >
              TOTAL P&L
            </span>
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: totals.pnl >= 0 ? "var(--color-green)" : "var(--color-red)",
              }}
            >
              {totals.pnl >= 0 ? "+" : ""}$
              {Math.abs(totals.pnl).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: totals.pnlPct >= 0 ? "var(--color-green)" : "var(--color-red)",
                opacity: 0.8,
              }}
            >
              ({totals.pnlPct >= 0 ? "+" : ""}
              {totals.pnlPct.toFixed(2)}%)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#3A4A5C",
              }}
            >
              TODAY
            </span>
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: totals.totalDayChg >= 0 ? "var(--color-green)" : "var(--color-red)",
              }}
            >
              {totals.totalDayChg >= 0 ? "+" : ""}$
              {Math.abs(totals.totalDayChg).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
