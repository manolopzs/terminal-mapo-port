import { useMemo } from "react";
import type { Holding } from "@shared/schema";

interface TopMoversProps {
  holdings: Holding[];
}

function MoverCard({ holding, type }: { holding: Holding; type: "gainer" | "loser" }) {
  const isGainer = type === "gainer";
  const color = isGainer ? "#00E6A8" : "#FF4458";
  const arrow = isGainer ? "▲" : "▼";
  const label = isGainer ? "GAINER" : "LOSER";
  const changePct = holding.dayChangePct ?? 0;
  const totalPnlPct = holding.gainLossPct ?? 0;
  const totalColor = totalPnlPct >= 0 ? "#00E6A8" : "#FF4458";

  return (
    <div style={{ background: "#0A0E18", border: "1px solid #1A2332", borderRadius: 2, padding: "6px 8px" }}>
      <div style={{ fontSize: 8, color, fontWeight: 600, letterSpacing: 0.8, marginBottom: 2 }}>
        {arrow} {label}
      </div>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#C9D1D9" }}>
          {holding.ticker}
        </span>
        <span className="font-mono tabular-nums" style={{ fontSize: 12, fontWeight: 700, color }}>
          {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 7, color: "#484F58", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>Total P&L</span>
        <span className="font-mono tabular-nums" style={{ fontSize: 9, fontWeight: 600, color: totalColor }}>
          {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function TopMovers({ holdings }: TopMoversProps) {
  const { gainers, losers, upCount, downCount } = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0));
    const up = sorted.filter((h) => (h.dayChangePct ?? 0) > 0);
    const down = sorted.filter((h) => (h.dayChangePct ?? 0) < 0);
    return {
      gainers: sorted.filter((h) => (h.dayChangePct ?? 0) > 0).slice(0, 2),
      losers: sorted.filter((h) => (h.dayChangePct ?? 0) < 0).slice(-2).reverse().sort((a, b) => (a.dayChangePct ?? 0) - (b.dayChangePct ?? 0)),
      upCount: up.length,
      downCount: down.length,
    };
  }, [holdings]);

  return (
    <div className="terminal-panel" style={{ flex: "0.8 1 0", minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Top Movers Today</span>
        <span className="terminal-badge">DAILY</span>
      </div>
      <div style={{ padding: "2px 4px", fontSize: 9, color: "#8B949E", borderBottom: "1px solid #1A2332" }}>
        <span style={{ color: "#00E6A8" }}>▲ {upCount} up</span>
        {"  "}
        <span style={{ color: "#FF4458" }}>▼ {downCount} down</span>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: 4 }}>
        {(gainers.length > 0 || losers.length > 0) ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {gainers.map((m) => (
              <MoverCard key={m.id} holding={m} type="gainer" />
            ))}
            {losers.map((m) => (
              <MoverCard key={m.id} holding={m} type="loser" />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span style={{ fontSize: 9, color: "#8B949E" }}>No movers today</span>
          </div>
        )}
      </div>
    </div>
  );
}
