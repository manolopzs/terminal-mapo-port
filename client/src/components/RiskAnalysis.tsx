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

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.abs(value) / max, 1) * 100;
  return (
    <div style={{ height: 2, background: "#111827", borderRadius: 1, marginTop: 5, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 1, boxShadow: `0 0 4px ${color}60` }} />
    </div>
  );
}

export function RiskAnalysis({ holdings, analytics }: RiskAnalysisProps) {
  const data = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
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

    const sharpe = analytics?.sharpe ?? null;
    const sortino = analytics?.sortino ?? null;
    const beta = analytics?.beta ?? null;
    const dd = analytics?.maxDrawdown ?? null;
    const vol = analytics?.annualizedVol ?? null;
    const annRet = analytics?.annualizedReturn ?? null;

    let riskScore = 0;
    if (sharpe !== null) riskScore += sharpe < 0 ? 2 : sharpe < 1 ? 1 : 0;
    if (dd !== null) riskScore += dd < -20 ? 2 : dd < -10 ? 1 : 0;
    if (beta !== null) riskScore += beta > 1.5 ? 2 : beta > 1.1 ? 1 : 0;
    if (vol !== null) riskScore += vol > 40 ? 2 : vol > 25 ? 1 : 0;

    const riskLevel = riskScore >= 5 ? "HIGH" : riskScore >= 3 ? "MODERATE" : riskScore >= 1 ? "LOW-MOD" : "LOW";
    const riskColor = riskScore >= 5 ? "var(--color-red)" : riskScore >= 3 ? "var(--color-orange)" : riskScore >= 1 ? "var(--color-primary)" : "var(--color-green)";

    return { sharpe, sortino, beta, dd, vol, annRet, topSector, topSectorPct, riskLevel, riskColor };
  }, [holdings, analytics]);

  const hasData = holdings.length > 0;
  const fmt = (v: number | null, decimals = 2) => v !== null ? v.toFixed(decimals) : "—";

  const sharpeColor = data.sharpe === null ? "#3A4A5C" : data.sharpe >= 1 ? "var(--color-green)" : data.sharpe >= 0 ? "var(--color-primary)" : "var(--color-red)";
  const ddColor = data.dd === null ? "#3A4A5C" : data.dd > -8 ? "var(--color-green)" : data.dd > -15 ? "var(--color-primary)" : "var(--color-red)";
  const betaColor = data.beta === null ? "#3A4A5C" : data.beta <= 1.1 ? "var(--color-green)" : data.beta <= 1.5 ? "var(--color-primary)" : "var(--color-red)";
  const retColor = data.annRet === null ? "#3A4A5C" : data.annRet > 0 ? "var(--color-green)" : "var(--color-red)";
  const sortinoColor = data.sortino === null ? "#3A4A5C" : data.sortino >= 1 ? "var(--color-green)" : "#C9D1D9";
  const concColor = data.topSectorPct > 40 ? "var(--color-orange)" : "#C9D1D9";

  return (
    <div className="terminal-panel" style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Risk Analysis</span>
        <span className="terminal-badge">LIVE</span>
      </div>

      <div style={{ flex: 1, overflow: "hidden", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7 }}>

        {/* Risk level banner */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 10px",
          background: `${data.riskColor}08`,
          border: `1px solid ${data.riskColor}22`,
          borderRadius: 3,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: data.riskColor, boxShadow: `0 0 6px ${data.riskColor}80`, flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: data.riskColor, letterSpacing: 2, textTransform: "uppercase" }}>
              {hasData ? data.riskLevel : "—"} RISK
            </span>
          </div>
          <span style={{ fontSize: 8, color: "#2E3E52", letterSpacing: 1 }}>Portfolio Assessment</span>
        </div>

        {/* 3 primary metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, flexShrink: 0 }}>
          {[
            { label: "Sharpe", value: fmt(data.sharpe), color: sharpeColor, barVal: data.sharpe ?? 0, barMax: 3, sub: "risk-adj." },
            { label: "Beta", value: fmt(data.beta), color: betaColor, barVal: data.beta ?? 0, barMax: 2, sub: "vs S&P 500" },
            { label: "Max DD", value: data.dd !== null ? `${data.dd.toFixed(1)}%` : "—", color: ddColor, barVal: data.dd ?? 0, barMax: 30, sub: "peak-trough" },
          ].map((m) => (
            <div key={m.label} style={{ padding: "7px 8px", background: "#080C14", border: "1px solid #1C2840", borderRadius: 3 }}>
              <div style={{ fontSize: 7, color: "#3A4A5C", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>{m.label}</div>
              <div className="font-mono tabular-nums" style={{ fontSize: 17, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <MiniBar value={m.barVal} max={m.barMax} color={m.color} />
              <div style={{ fontSize: 7, color: "#2A3A4C", marginTop: 3 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* 2x2 secondary grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1C2840", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
          {[
            { label: "ANN. RETURN", value: data.annRet !== null ? `${data.annRet >= 0 ? "+" : ""}${data.annRet.toFixed(1)}%` : "—", color: retColor, sub: "30-day est." },
            { label: "ANN. VOL", value: data.vol !== null ? `${data.vol.toFixed(1)}%` : "—", color: data.vol !== null && data.vol > 40 ? "var(--color-orange)" : "#C9D1D9", sub: "realized" },
            { label: "SORTINO", value: fmt(data.sortino), color: sortinoColor, sub: "downside-adj." },
            { label: "SECTOR CONC.", value: data.topSectorPct > 0 ? `${data.topSectorPct.toFixed(0)}%` : "—", color: concColor, sub: data.topSector.length > 12 ? data.topSector.slice(0, 12) + "…" : data.topSector },
          ].map((m) => (
            <div key={m.label} style={{ padding: "7px 9px", background: "#07090E" }}>
              <div style={{ fontSize: 7, color: "#2E3E52", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>{m.label}</div>
              <div className="font-mono tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
              <div style={{ fontSize: 7, color: "#1E2D3F", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
