import { useMemo } from "react";
import type { Holding } from "@shared/schema";

interface SectorAllocationProps {
  holdings: Holding[];
  totalValue: number;
}

const SECTOR_COLORS: Record<string, string> = {
  "Technology":             "#00D9FF",
  "Financials":             "#A371F7",
  "Health Care":            "#00E6A8",
  "Consumer Discretionary": "#F0883E",
  "Industrials":            "#3B82F6",
  "Energy":                 "#FBBF24",
  "Consumer Staples":       "#6EE7B7",
  "Utilities":              "#F43F5E",
  "Real Estate":            "#FB923C",
  "Materials":              "#818CF8",
  "Communication Services": "#38BDF8",
};

function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? "#6B7094";
}

// MAPO rules
const MAX_SECTOR_PCT = 40;
const WARN_SECTOR_PCT = 30;

export function SectorAllocation({ holdings, totalValue }: SectorAllocationProps) {
  const sectors = useMemo(() => {
    const map: Record<string, { value: number; tickers: string[] }> = {};
    for (const h of holdings) {
      const sector = (h as any).sector ?? "Unknown";
      if (!map[sector]) map[sector] = { value: 0, tickers: [] };
      map[sector].value += h.value ?? 0;
      map[sector].tickers.push(h.ticker);
    }
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        value: data.value,
        pct: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        tickers: data.tickers,
        color: sectorColor(name),
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const maxPct = sectors.length > 0 ? Math.max(...sectors.map(s => s.pct)) : 0;
  const topSector = sectors[0];
  const isConcentrated = maxPct >= WARN_SECTOR_PCT;

  return (
    <div className="terminal-panel" style={{ height: "100%" }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Sector Allocation</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isConcentrated && (
            <span
              style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 0.8,
                padding: "2px 6px", borderRadius: 3,
                background: maxPct >= MAX_SECTOR_PCT ? "rgba(255,68,88,0.1)" : "rgba(240,136,62,0.1)",
                color: maxPct >= MAX_SECTOR_PCT ? "#FF4458" : "#F0883E",
                border: `1px solid ${maxPct >= MAX_SECTOR_PCT ? "rgba(255,68,88,0.2)" : "rgba(240,136,62,0.2)"}`,
                textTransform: "uppercase",
              }}
            >
              {maxPct >= MAX_SECTOR_PCT ? "OVERWEIGHT" : "WATCH"}
            </span>
          )}
          <span className="terminal-badge">{sectors.length} SECTORS</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {sectors.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#3A4A5C", fontSize: 10, fontFamily: "'Inter', system-ui, sans-serif" }}>
            No holdings
          </div>
        ) : (
          sectors.map((sector) => {
            const barWidth = maxPct > 0 ? (sector.pct / maxPct) * 100 : 0;
            const isOver = sector.pct >= MAX_SECTOR_PCT;
            const isWarn = sector.pct >= WARN_SECTOR_PCT && !isOver;
            const displayColor = isOver ? "#FF4458" : isWarn ? "#F0883E" : sector.color;

            return (
              <div
                key={sector.name}
                style={{
                  padding: "5px 10px",
                  borderBottom: "1px solid rgba(28,40,64,0.5)",
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: displayColor, flexShrink: 0,
                      boxShadow: `0 0 4px ${displayColor}`,
                    }} />
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: displayColor,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      maxWidth: 110,
                    }}>
                      {sector.name}
                    </span>
                    <span style={{
                      fontSize: 8, color: "#3A4A5C",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      whiteSpace: "nowrap",
                    }}>
                      {sector.tickers.join(", ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className="font-mono tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: displayColor }}>
                      {sector.pct.toFixed(1)}%
                    </span>
                    <span className="font-mono tabular-nums" style={{ fontSize: 9, color: "#4A5A6E", minWidth: 48, textAlign: "right" }}>
                      ${sector.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div style={{ background: "rgba(28,40,64,0.6)", borderRadius: 2, height: 3, overflow: "hidden", position: "relative" }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    borderRadius: 2,
                    background: isOver
                      ? "linear-gradient(90deg, rgba(255,68,88,0.5), #FF4458)"
                      : isWarn
                        ? "linear-gradient(90deg, rgba(240,136,62,0.4), #F0883E)"
                        : `linear-gradient(90deg, ${displayColor}55, ${displayColor})`,
                    transition: "width 0.5s ease",
                  }} />
                  {/* 40% max marker */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: `${(MAX_SECTOR_PCT / maxPct) * 100}%`,
                    width: 1,
                    height: "100%",
                    background: "rgba(255,68,88,0.4)",
                    display: maxPct > MAX_SECTOR_PCT ? "block" : "none",
                  }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {sectors.length > 0 && (
        <div style={{
          padding: "5px 10px",
          borderTop: "1px solid #1C2840",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: "rgba(0,0,0,0.2)",
        }}>
          <span style={{ fontSize: 8, color: "#3A4A5C", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Inter', system-ui, sans-serif" }}>
            Max single sector: <span style={{ color: isConcentrated ? (maxPct >= MAX_SECTOR_PCT ? "#FF4458" : "#F0883E") : "#6E8098" }}>
              {topSector?.pct.toFixed(1)}% {topSector?.name}
            </span>
          </span>
          <span style={{ fontSize: 8, color: "#3A4A5C", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Inter', system-ui, sans-serif" }}>
            Limit 40%
          </span>
        </div>
      )}
    </div>
  );
}
