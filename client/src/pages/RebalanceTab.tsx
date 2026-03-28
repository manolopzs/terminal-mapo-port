import { useState, useEffect } from "react";
import { useRebalance, type RebalancePosition } from "@/hooks/use-rebalance";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface Props {
  portfolioId: string;
}

function computeEqualWeightTargets(positions: RebalancePosition[]): Record<string, number> {
  // Min 5% cash reserve means max 95% to equity positions
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

export function RebalanceTab({ portfolioId }: Props) {
  const { data, isLoading, isError } = useRebalance(portfolioId);

  // Target allocations keyed by ticker — initialised from server data
  const [targets, setTargets] = useState<Record<string, number>>({});

  // localStorage key scoped by portfolioId
  const lsKey = `mapo_rebalance_targets_${portfolioId}`;

  // On mount or when portfolioId changes, load saved targets from localStorage
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

  // When server data arrives and we have no local targets yet, seed equal-weight defaults
  useEffect(() => {
    if (data && data.positions.length > 0 && Object.keys(targets).length === 0) {
      const defaults = computeEqualWeightTargets(data.positions);
      // Use server targetPct if available, otherwise equal-weight
      const seeded: Record<string, number> = {};
      data.positions.forEach((p) => {
        seeded[p.ticker] = p.targetPct > 0 ? p.targetPct : (defaults[p.ticker] ?? 0);
      });
      setTargets(seeded);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist targets to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(targets).length > 0) {
      localStorage.setItem(lsKey, JSON.stringify(targets));
    }
  }, [targets, lsKey]);

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

  if (isLoading) {
    return (
      <div
        data-rebalance="loading"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, height: "100%", background: "#070B14", color: "#8B949E", fontFamily: "monospace", gap: 8 }}
      >
        <Loader2 className="animate-spin" size={20} style={{ color: "#00D9FF" }} />
        <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Loading rebalance data...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        data-rebalance="error"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, height: "100%", gap: 8, background: "#070B14", color: "#FF4458", fontFamily: "monospace" }}
      >
        <AlertTriangle size={18} />
        <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Failed to load rebalance data.</span>
        <button onClick={handleRecalculate} style={{ marginLeft: 8, background: "transparent", border: "1px solid #1C2840", color: "#C9D1D9", padding: "5px 14px", fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer", borderRadius: 2 }}>
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

  return (
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
              background: "rgba(0,217,255,0.08)",
              border: "1px solid rgba(0,217,255,0.25)",
              color: "#00D9FF",
              borderRadius: 2,
              padding: "2px 7px",
              fontSize: 7,
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
        <div style={{ display: "flex", gap: 8 }}>
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
              fontSize: 8,
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
              fontSize: 8,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontFamily: "monospace",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            <RefreshCw size={10} />
            Recalculate
          </button>
        </div>
      </div>

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
                  <th style={{ textAlign: "left", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Ticker</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Name</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Current %</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Target %</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Diff</th>
                  <th style={{ textAlign: "center", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Action</th>
                  <th style={{ textAlign: "right", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 8, fontWeight: 700, color: "#4A5A6E", fontFamily: "monospace", borderBottom: "1px solid #1C2840" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const localTarget = targets[pos.ticker] ?? pos.targetPct;
                  const { diffPct, action } = computeLocalDiff(pos, localTarget);
                  const actionAmount = Math.abs((diffPct / 100) * totalValue);
                  const diffColor = diffPct > 0 ? "#00E6A8" : diffPct < 0 ? "#FF4458" : "#8B949E";
                  const barWidth = Math.min(Math.abs(diffPct) * 4, 40);

                  return (
                    <tr
                      key={pos.ticker}
                      data-rebalance={`row-${pos.ticker}`}
                      style={{ borderBottom: "1px solid #0B0F1A" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(0,217,255,0.03)"; }}
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
                              color: "#00E6A8",
                              borderRadius: 2,
                              padding: "2px 7px",
                              fontSize: 7,
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
                              color: "#FF4458",
                              borderRadius: 2,
                              padding: "2px 7px",
                              fontSize: 7,
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
                              fontSize: 7,
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
                  <td colSpan={2} style={{ padding: "5px 8px", fontSize: 8, color: "#4A5A6E", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
                    Targets total
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "#C9D1D9" }}>
                    {positions.reduce((s, p) => s + p.currentPct, 0).toFixed(1)}%
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: targetsSumOk ? "#00E6A8" : "#FF4458" }}>
                    {targetsSum.toFixed(1)}%
                    {!targetsSumOk && <span style={{ fontSize: 7, marginLeft: 4, color: "#F0883E" }}>≠100</span>}
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
                    <AlertTriangle size={12} style={{ color: "#FF4458", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#FF4458", fontFamily: "monospace", letterSpacing: 0.5 }}>{maxDrawdownAlert}</span>
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
                    <AlertTriangle size={12} style={{ color: "#F0883E", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#F0883E", fontFamily: "monospace", letterSpacing: 0.5 }}>{alert}</span>
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
                <div style={{ fontSize: 7, color: "#00E6A8", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>Total to Buy</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#00E6A8", fontFamily: "monospace" }}>
                  ${totalToBuy.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,77,77,0.05)", border: "1px solid rgba(255,77,77,0.2)", borderRadius: 4, padding: "10px 14px" }}>
                <div style={{ fontSize: 7, color: "#FF4458", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>Total to Sell</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FF4458", fontFamily: "monospace" }}>
                  ${totalToSell.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            {!targetsSumOk && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "rgba(240,136,62,0.07)", border: "1px solid rgba(240,136,62,0.2)", borderRadius: 3, padding: "7px 12px" }}>
                <AlertTriangle size={11} style={{ color: "#F0883E", flexShrink: 0 }} />
                <span style={{ fontSize: 8, color: "#F0883E", fontFamily: "monospace" }}>
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
                  fontSize: 8,
                  marginBottom: 12,
                  color: "#00D9FF",
                  fontFamily: "monospace",
                }}
              >
                Cash Allocation
              </div>
              <div data-rebalance="cash-row" style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                <div>
                  <span style={{ color: "#4A5A6E", fontSize: 8, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>Current</span>
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
                  <span style={{ color: "#4A5A6E", fontSize: 8, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>Target Range</span>
                  <div
                    data-rebalance="cash-target-pct"
                    style={{ fontFamily: "monospace", marginTop: 4, fontSize: 14, fontWeight: 700, color: "#8B949E" }}
                  >
                    {targetCashPct.toFixed(2)}%
                  </div>
                  <div style={{ color: "#4A5A6E", fontSize: 9, fontFamily: "monospace", marginTop: 2 }}>5 – 20%</div>
                </div>
                <div>
                  <span style={{ color: "#4A5A6E", fontSize: 8, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>Action</span>
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
                          background: "rgba(240,136,62,0.1)",
                          border: "1px solid rgba(240,136,62,0.3)",
                          color: "#F0883E",
                          borderRadius: 2,
                          padding: "2px 7px",
                          fontSize: 7,
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
                          color: "#FF4458",
                          borderRadius: 2,
                          padding: "2px 7px",
                          fontSize: 7,
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
                          color: "#00E6A8",
                          borderRadius: 2,
                          padding: "2px 7px",
                          fontSize: 7,
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
  );
}
