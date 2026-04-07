import { useState, useEffect, useRef } from "react";
import { useRebalance, type RebalancePosition, type ValidationCheck } from "@/hooks/use-rebalance";
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

// --- Memo rendering helpers ---

const ACTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BUY: { bg: "rgba(0,200,83,0.12)", border: "rgba(0,200,83,0.4)", text: "#00E6A8" },
  ADD: { bg: "rgba(0,200,83,0.12)", border: "rgba(0,200,83,0.4)", text: "#00E6A8" },
  SELL: { bg: "rgba(255,77,77,0.12)", border: "rgba(255,77,77,0.4)", text: "#FF4458" },
  REDUCE: { bg: "rgba(255,77,77,0.12)", border: "rgba(255,77,77,0.4)", text: "#FF4458" },
  TRIM: { bg: "rgba(255,77,77,0.12)", border: "rgba(255,77,77,0.4)", text: "#FF4458" },
  HOLD: { bg: "rgba(240,136,62,0.12)", border: "rgba(240,136,62,0.4)", text: "#F0883E" },
};

function highlightActionKeywords(text: string): React.ReactNode[] {
  const actionPattern = /\b(BUY|SELL|HOLD|REDUCE|ADD|TRIM)\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = actionPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderInlineFormatting(text.slice(lastIndex, match.index), `pre-${lastIndex}`));
    }
    const keyword = match[1];
    const colors = ACTION_COLORS[keyword] || ACTION_COLORS.HOLD;
    parts.push(
      <span
        key={`action-${match.index}`}
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          borderRadius: 2,
          padding: "1px 5px",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          fontFamily: "monospace",
        }}
      >
        {keyword}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(renderInlineFormatting(text.slice(lastIndex), `post-${lastIndex}`));
  }
  return parts.length > 0 ? parts : [renderInlineFormatting(text, "full")];
}

function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode {
  // Handle **bold** text
  const boldPattern = /\*\*(.+?)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <span key={`${keyPrefix}-b-${match.index}`} style={{ fontWeight: 700, color: "#C9D1D9" }}>
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-e-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line.split("|").slice(1, -1).map(c => c.trim());
}

function MemoRenderer({ memo }: { memo: string }) {
  const lines = memo.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // ## or ### headers
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const level = trimmed.startsWith("### ") ? 3 : 2;
      const text = trimmed.replace(/^#{2,3}\s+/, "");
      elements.push(
        <div
          key={`h-${i}`}
          style={{
            background: "#0A0E18",
            borderLeft: `3px solid ${level === 2 ? "var(--color-primary)" : "#2E3E52"}`,
            padding: level === 2 ? "10px 14px" : "7px 14px",
            marginTop: elements.length > 0 ? 14 : 0,
            marginBottom: 8,
            borderRadius: 2,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: level === 2 ? 11 : 10,
              fontWeight: 700,
              letterSpacing: level === 2 ? 2 : 1.5,
              textTransform: "uppercase",
              color: level === 2 ? "var(--color-primary)" : "#C9D1D9",
            }}
          >
            {text}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Table blocks
    if (isTableRow(trimmed)) {
      const tableRows: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableRows.push(lines[i].trim());
        i++;
      }
      // Separate header, separator, body
      const headerRow = tableRows[0] ? parseTableCells(tableRows[0]) : [];
      const bodyRows = tableRows.filter((r, idx) => idx > 0 && !isTableSeparator(r)).map(parseTableCells);

      elements.push(
        <div key={`table-${i}`} style={{ overflowX: "auto", marginBottom: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#070B14", border: "1px solid #1C2840", borderRadius: 3 }}>
            {headerRow.length > 0 && (
              <thead>
                <tr style={{ background: "#0B0F1A" }}>
                  {headerRow.map((cell, ci) => (
                    <th
                      key={ci}
                      style={{
                        padding: "4px 8px",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: "#4A5A6E",
                        fontFamily: "monospace",
                        borderBottom: "1px solid #1C2840",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #0B0F1A" }}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "4px 8px",
                        fontSize: 10,
                        fontFamily: "monospace",
                        color: "#C9D1D9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {highlightActionKeywords(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet points
    if (/^[-*]\s/.test(trimmed)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        bullets.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <div key={`bullets-${i}`} style={{ marginBottom: 8, paddingLeft: 4 }}>
          {bullets.map((b, bi) => (
            <div
              key={bi}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 3,
                fontFamily: "monospace",
                fontSize: 10,
                color: "#8B949E",
                lineHeight: "1.5",
              }}
            >
              <span style={{ color: "#4A5A6E", flexShrink: 0, marginTop: 1 }}>&#9656;</span>
              <span>{highlightActionKeywords(b)}</span>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // Regular paragraph text
    elements.push(
      <div
        key={`p-${i}`}
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "#8B949E",
          lineHeight: "1.6",
          marginBottom: 6,
        }}
      >
        {highlightActionKeywords(trimmed)}
      </div>
    );
    i++;
  }

  return <div>{elements}</div>;
}

function ConstraintsChecklist({ checks }: { checks: ValidationCheck[] }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {checks.map((check, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: check.passed ? "rgba(0,200,83,0.04)" : "rgba(255,77,77,0.04)",
            border: `1px solid ${check.passed ? "rgba(0,200,83,0.15)" : "rgba(255,77,77,0.15)"}`,
            borderLeft: `3px solid ${check.passed ? "var(--color-green)" : "var(--color-red)"}`,
            borderRadius: 2,
            padding: "5px 10px",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "monospace",
              letterSpacing: 1,
              color: check.passed ? "var(--color-green)" : "var(--color-red)",
              minWidth: 32,
            }}
          >
            {check.passed ? "PASS" : "FAIL"}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              color: "#C9D1D9",
              flex: 1,
            }}
          >
            {check.rule}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              color: "#4A5A6E",
              textAlign: "right",
            }}
          >
            {check.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

function RegimeBadge({ label, value, colorMap }: {
  label: string;
  value: string | undefined | null;
  colorMap: Record<string, string>;
}) {
  const val = value || "UNKNOWN";
  const color = colorMap[val] || "#4A5A6E";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace" }}>
        {label}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          color: color,
          borderRadius: 2,
          padding: "3px 8px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.5,
          fontFamily: "monospace",
          width: "fit-content",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        {val.replace(/_/g, " ")}
      </span>
    </div>
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

  const { positions, totalValue, cashValue, cashPct, targetCashPct, cashAction, cashActionAmount, maxDrawdownAlert, concentrationAlerts, memo, macro, agi, context } = data;

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

            {/* Macro + AGI Context Badges */}
            {(macro || agi) && (
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
                  Intelligence Context
                </div>
                <div style={{ padding: "14px", borderBottom: "1px solid #1C2840" }}>
                  <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                    {macro && (
                      <RegimeBadge
                        label="Macro Regime"
                        value={macro.regime}
                        colorMap={{ RISK_ON: "#00E6A8", RISK_OFF: "#FF4458", NEUTRAL: "#F0883E" }}
                      />
                    )}
                    {agi && (
                      <RegimeBadge
                        label="AGI Thesis"
                        value={agi.status}
                        colorMap={{ ACCELERATING: "#00E6A8", STABLE: "#F0883E", DECELERATING: "#FF4458" }}
                      />
                    )}
                    {agi && agi.confidenceLevel != null && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 9, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace" }}>
                          AGI Confidence
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#C9D1D9" }}>
                          {agi.confidenceLevel}%
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Key events / developments */}
                  {((macro?.keyEvents && macro.keyEvents.length > 0) || (agi?.keyDevelopments && agi.keyDevelopments.length > 0)) && (
                    <div style={{ marginTop: 4 }}>
                      {macro?.keyEvents && macro.keyEvents.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4A5A6E", fontFamily: "monospace", marginBottom: 4 }}>
                            Key Macro Events
                          </div>
                          {macro.keyEvents.map((evt, i) => (
                            <div
                              key={i}
                              style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2, fontFamily: "monospace", fontSize: 9, color: "#8B949E", lineHeight: "1.5" }}
                            >
                              <span style={{ color: "#4A5A6E", flexShrink: 0 }}>&#9656;</span>
                              <span>{evt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {agi?.keyDevelopments && agi.keyDevelopments.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4A5A6E", fontFamily: "monospace", marginBottom: 4 }}>
                            Key AGI Developments
                          </div>
                          {agi.keyDevelopments.map((dev, i) => (
                            <div
                              key={i}
                              style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 2, fontFamily: "monospace", fontSize: 9, color: "#8B949E", lineHeight: "1.5" }}
                            >
                              <span style={{ color: "#4A5A6E", flexShrink: 0 }}>&#9656;</span>
                              <span>{dev}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Constraints Checklist */}
            {context?.validationStatus?.checks && context.validationStatus.checks.length > 0 && (
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Constraints Validation</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: context.validationStatus.passed ? "var(--color-green)" : "var(--color-red)",
                    }}
                  >
                    {context.validationStatus.passed ? "ALL PASS" : "VIOLATIONS DETECTED"}
                  </span>
                </div>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #1C2840" }}>
                  <ConstraintsChecklist checks={context.validationStatus.checks} />
                </div>
              </>
            )}

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

            {/* Claude Memo */}
            {memo && (
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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)", boxShadow: "0 0 6px var(--color-primary)" }} />
                  Claude Portfolio Construction Memo
                </div>
                <div
                  data-rebalance="memo-section"
                  style={{
                    padding: "14px",
                    borderBottom: "1px solid #1C2840",
                  }}
                >
                  <MemoRenderer memo={memo} />
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </>
  );
}
