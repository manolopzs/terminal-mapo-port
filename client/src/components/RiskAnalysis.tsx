import { useMemo } from "react";
import type { Holding } from "@shared/schema";

interface RiskAnalysisProps {
  holdings: Holding[];
  analytics?: {
    sharpe: number | null;
    sortino: number | null;
    beta: number | null;
    maxDrawdown: number | null;
    annualizedReturn: number | null;
    annualizedVol: number | null;
  };
}

export function RiskAnalysis({ holdings, analytics }: RiskAnalysisProps) {
  const metrics = useMemo(() => {
    if (holdings.length === 0) {
      return [
        { label: "ANNUALIZED RETURN", value: "—", sub: "30-day est.", color: "#C9D1D9" },
        { label: "ANNUALIZED VOL", value: "—", sub: "30-day realized", color: "#C9D1D9" },
        { label: "MAX DRAWDOWN", value: "—", sub: "Peak to trough", color: "#C9D1D9" },
        { label: "TOP CONCENTRATION", value: "—", sub: "No holdings", color: "#C9D1D9" },
        { label: "PORTFOLIO BETA", value: "—", sub: "vs S&P 500", color: "#C9D1D9" },
        { label: "SHARPE RATIO", value: "—", sub: "Risk-adj. return", color: "#C9D1D9" },
        { label: "SORTINO RATIO", value: "—", sub: "Downside risk-adj.", color: "#C9D1D9" },
      ];
    }

    const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);

    // Top concentration - largest sector %
    const sectorMap = new Map<string, number>();
    holdings.forEach((h) => {
      const sec = h.sector || "Other";
      sectorMap.set(sec, (sectorMap.get(sec) || 0) + (h.value ?? 0));
    });
    let topSector = "—";
    let topSectorPct = 0;
    sectorMap.forEach((val, key) => {
      const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
      if (pct > topSectorPct) { topSectorPct = pct; topSector = key; }
    });

    const vol = analytics?.annualizedVol != null ? `${analytics.annualizedVol.toFixed(1)}%` : "—";
    const dd = analytics?.maxDrawdown != null ? `${analytics.maxDrawdown.toFixed(1)}%` : "—";
    const beta = analytics?.beta != null ? analytics.beta.toFixed(2) : "—";
    const sharpe = analytics?.sharpe != null ? analytics.sharpe.toFixed(2) : "—";
    const sortino = analytics?.sortino != null ? analytics.sortino.toFixed(2) : "—";
    const annRet = analytics?.annualizedReturn != null
      ? `${analytics.annualizedReturn >= 0 ? "+" : ""}${analytics.annualizedReturn.toFixed(1)}%`
      : "—";

    const ddNum = analytics?.maxDrawdown ?? 0;
    const sharpeNum = analytics?.sharpe ?? 0;
    const annRetNum = analytics?.annualizedReturn ?? 0;

    return [
      { label: "ANNUALIZED RETURN", value: annRet, sub: "30-day est.", color: annRetNum > 0 ? "#00E6A8" : annRetNum < 0 ? "#FF4458" : "#C9D1D9" },
      { label: "ANNUALIZED VOL", value: vol, sub: "30-day realized", color: "#C9D1D9" },
      { label: "MAX DRAWDOWN", value: dd, sub: "Peak to trough", color: ddNum < -15 ? "#FF4458" : ddNum < -8 ? "#F0883E" : "#00E6A8" },
      { label: "TOP CONCENTRATION", value: `${topSectorPct.toFixed(0)}%`, sub: topSector, color: topSectorPct > 40 ? "#F0883E" : "#C9D1D9" },
      { label: "PORTFOLIO BETA", value: beta, sub: "vs S&P 500", color: "#C9D1D9" },
      { label: "SHARPE RATIO", value: sharpe, sub: "Risk-adj. return", color: sharpeNum >= 1 ? "#00E6A8" : sharpeNum >= 0 ? "#F0883E" : "#FF4458" },
      { label: "SORTINO RATIO", value: sortino, sub: "Downside risk-adj.", color: "#C9D1D9" },
    ];
  }, [holdings, analytics]);

  return (
    <div className="terminal-panel" style={{ flex: "1 1 0", minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Risk Analysis</span>
        <span className="terminal-badge">LIVE CALC</span>
      </div>
      <div
        className="flex-1 overflow-auto"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: 0 }}
      >
        {metrics.map((m, i) => (
          <div
            key={m.label}
            style={{
              padding: "8px 10px",
              borderRight: i % 2 === 0 ? "1px solid #1C2840" : "none",
              borderBottom: Math.floor(i / 2) < Math.floor((metrics.length - 1) / 2) ? "1px solid #1C2840" : "none",
            }}
          >
            <div style={{ fontSize: 8, color: "#8B949E", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>
              {m.label}
            </div>
            <div className="font-mono tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: m.color ?? "#FFFFFF", lineHeight: 1.2 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 8, color: "#8B949E", marginTop: 1 }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
