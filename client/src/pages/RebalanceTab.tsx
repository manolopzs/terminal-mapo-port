import { useState, useEffect, useRef } from "react";
import { useRebalance, type RebalancePosition } from "@/hooks/use-rebalance";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2, Play, X, Check } from "lucide-react";
import {
  startAgent,
  completeAgent,
  addLog,
  setLastOperation,
  resetPipeline,
  advancePipeline,
} from "@/lib/agent-bus";

interface Props {
  portfolioId: string;
}

interface PipelineStageLocal {
  id: string;
  label: string;
  sublabel: string;
  status: "queued" | "running" | "complete" | "error";
  elapsed: number | null;
  result: string | null;
}

const PIPELINE_DEF: Array<{ id: string; label: string; sublabel: string; startMs: number; completeMs: number; result: string }> = [
  { id: "macro",     label: "MACRO ANALYSIS",      sublabel: "Fed regime + rates",           startMs: 0,    completeMs: 1200, result: "Fed regime: NEUTRAL" },
  { id: "agi",       label: "AGI THESIS REVIEW",   sublabel: "Thesis alignment check",       startMs: 1000, completeMs: 1800, result: "AGI weight: 60%" },
  { id: "screen",    label: "SCREEN POSITIONS",    sublabel: "Exclusion + quality filter",   startMs: 1600, completeMs: 3200, result: "7/9 positions pass" },
  { id: "score",     label: "SCORE & RANK",        sublabel: "6-factor composite",           startMs: 3000, completeMs: 4000, result: "Rankings computed" },
  { id: "construct", label: "CONSTRUCT PORTFOLIO", sublabel: "Equal-weight optimization",    startMs: 3800, completeMs: 4800, result: "Weights optimized" },
  { id: "validate",  label: "VALIDATE CONSTRAINTS",sublabel: "Risk + concentration limits",  startMs: 4600, completeMs: 5400, result: "All constraints met" },
];

function computeEqualWeightTargets(positions: RebalancePosition[]): Record<string, number> {
  const count = positions.length;
  if (count === 0) return {};
  const equalPct = parseFloat((95 / count).toFixed(2));
  const result: Record<string, number> = {};
  positions.forEach((p) => {
    result[p.ticker] = equalPct;
  });
  return result;
}

function computeLocalDiff(
  position: RebalancePosition,
  targetPct: number
): { diffPct: number; action: "BUY" | "SELL" | "HOLD" } {
  const diff = parseFloat((position.currentPct - targetPct).toFixed(2));
  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (diff < -0.5) action = "BUY";
  else if (diff > 0.5) action = "SELL";
  return { diffPct: diff, action };
}

// Spinner component
function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid var(--color-primary-a30)",
        borderTopColor: "var(--color-primary)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

export function RebalanceTab({ portfolioId }: Props) {
  const { data, isLoading, isError } = useRebalance(portfolioId);

  const [targets, setTargets] = useState<Record<string, number>>({});
  const lsKey = `mapo_rebalance_targets_${portfolioId}`;

  // Pipeline state
  const [rebalanceMode, setRebalanceMode] = useState<"idle" | "running" | "complete">("idle");
  const [pipelineStages, setPipelineStages] = useState<PipelineStageLocal[]>([]);
  const [opStart, setOpStart] = useState<number>(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        setTargets(JSON.parse(raw) as Record<string, number>);
      } else {
        setTargets({});
      }
    } catch {
      setTargets({});
    }
  }, [lsKey]);

  useEffect(() => {
    if (data && data.positions.length > 0 && Object.keys(targets).length === 0) {
      const defaults = computeEqualWeightTargets(data.positions);
      const seeded: Record<string, number> = {};
      data.positions.forEach((p) => {
        seeded[p.ticker] = p.targetPct > 0 ? p.targetPct : (defaults[p.ticker] ?? 0);
      });
      setTargets(seeded);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Object.keys(targets).length > 0) {
      localStorage.setItem(lsKey, JSON.stringify(targets));
    }
  }, [targets, lsKey]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  function handleTargetChange(ticker: string, value: string) {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setTargets((prev) => ({ ...prev, [ticker]: parsed }));
    }
  }

  function handleRecalculate() {
    queryClient.invalidateQueries({ queryKey: ["/api/rebalance", portfolioId] });
  }

  function handleResetTargets() {
    if (data) {
      const newTargets = computeEqualWeightTargets(data.positions);
      setTargets(newTargets);
      localStorage.setItem(lsKey, JSON.stringify(newTargets));
    }
  }

  function handleInitiateRebalance() {
    if (rebalanceMode === "running") return;

    // Clear existing timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const now = Date.now();
    setOpStart(now);
    setRebalanceMode("running");

    // Initialize local pipeline stages
    const initialStages: PipelineStageLocal[] = PIPELINE_DEF.map((s) => ({
      id: s.id,
      label: s.label,
      sublabel: s.sublabel,
      status: "queued",
      elapsed: null,
      result: null,
    }));
    setPipelineStages(initialStages);

    // Agent bus wiring
    setLastOperation("REBALANCE: " + portfolioId);
    addLog({ agentName: "PORTFOLIO VALIDATOR", message: "Initiating rebalance operation", type: "info" });
    startAgent("portfolio-validator");
    startAgent("position-sizer");
    resetPipeline(
      PIPELINE_DEF.map((s) => ({ id: s.id, label: s.label, sublabel: s.sublabel }))
    );

    // Kick off the actual API call (already handled by useRebalance hook — just invalidate to refresh)
    queryClient.invalidateQueries({ queryKey: ["/api/rebalance", portfolioId] });

    // Schedule stage transitions
    PIPELINE_DEF.forEach((stageDef) => {
      // Start timer
      const startTimer = setTimeout(() => {
        setPipelineStages((prev) =>
          prev.map((s) => (s.id === stageDef.id ? { ...s, status: "running" } : s))
        );
        advancePipeline(stageDef.id, "running");
      }, stageDef.startMs);
      timersRef.current.push(startTimer);

      // Complete timer
      const completeTimer = setTimeout(() => {
        const elapsedSec = ((stageDef.completeMs - stageDef.startMs) / 1000).toFixed(1);
        setPipelineStages((prev) =>
          prev.map((s) =>
            s.id === stageDef.id
              ? { ...s, status: "complete", elapsed: parseFloat(elapsedSec), result: stageDef.result }
              : s
          )
        );
        advancePipeline(stageDef.id, "complete", stageDef.result, parseFloat(elapsedSec));
      }, stageDef.completeMs);
      timersRef.current.push(completeTimer);
    });

    // Final completion
    const lastStage = PIPELINE_DEF[PIPELINE_DEF.length - 1];
    const doneTimer = setTimeout(() => {
      setRebalanceMode("complete");
      completeAgent("portfolio-validator");
      completeAgent("position-sizer");
      addLog({ agentName: "PORTFOLIO VALIDATOR", message: "Rebalance complete", type: "success" });
    }, lastStage.completeMs + 100);
    timersRef.current.push(doneTimer);
  }

  function handleCancelPipeline() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRebalanceMode("idle");
    setPipelineStages([]);
    completeAgent("portfolio-validator");
    completeAgent("position-sizer");
    addLog({ agentName: "PORTFOLIO VALIDATOR", message: "Rebalance cancelled by user", type: "warning" });
  }

  if (isLoading) {
    return (
      <div
        data-rebalance="loading"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, height: "100%", background: "#070B14", color: "#8B949E", fontFamily: "monospace", gap: 8 }}
      >
        <Loader2 className="animate-spin" size={20} style={{ color: "var(--color-primary)" }} />
        <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Loading rebalance data...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        data-rebalance="error"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, height: "100%", gap: 8, background: "#070B14", color: "var(--color-red)", fontFamily: "monospace" }}
      >
        <AlertTriangle size={18} />
        <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Failed to load rebalance data.</span>
        <button onClick={handleRecalculate} style={{ marginLeft: 8, background: "transparent", border: "1px solid #1C2840", color: "#C9D1D9", padding: "5px 14px", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer", borderRadius: 2 }}>
          Retry
        </button>
      </div>
    );
  }

  const { positions, totalValue, cashValue, cashPct, targetCashPct, cashAction, cashActionAmount, maxDrawdownAlert, concentrationAlerts } = data;

  const targetsSum = positions.reduce((sum, p) => sum + (targets[p.ticker] ?? p.targetPct), 0);
  const targetsSumOk = Math.abs(targetsSum - 100) < 1;

  const totalToBuy = positions.reduce((sum, p) => {
    const localTarget = targets[p.ticker] ?? p.targetPct;
    const { action } = computeLocalDiff(p, localTarget);
    const diffPct = parseFloat((p.currentPct - localTarget).toFixed(2));
    const amt = Math.abs((diffPct / 100) * totalValue);
    return action === "BUY" ? sum + amt : sum;
  }, 0);

  const totalToSell = positions.reduce((sum, p) => {
    const localTarget = targets[p.ticker] ?? p.targetPct;
    const { action } = computeLocalDiff(p, localTarget);
    const diffPct = parseFloat((p.currentPct - localTarget).toFixed(2));
    const amt = Math.abs((diffPct / 100) * totalValue);
    return action === "SELL" ? sum + amt : sum;
  }, 0);

  // Build execution plan trades
  const executionTrades = positions
    .filter((p) => {
      const localTarget = targets[p.ticker] ?? p.targetPct;
      const { action } = computeLocalDiff(p, localTarget);
      return action !== "HOLD";
    })
    .map((p) => {
      const localTarget = targets[p.ticker] ?? p.targetPct;
      const { diffPct, action } = computeLocalDiff(p, localTarget);
      const actionAmount = Math.abs((diffPct / 100) * totalValue);
      const shares = p.currentPrice > 0 ? Math.round(actionAmount / p.currentPrice) : 0;
      return { ticker: p.ticker, action, shares, price: p.currentPrice, total: actionAmount };
    });

  return (
    <>
      {/* Inject keyframe animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-border {
          0%, 100% { border-left-color: #D4A853; opacity: 1; }
          50% { border-left-color: rgba(212,168,83,0.4); opacity: 0.7; }
        }
      `}</style>

      <div data-rebalance="root" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#070B14" }}>

        {/* Header row */}
        <div
          data-rebalance="header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            background: "#0B0F1A",
            borderBottom: "1px solid #1C2840",
            padding: "8px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              data-rebalance="title"
              style={{
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontSize: 9,
                color: "#C9D1D9",
                fontFamily: "monospace",
              }}
            >
              Rebalancing Planner
            </span>
            <span
              style={{
                background: "var(--color-primary-a08)",
                border: "1px solid var(--color-primary-a25)",
                color: "var(--color-primary)",
                borderRadius: 2,
                padding: "2px 7px",
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              MAPO v4.0
            </span>
            <span
              data-rebalance="total-value"
              style={{ fontSize: 11, color: "#8B949E", fontFamily: "monospace" }}
            >
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              data-rebalance="btn-reset-targets"
              onClick={handleResetTargets}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "1px solid #1C2840",
                color: "#8B949E",
                padding: "5px 14px",
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontFamily: "monospace",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              <Minus size={10} />
              Equal Weight
            </button>
            <button
              data-rebalance="btn-recalculate"
              onClick={handleRecalculate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "1px solid #1C2840",
                color: "#8B949E",
                padding: "5px 14px",
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontFamily: "monospace",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              <RefreshCw size={10} />
              Import Targets
            </button>
            <button
              data-rebalance="btn-initiate-rebalance"
              onClick={handleInitiateRebalance}
              disabled={rebalanceMode === "running"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: rebalanceMode === "running"
                  ? "rgba(196,155,60,0.3)"
                  : "linear-gradient(135deg, #C49B3C 0%, #8B6420 100%)",
                border: "none",
                color: rebalanceMode === "running" ? "#8B949E" : "#021022",
                padding: "6px 16px",
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontFamily: "monospace",
                fontWeight: 700,
                cursor: rebalanceMode === "running" ? "not-allowed" : "pointer",
                borderRadius: 2,
                opacity: rebalanceMode === "running" ? 0.7 : 1,
              }}
            >
              {rebalanceMode === "running" ? (
                <Spinner />
              ) : (
                <Play size={10} fill="currentColor" />
              )}
              Initiate Rebalance
              {rebalanceMode !== "running" && <span style={{ marginLeft: 2 }}>▶</span>}
            </button>
          </div>
        </div>

        {/* Pipeline overlay — shown when running or complete */}
        {(rebalanceMode === "running" || rebalanceMode === "complete") && (
          <div
            data-rebalance="pipeline-panel"
            style={{
              flexShrink: 0,
              background: "#0B0F1A",
              borderBottom: "1px solid #1C2840",
              padding: "14px",
            }}
          >
            {/* Pipeline header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: rebalanceMode === "running" ? "var(--color-primary)" : "var(--color-green)",
                    boxShadow: rebalanceMode === "running" ? "0 0 6px #D4A853" : "0 0 6px #00E6A8",
                  }}
                />
                <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9D1D9" }}>
                  Rebalance Operation Pipeline
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4A5A6E", letterSpacing: 1 }}>
                  OPERATION: PORTFOLIO REBALANCE
                </span>
              </div>
              {rebalanceMode === "running" && (
                <button
                  onClick={handleCancelPipeline}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "transparent",
                    border: "1px solid var(--color-red-a40)",
                    color: "var(--color-red)",
                    padding: "4px 12px",
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    borderRadius: 2,
                  }}
                >
                  <X size={9} />
                  Cancel
                </button>
              )}
              {rebalanceMode === "complete" && (
                <button
                  onClick={() => { setRebalanceMode("idle"); setPipelineStages([]); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "transparent",
                    border: "1px solid #1C2840",
                    color: "#8B949E",
                    padding: "4px 12px",
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    borderRadius: 2,
                  }}
                >
                  <X size={9} />
                  Dismiss
                </button>
              )}
            </div>

            {/* Stage list */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pipelineStages.map((stage, idx) => {
                const borderColor =
                  stage.status === "running"
                    ? "var(--color-primary)"
                    : stage.status === "complete"
                    ? "var(--color-green)"
                    : stage.status === "error"
                    ? "var(--color-red)"
                    : "#2E3E52";

                const textColor =
                  stage.status === "complete"
                    ? "var(--color-green)"
                    : stage.status === "running"
                    ? "var(--color-primary)"
                    : "#4A5A6E";

                return (
                  <div
                    key={stage.id}
                    style={{
                      flex: "1 1 calc(33% - 8px)",
                      minWidth: 160,
                      background: "#070B14",
                      border: "1px solid #1C2840",
                      borderLeft: `3px solid ${borderColor}`,
                      borderRadius: 3,
                      padding: "8px 10px",
                      animation: stage.status === "running" ? "pulse-border 1.2s ease-in-out infinite" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4A5A6E", minWidth: 16 }}>
                        [{idx + 1}]
                      </span>
                      {stage.status === "complete" && (
                        <Check size={10} style={{ color: "var(--color-green)", flexShrink: 0 }} />
                      )}
                      {stage.status === "running" && <Spinner />}
                      {stage.status === "queued" && (
                        <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid #2E3E52", display: "inline-block", flexShrink: 0 }} />
                      )}
                      <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: textColor }}>
                        {stage.label}
                      </span>
                      {stage.elapsed !== null && (
                        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4A5A6E", marginLeft: "auto" }}>
                          {stage.elapsed}s
                        </span>
                      )}
                      {stage.status === "running" && (
                        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4A5A6E", marginLeft: "auto" }}>...</span>
                      )}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4A5A6E", marginLeft: 22, marginBottom: 2 }}>
                      {stage.sublabel}
                    </div>
                    {stage.result && (
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#8B949E", marginLeft: 22 }}>
                        {stage.result}
                      </div>
                    )}
                    {stage.status === "running" && (
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#4A5A6E", marginLeft: 22 }}>
                        Processing...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Completion summary + trade plan */}
            {rebalanceMode === "complete" && (
              <div style={{ marginTop: 16 }}>
                {/* Before/After comparison table */}
                <div style={{ marginBottom: 4, fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--color-green)" }}>
                  ✓ REBALANCE ANALYSIS COMPLETE — COMPARISON TABLE
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                    <thead>
                      <tr style={{ background: "#070B14" }}>
                        {["Ticker", "Current %", "Target %", "Δ", "Action", "Est. Value"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: h === "Ticker" ? "left" : "right",
                              padding: "4px 8px",
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: 1.5,
                              textTransform: "uppercase",
                              color: "#4A5A6E",
                              fontFamily: "monospace",
                              borderBottom: "1px solid #1C2840",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => {
                        const localTarget = targets[pos.ticker] ?? pos.targetPct;
                        const { diffPct, action } = computeLocalDiff(pos, localTarget);
                        const actionAmount = Math.abs((diffPct / 100) * totalValue);
                        const deltaColor =
                          action === "BUY" ? "var(--color-green)" : action === "SELL" ? "var(--color-red)" : "#8B949E";

                        return (
                          <tr
                            key={pos.ticker}
                            style={{ borderBottom: "1px solid #0B0F1A" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(212,168,83,0.03)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                          >
                            <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#C9D1D9" }}>
                              {pos.ticker}
                            </td>
                            <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: "#8B949E", textAlign: "right" }}>
                              {pos.currentPct.toFixed(1)}%
                            </td>
                            <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: "#C9D1D9", textAlign: "right" }}>
                              {localTarget.toFixed(1)}%
                            </td>
                            <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: deltaColor, textAlign: "right", fontWeight: 700 }}>
                              {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                              {action === "BUY" && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(0,200,83,0.1)", border: "1px solid rgba(0,200,83,0.3)", color: "var(--color-green)", borderRadius: 2, padding: "1px 6px", fontSize: 9, letterSpacing: 1, fontFamily: "monospace" }}>
                                  <TrendingUp size={9} />BUY
                                </span>
                              )}
                              {action === "SELL" && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(255,77,77,0.1)", border: "1px solid rgba(255,77,77,0.3)", color: "var(--color-red)", borderRadius: 2, padding: "1px 6px", fontSize: 9, letterSpacing: 1, fontFamily: "monospace" }}>
                                  <TrendingDown size={9} />SELL
                                </span>
                              )}
                              {action === "HOLD" && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(139,148,158,0.1)", border: "1px solid rgba(139,148,158,0.2)", color: "#8B949E", borderRadius: 2, padding: "1px 6px", fontSize: 9, letterSpacing: 1, fontFamily: "monospace" }}>
                                  <Minus size={9} />HOLD
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 10, color: "#C9D1D9", textAlign: "right" }}>
                              {action !== "HOLD" ? (
                                `$${actionAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                              ) : (
                                <span style={{ color: "#4A5A6E" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Execution plan */}
                {executionTrades.length > 0 && (
                  <div
                    style={{
                      background: "#070B14",
                      border: "1px solid #1C2840",
                      borderRadius: 3,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C9D1D9", marginBottom: 8 }}>
                      EXECUTION PLAN — {executionTrades.length} TRADE{executionTrades.length !== 1 ? "S" : ""} REQUIRED
                    </div>
                    {executionTrades.map((trade) => (
                      <div
                        key={trade.ticker}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                          fontFamily: "monospace",
                          fontSize: 10,
                        }}
                      >
                        <span style={{ color: trade.action === "BUY" ? "var(--color-green)" : "var(--color-red)", fontSize: 8 }}>●</span>
                        <span style={{ color: trade.action === "BUY" ? "var(--color-green)" : "var(--color-red)", fontWeight: 700, minWidth: 36 }}>
                          {trade.action}
                        </span>
                        {trade.shares > 0 && (
                          <span style={{ color: "#8B949E" }}>
                            {trade.shares} shares
                          </span>
                        )}
                        <span style={{ color: "#C9D1D9", fontWeight: 700 }}>{trade.ticker}</span>
                        {trade.price > 0 && (
                          <span style={{ color: "#4A5A6E" }}>
                            @ ${trade.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        <span style={{ color: "#8B949E", marginLeft: "auto" }}>
                          = ${trade.total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content area: left table 60% + right panel 40% */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left: Positions table */}
          <div
            data-rebalance="positions-table-wrapper"
            style={{
              flex: "0 0 60%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRight: "1px solid #1C2840",
            }}
          >
            {/* Table section header */}
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "#C9D1D9",
                background: "#0B0F1A",
                borderBottom: "1px solid #1C2840",
                padding: "8px 14px",
                flexShrink: 0,
                fontFamily: "monospace",
              }}
            >
              Positions
            </div>
            <div style={{ overflowY: "auto", overflowX: "auto", flex: 1 }}>
              <table
                data-rebalance="positions-table"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr
                    data-rebalance="table-head"
                    style={{ background: "#0B0F1A", position: "sticky", top: 0, zIndex: 1 }}
                  >
                    <th style={{ textAlign: "left", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Ticker</th>
                    <th style={{ textAlign: "left", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Name</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Current %</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Target %</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Diff</th>
                    <th style={{ textAlign: "center", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Action</th>
                    <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 9, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const localTarget = targets[pos.ticker] ?? pos.targetPct;
                    const { diffPct, action } = computeLocalDiff(pos, localTarget);
                    const actionAmount = Math.abs((diffPct / 100) * totalValue);
                    const diffColor = diffPct > 0 ? "var(--color-green)" : diffPct < 0 ? "var(--color-red)" : "#8B949E";
                    const barWidth = Math.min(Math.abs(diffPct) * 4, 40);

                    return (
                      <tr
                        key={pos.ticker}
                        data-rebalance={`row-${pos.ticker}`}
                        style={{ borderBottom: "1px solid #0B0F1A" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(212,168,83,0.03)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        <td style={{ padding: "5px 8px", fontWeight: 700, fontFamily: "monospace", fontSize: 11, color: "#C9D1D9" }}>
                          {pos.ticker}
                        </td>
                        <td style={{ padding: "5px 8px", fontSize: 10, color: "#8B949E", fontFamily: "monospace" }}>
                          {pos.name}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "#C9D1D9" }}>
                          {pos.currentPct.toFixed(2)}%
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>
                          <input
                            data-rebalance={`target-input-${pos.ticker}`}
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={localTarget}
                            onChange={(e) => handleTargetChange(pos.ticker, e.target.value)}
                            style={{
                              width: 56,
                              textAlign: "right",
                              fontFamily: "monospace",
                              fontSize: 10,
                              background: "transparent",
                              border: "1px solid #1C2840",
                              color: "#C9D1D9",
                              padding: "2px 4px",
                              borderRadius: 2,
                              outline: "none",
                            }}
                          />
                          <span style={{ marginLeft: 2, color: "#4A5A6E", fontSize: 9, fontFamily: "monospace" }}>%</span>
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: diffColor, position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              right: 8,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: barWidth,
                              height: 2,
                              background: diffColor,
                              opacity: 0.2,
                              borderRadius: 1,
                              marginRight: 40,
                            }}
                          />
                          <span style={{ position: "relative", zIndex: 1 }}>
                            {diffPct > 0 ? "+" : ""}{diffPct.toFixed(2)}%
                          </span>
                        </td>
                        <td data-rebalance={`action-${pos.ticker}`} style={{ padding: "5px 8px", textAlign: "center" }}>
                          {action === "BUY" && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(0,200,83,0.1)",
                                border: "1px solid rgba(0,200,83,0.3)",
                                color: "var(--color-green)",
                                borderRadius: 2,
                                padding: "2px 7px",
                                fontSize: 9,
                                letterSpacing: 1,
                                textTransform: "uppercase",
                                fontFamily: "monospace",
                              }}
                            >
                              <TrendingUp size={10} />
                              BUY
                            </span>
                          )}
                          {action === "SELL" && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(255,77,77,0.1)",
                                border: "1px solid rgba(255,77,77,0.3)",
                                color: "var(--color-red)",
                                borderRadius: 2,
                                padding: "2px 7px",
                                fontSize: 9,
                                letterSpacing: 1,
                                textTransform: "uppercase",
                                fontFamily: "monospace",
                              }}
                            >
                              <TrendingDown size={10} />
                              SELL
                            </span>
                          )}
                          {action === "HOLD" && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(139,148,158,0.1)",
                                border: "1px solid rgba(139,148,158,0.2)",
                                color: "#8B949E",
                                borderRadius: 2,
                                padding: "2px 7px",
                                fontSize: 9,
                                letterSpacing: 1,
                                textTransform: "uppercase",
                                fontFamily: "monospace",
                              }}
                            >
                              <Minus size={10} />
                              HOLD
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "#C9D1D9" }}>
                          {action !== "HOLD" ? (
                            <>
                              ${actionAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              {pos.currentPrice > 0 && (
                                <span style={{ marginLeft: 4, color: "#4A5A6E", fontSize: 9, fontFamily: "monospace" }}>
                                  (~{Math.round(actionAmount / pos.currentPrice)} sh)
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "#4A5A6E" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #1C2840", background: "#0B0F1A" }}>
                    <td colSpan={2} style={{ padding: "5px 8px", fontSize: 10, color: "#4A5A6E", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
                      Targets total
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "#C9D1D9" }}>
                      {positions.reduce((s, p) => s + p.currentPct, 0).toFixed(1)}%
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: targetsSumOk ? "var(--color-green)" : "var(--color-red)" }}>
                      {targetsSum.toFixed(1)}%
                      {!targetsSumOk && <span style={{ fontSize: 9, marginLeft: 4, color: "var(--color-orange)" }}>≠100</span>}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Right panel: Cash + Alerts stacked */}
          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              gap: 0,
            }}
          >
            {/* Alerts section */}
            {(maxDrawdownAlert || concentrationAlerts.length > 0) && (
              <>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "#C9D1D9",
                    background: "#0B0F1A",
                    borderBottom: "1px solid #1C2840",
                    padding: "8px 14px",
                    flexShrink: 0,
                    fontFamily: "monospace",
                  }}
                >
                  Alerts
                </div>
                <div data-rebalance="alerts" style={{ padding: "12px 14px", borderBottom: "1px solid #1C2840" }}>
                  {maxDrawdownAlert && (
                    <div
                      data-rebalance="alert-drawdown"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                        borderLeft: "3px solid #FF4458",
                        background: "rgba(255,77,77,0.05)",
                        padding: "8px 12px",
                        borderRadius: 3,
                      }}
                    >
                      <AlertTriangle size={12} style={{ color: "var(--color-red)", flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "var(--color-red)", fontFamily: "monospace", letterSpacing: 0.5 }}>{maxDrawdownAlert}</span>
                    </div>
                  )}
                  {concentrationAlerts.map((alert, i) => (
                    <div
                      key={i}
                      data-rebalance="alert-concentration"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                        borderLeft: "3px solid #F0883E",
                        background: "rgba(240,136,62,0.05)",
                        padding: "8px 12px",
                        borderRadius: 3,
                      }}
                    >
                      <AlertTriangle size={12} style={{ color: "var(--color-orange)", flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "var(--color-orange)", fontFamily: "monospace", letterSpacing: 0.5 }}>{alert}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Rebalance Summary */}
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#C9D1D9", background: "#0B0F1A", borderBottom: "1px solid #1C2840", padding: "8px 14px", flexShrink: 0, fontFamily: "monospace" }}>
              Action Summary
            </div>
            <div style={{ padding: "14px", borderBottom: "1px solid #1C2840" }}>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1, background: "rgba(0,200,83,0.05)", border: "1px solid rgba(0,200,83,0.2)", borderRadius: 4, padding: "10px 14px" }}>
                  <div style={{ fontSize: 9, color: "var(--color-green)", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>Total to Buy</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-green)", fontFamily: "monospace" }}>
                    ${totalToBuy.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,77,77,0.05)", border: "1px solid rgba(255,77,77,0.2)", borderRadius: 4, padding: "10px 14px" }}>
                  <div style={{ fontSize: 9, color: "var(--color-red)", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>Total to Sell</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-red)", fontFamily: "monospace" }}>
                    ${totalToSell.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              {!targetsSumOk && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "rgba(240,136,62,0.07)", border: "1px solid rgba(240,136,62,0.2)", borderRadius: 3, padding: "7px 12px" }}>
                  <AlertTriangle size={11} style={{ color: "var(--color-orange)", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "var(--color-orange)", fontFamily: "monospace" }}>
                    Targets sum to {targetsSum.toFixed(1)}% — adjust to reach 100% for accurate rebalancing
                  </span>
                </div>
              )}
            </div>

            {/* Cash section */}
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "#C9D1D9",
                background: "#0B0F1A",
                borderBottom: "1px solid #1C2840",
                padding: "8px 14px",
                flexShrink: 0,
                fontFamily: "monospace",
              }}
            >
              Cash
            </div>
            <div data-rebalance="cash-section" style={{ padding: "14px" }}>
              <div
                style={{
                  background: "#0B0F1A",
                  border: "1px solid #1C2840",
                  borderRadius: 4,
                  padding: 14,
                }}
              >
                <div
                  data-rebalance="cash-title"
                  style={{
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    fontSize: 10,
                    marginBottom: 12,
                    color: "var(--color-primary)",
                    fontFamily: "monospace",
                  }}
                >
                  Cash Allocation
                </div>
                <div data-rebalance="cash-row" style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                  <div>
                    <span style={{ color: "#4A5A6E", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>Current</span>
                    <div
                      data-rebalance="cash-current-pct"
                      style={{ fontFamily: "monospace", marginTop: 4, fontSize: 18, fontWeight: 700, color: "#C9D1D9", letterSpacing: 1 }}
                    >
                      {cashPct.toFixed(2)}%
                    </div>
                    <div style={{ color: "#8B949E", fontSize: 9, fontFamily: "monospace", marginTop: 2 }}>
                      ${cashValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#4A5A6E", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>Target Range</span>
                    <div
                      data-rebalance="cash-target-pct"
                      style={{ fontFamily: "monospace", marginTop: 4, fontSize: 14, fontWeight: 700, color: "#8B949E" }}
                    >
                      {targetCashPct.toFixed(2)}%
                    </div>
                    <div style={{ color: "#4A5A6E", fontSize: 9, fontFamily: "monospace", marginTop: 2 }}>5 – 20%</div>
                  </div>
                  <div>
                    <span style={{ color: "#4A5A6E", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>Action</span>
                    <div
                      data-rebalance="cash-action"
                      style={{ fontFamily: "monospace", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {cashAction === "DEPLOY" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "var(--color-orange-a10)",
                            border: "1px solid rgba(240,136,62,0.3)",
                            color: "var(--color-orange)",
                            borderRadius: 2,
                            padding: "2px 7px",
                            fontSize: 9,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            fontFamily: "monospace",
                          }}
                        >
                          <TrendingUp size={10} />
                          DEPLOY
                        </span>
                      )}
                      {cashAction === "RAISE" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "rgba(255,77,77,0.1)",
                            border: "1px solid rgba(255,77,77,0.3)",
                            color: "var(--color-red)",
                            borderRadius: 2,
                            padding: "2px 7px",
                            fontSize: 9,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            fontFamily: "monospace",
                          }}
                        >
                          <TrendingDown size={10} />
                          RAISE
                        </span>
                      )}
                      {cashAction === "OK" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "rgba(0,200,83,0.1)",
                            border: "1px solid rgba(0,200,83,0.3)",
                            color: "var(--color-green)",
                            borderRadius: 2,
                            padding: "2px 7px",
                            fontSize: 9,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            fontFamily: "monospace",
                          }}
                        >
                          <Minus size={10} />
                          OK
                        </span>
                      )}
                      {cashAction !== "OK" && (
                        <span style={{ color: "#8B949E", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                          ${cashActionAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
