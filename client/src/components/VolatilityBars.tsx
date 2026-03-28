import { useMemo } from "react";
import type { Holding } from "@shared/schema";

interface VolatilityBarsProps {
  holdings: Holding[];
  volatilityData?: Record<string, number>;
}

export function VolatilityBars({ holdings, volatilityData }: VolatilityBarsProps) {
  const volData = useMemo(() => {
    return holdings
      .map((h) => ({
        ticker: h.ticker,
        vol: volatilityData?.[h.ticker] ?? null,
      }))
      .filter(d => d.vol !== null)
      .sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0)) as { ticker: string; vol: number }[];
  }, [holdings, volatilityData]);

  const maxVol = volData.length > 0 ? Math.max(...volData.map((d) => d.vol)) : 100;

  if (volData.length === 0) {
    return (
      <div className="terminal-panel" style={{ flex: "1 1 0", minHeight: 0 }}>
        <div className="terminal-panel-header">
          <span className="terminal-panel-title">Volatility</span>
          <span className="terminal-badge">30-DAY REALIZED</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span style={{ fontSize: 9, color: "#8B949E" }}>Loading price data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel" style={{ flex: "1 1 0", minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Volatility</span>
        <span className="terminal-badge">30-DAY REALIZED</span>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: "4px 8px" }}>
        {volData.map((d) => {
          const pct = (d.vol / maxVol) * 100;
          const color = d.vol > 60 ? "#FF4458" : d.vol > 35 ? "#F0883E" : "#00D9FF";
          return (
            <div key={d.ticker} className="flex items-center gap-2" style={{ marginBottom: 2, height: 16 }}>
              <span className="font-mono" style={{ fontSize: 8, fontWeight: 600, color: "#00D9FF", width: 36, textAlign: "right", flexShrink: 0 }}>
                {d.ticker}
              </span>
              <div style={{ flex: 1, height: 8, background: "#1C2840", borderRadius: 1 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}44, ${color})`, borderRadius: 1 }} />
              </div>
              <span className="font-mono tabular-nums" style={{ fontSize: 8, color: color, width: 30, textAlign: "right", flexShrink: 0 }}>
                {d.vol.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
