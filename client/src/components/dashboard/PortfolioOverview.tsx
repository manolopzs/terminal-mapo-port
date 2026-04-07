import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";

interface DrawdownAlert {
  ticker: string;
  level: "REVIEW" | "RESCORE" | "AUTO_EXIT" | "FORCED_EXIT";
  drawdownPct: number;
  action: string;
}

interface EnrichedHolding {
  ticker: string;
  companyName: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  value: number;
  weightPct: number;
  returnPct: number;
  sector: string;
}

interface PortfolioStatus {
  holdings: EnrichedHolding[];
  metrics: { totalValue: number; cash: number; cashPct: number; totalReturnPct: number };
  sectorWeights: Record<string, number>;
  drawdownAlerts: DrawdownAlert[];
  validation: { passed: boolean; checks: Array<{ rule: string; passed: boolean; detail: string }> };
}

function alertLevel(ticker: string, alerts: DrawdownAlert[]): DrawdownAlert["level"] | null {
  return alerts.find(a => a.ticker === ticker)?.level ?? null;
}

const ALERT_ROW_STYLES: Record<string, React.CSSProperties> = {
  REVIEW: { borderLeft: "2px solid #D4A853", background: "rgba(212,168,83,0.06)" },
  RESCORE: { borderLeft: "2px solid #E88A30", background: "rgba(232,138,48,0.06)" },
  AUTO_EXIT: { borderLeft: "2px solid var(--color-red)", background: "rgba(255,68,88,0.08)" },
  FORCED_EXIT: { borderLeft: "2px solid #CC2244", background: "rgba(204,34,68,0.10)" },
};

export function PortfolioOverview() {
  const { data, isLoading, error } = useQuery<PortfolioStatus>({
    queryKey: ["/api/portfolio/status"],
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div style={{ padding: 16, color: "var(--color-primary)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.7 }}>
      LOADING PORTFOLIO...
    </div>
  );
  if (error) return (
    <div style={{ padding: 16, color: "var(--color-red)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
      ERROR: {String(error)}
    </div>
  );
  if (!data) return null;

  const { holdings, metrics, sectorWeights, drawdownAlerts } = data;

  const totalPnl = holdings.reduce((s, h) => {
    const pnl = (h.currentPrice - h.entryPrice) * h.shares;
    return s + pnl;
  }, 0);
  const totalCost = holdings.reduce((s, h) => s + h.entryPrice * h.shares, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const summaryItems = [
    { label: "Total Value", value: formatCurrency(metrics.totalValue), color: "var(--color-primary)" },
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%)`,
      color: totalPnl >= 0 ? "var(--color-green)" : "var(--color-red)",
    },
    {
      label: "Total Return",
      value: `${metrics.totalReturnPct >= 0 ? "+" : ""}${metrics.totalReturnPct.toFixed(2)}%`,
      color: metrics.totalReturnPct >= 0 ? "var(--color-green)" : "var(--color-red)",
    },
    {
      label: "Cash",
      value: `${formatCurrency(metrics.cash)}`,
      sub: `${metrics.cashPct.toFixed(1)}%`,
      color: "#E8EDF2",
    },
    { label: "Positions", value: String(holdings.length), color: "#E8EDF2" },
  ];

  return (
    <div className="terminal-panel flex-1" style={{ minHeight: 0 }}>
      <div className="terminal-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="terminal-panel-title">Portfolio Overview</span>
        {drawdownAlerts.length > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "var(--color-red)",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            {drawdownAlerts.length} ALERT{drawdownAlerts.length > 1 ? "S" : ""}
          </span>
        )}
      </div>

      {/* Summary metrics row */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #1C2840",
          background: "#070B14",
          flexShrink: 0,
        }}
      >
        {summaryItems.map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: "8px 12px",
              borderRight: i < summaryItems.length - 1 ? "1px solid #0F1825" : "none",
              flex: i === 0 ? "0 0 auto" : 1,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "#4A5A6E",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontFamily: "'Inter', system-ui, sans-serif",
                lineHeight: 1.2,
              }}
            >
              {item.label}
            </div>
            <div
              className="font-mono tabular-nums"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: item.color,
                lineHeight: 1.3,
                marginTop: 2,
              }}
            >
              {item.value}
              {"sub" in item && item.sub && (
                <span style={{ fontSize: 9, color: "#4A5A6E", marginLeft: 4, fontWeight: 600 }}>
                  ({item.sub})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
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
              {["TICKER", "COMPANY", "SHARES", "ENTRY", "CURRENT", "VALUE", "WT%", "P&L $", "P&L%", "SECTOR"].map((h) => (
                <th
                  key={h}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#4A5A6E",
                    letterSpacing: 1.3,
                    textTransform: "uppercase",
                    padding: h === "TICKER" ? "6px 6px 6px 10px" : "6px 6px",
                    textAlign: h === "TICKER" || h === "COMPANY" || h === "SECTOR" ? "left" : "right",
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const level = alertLevel(h.ticker, drawdownAlerts);
              const pnl = (h.currentPrice - h.entryPrice) * h.shares;
              const pnlPct = h.entryPrice > 0 ? ((h.currentPrice - h.entryPrice) / h.entryPrice) * 100 : 0;
              const pnlColor = pnl >= 0 ? "var(--color-green)" : "var(--color-red)";
              return (
                <tr
                  key={h.ticker}
                  style={{
                    borderBottom: "1px solid rgba(28, 40, 64, 0.5)",
                    transition: "background 0.1s",
                    ...(level ? ALERT_ROW_STYLES[level] : {}),
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = level ? ALERT_ROW_STYLES[level].background as string : "var(--color-primary-a03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = level ? ALERT_ROW_STYLES[level].background as string : "transparent")}
                >
                  <td style={{ padding: "6px 6px 6px 10px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: 0.5,
                      }}
                    >
                      {h.ticker}
                    </span>
                  </td>
                  <td
                    style={{
                      fontSize: 10,
                      color: "#5A6B80",
                      padding: "6px 6px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 120,
                    }}
                  >
                    {h.companyName}
                  </td>
                  <td className="font-mono tabular-nums" style={{ fontSize: 10, color: "#6A7A8E", padding: "6px 6px", textAlign: "right" }}>
                    {h.shares}
                  </td>
                  <td className="font-mono tabular-nums" style={{ fontSize: 10, color: "#5A6B80", padding: "6px 6px", textAlign: "right" }}>
                    ${h.entryPrice.toFixed(2)}
                  </td>
                  <td className="font-mono tabular-nums" style={{ fontSize: 10, color: "#C9D1D9", padding: "6px 6px", textAlign: "right" }}>
                    ${(h.currentPrice ?? h.entryPrice).toFixed(2)}
                  </td>
                  <td className="font-mono tabular-nums" style={{ fontSize: 10, fontWeight: 600, color: "#E8EDF2", padding: "6px 6px", textAlign: "right" }}>
                    {formatCurrency(h.value)}
                  </td>
                  <td className="font-mono tabular-nums" style={{ fontSize: 10, color: "#5A6B80", padding: "6px 6px", textAlign: "right" }}>
                    {(h.weightPct ?? 0).toFixed(1)}%
                  </td>
                  <td
                    className="font-mono tabular-nums"
                    style={{ fontSize: 10, fontWeight: 600, color: pnlColor, padding: "6px 6px", textAlign: "right" }}
                  >
                    {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className="font-mono tabular-nums"
                    style={{ fontSize: 10, fontWeight: 700, color: pnlColor, padding: "6px 6px", textAlign: "right" }}
                  >
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      fontSize: 9,
                      color: "#4A5A6E",
                      padding: "6px 6px",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      letterSpacing: 0.3,
                    }}
                  >
                    {h.sector}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sector weights footer */}
      {Object.keys(sectorWeights).length > 0 && (
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid #1C2840",
            background: "#070B14",
            padding: "6px 10px",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "#4A5A6E",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 4,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Sector Exposure
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(sectorWeights)
              .sort(([, a], [, b]) => b - a)
              .map(([sector, pct]) => (
                <span key={sector} style={{ fontSize: 10, color: "#6A7A8E", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {sector}:{" "}
                  <span className="font-mono tabular-nums" style={{ color: "var(--color-primary)", fontWeight: 700 }}>
                    {pct.toFixed(1)}%
                  </span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
