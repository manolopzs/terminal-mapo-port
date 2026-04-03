import { useMemo } from "react";
import type { Holding } from "@shared/schema";

interface SectorAllocationProps {
  holdings: Holding[];
  totalValue: number;
}

const SECTOR_COLORS: Record<string, string> = {
  "Technology":             "var(--color-primary)",
  "Financials":             "#A371F7",
  "Health Care":            "var(--color-green)",
  "Consumer Discretionary": "var(--color-orange)",
  "Industrials":            "#3B82F6",
  "Energy":                 "#FBBF24",
  "Consumer Staples":       "#6EE7B7",
  "Utilities":              "#F43F5E",
  "Real Estate":            "#FB923C",
  "Materials":              "var(--color-primary)",
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
                background: maxPct >= MAX_SECTOR_PCT ? "var(--color-red-a10)" : "var(--color-orange-a10)",
                color: maxPct >= MAX_SECTOR_PCT ? "var(--color-red)" : "var(--color-orange)",
                border: `1px solid ${maxPct >= MAX_SECTOR_PCT ? "var(--color-red-a20)" : "rgba(240,136,62,0.2)"}`,
                textTransform: "uppercase",
              }}
            >
              {maxPct >= MAX_SECTOR_PCT ? "OVERWEIGHT" : "WATCH"}
            </span>
          )}
          <span className="terminal-badge">{sectors.length} SECTORS</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {sectors.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#3A4A5C", fontSize: 10, fontFamily: "'Inter', system-ui, sans-serif" }}>
            No holdings
          </div>
        ) : (
          sectors.map((sector) => {
            const barWidth = maxPct > 0 ? (sector.pct / maxPct) * 100 : 0;
            const isOver = sector.pct >= MAX_SECTOR_PCT;
            const isWarn = sector.pct >= WARN_SECTOR_PCT && !isOver;
            const displayColor = isOver ? "var(--color-red)" : isWarn ? "var(--color-orange)" : sector.color;

            return (
              <div
                key={sector.name}
                style={{ padding: "8px 12px", borderBottom: "1px solid rgba(28,40,64,0.4)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: displayColor, flexShrink: 0,
                      boxShadow: `0 0 5px ${displayColor}80`,
                    }} />
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: displayColor,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {sector.name}
                    </span>
                    <span style={{ fontSize: 8, color: "#2E3E52", fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                      {sector.tickers.join(" · ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 8 }}>
                    <span className="font-mono tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: displayColor }}>
                      {sector.pct.toFixed(1)}%
                    </span>
                    <span className="font-mono tabular-nums" style={{ fontSize: 9, color: "#3A4A5C", minWidth: 52, textAlign: "right" }}>
                      ${sector.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div style={{ background: "rgba(28,40,64,0.5)", borderRadius: 3, height: 4, overflow: "hidden", position: "relative" }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: isOver
                      ? "linear-gradient(90deg, var(--color-red-a40), var(--color-red))"
                      : isWarn
                        ? "linear-gradient(90deg, var(--color-orange-a10), var(--color-orange))"
                        : `linear-gradient(90deg, ${displayColor}40, ${displayColor})`,
                    transition: "width 0.5s ease",
                  }} />
                  {maxPct > MAX_SECTOR_PCT && (
                    <div style={{
                      position: "absolute", top: 0,
                      left: `${(MAX_SECTOR_PCT / maxPct) * 100}%`,
                      width: 1, height: "100%",
                      background: "var(--color-red-a40)",
                    }} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {sectors.length > 0 && (
        <div style={{
          padding: "6px 12px",
          borderTop: "1px solid #1C2840",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          background: "rgba(0,0,0,0.2)",
        }}>
          <span style={{ fontSize: 8, color: "#3A4A5C", letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Inter', system-ui, sans-serif" }}>
            Max single sector: <span style={{ color: isConcentrated ? (maxPct >= MAX_SECTOR_PCT ? "var(--color-red)" : "var(--color-orange)") : "#6E8098" }}>
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
