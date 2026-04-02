import { useState } from "react";
import { T } from "@/styles/tokens";
import { DataCard } from "@/components/terminal/DataCard";
import { Badge } from "@/components/terminal/Badge";
import { StatusDot } from "@/components/terminal/StatusDot";
import { EmptyState } from "@/components/terminal/EmptyState";

interface RebalanceResult {
  macro?: { regime: string; agiThesis: string; observations: string[] };
  sectors?: { overweight: string[]; neutral: string[]; underweight: string[] };
  current?: Array<{ ticker: string; weight: number; name: string }>;
  proposed?: Array<{ ticker: string; weight: number; name: string; action: "ADD" | "KEEP" | "REMOVE" | "TRIM" }>;
  trades?: Array<{
    action: "BUY" | "SELL" | "TRIM" | "HOLD";
    ticker: string;
    shares: number;
    price: number;
    value: number;
    rationale: string;
  }>;
  validation?: { rules: Array<{ name: string; pass: boolean; detail: string }>; allPass: boolean };
}

type ExecResult = { ticker: string; success: boolean; error?: string };

const STEP_LABELS = [
  "Macro Assessment...",
  "AGI Thesis Check...",
  "Screening Universe...",
  "Scoring Candidates...",
  "Building Portfolio...",
];

function regimeBadgeColor(regime: string): string {
  const r = regime?.toUpperCase();
  if (r?.includes("RISK-ON") || r?.includes("RISK_ON")) return T.green;
  if (r?.includes("RISK-OFF") || r?.includes("RISK_OFF")) return T.red;
  return T.amber;
}

function agiThesisBadgeColor(thesis: string): string {
  const t = thesis?.toUpperCase();
  if (t?.includes("ACCELERATING")) return T.purple;
  if (t?.includes("STABLE")) return T.blue;
  return T.amber;
}

function tradeActionColor(action: string): string {
  switch (action) {
    case "BUY": return T.green;
    case "SELL": return T.red;
    case "TRIM": return T.amber;
    default: return T.muted;
  }
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RebalancePage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RebalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [execResults, setExecResults] = useState<ExecResult[]>([]);

  const runRebalance = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    setStep(0);
    setExecResults([]);

    const stepTimer = setInterval(() => setStep(s => Math.min(s + 1, 4)), 25000);

    try {
      const res = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      clearInterval(stepTimer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      setStep(4);
    } catch (e: any) {
      setError(e.message);
      clearInterval(stepTimer);
    } finally {
      setRunning(false);
    }
  };

  const executeTrades = async () => {
    if (!result?.trades) return;
    setExecuting(true);
    const results: ExecResult[] = [];

    for (const trade of result.trades) {
      try {
        const res = await fetch("/api/portfolio/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: trade.action,
            ticker: trade.ticker,
            shares: trade.shares,
            price: trade.price,
            rationale: trade.rationale,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          results.push({ ticker: trade.ticker, success: false, error: data.error ?? `HTTP ${res.status}` });
        } else {
          results.push({ ticker: trade.ticker, success: true });
        }
      } catch (e: any) {
        results.push({ ticker: trade.ticker, success: false, error: e.message });
      }
      setExecResults([...results]);
    }

    setExecuting(false);
  };

  return (
    <div style={{ animation: "fadeSlideIn 200ms ease forwards" }}>
      {/* Section 1: Trigger */}
      <DataCard>
        <div style={{ padding: 20 }}>
          <p style={{
            fontFamily: T.font.sans,
            fontSize: 13,
            color: T.dim,
            marginBottom: 16,
            lineHeight: 1.5,
          }}>
            This analyzes macro conditions, screens the full universe, and proposes portfolio changes. Takes 2-5 minutes.
          </p>

          <button
            onClick={runRebalance}
            disabled={running}
            style={{
              background: running ? T.muted : T.green,
              color: T.bg,
              fontFamily: T.font.mono,
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "12px 28px",
              borderRadius: 4,
              border: "none",
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.7 : 1,
            }}
          >
            {running ? "RUNNING..." : "RUN MONTHLY REBALANCE"}
          </button>

          {running && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {STEP_LABELS.map((label, i) => {
                const completed = i < step;
                const current = i === step;
                const pending = i > step;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StatusDot
                      color={completed ? T.green : current ? T.amber : T.muted}
                      size={6}
                    />
                    <span
                      className={current ? "animate-pulse" : ""}
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 12,
                        color: completed ? T.green : current ? T.amber : T.muted,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DataCard>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 12 }}>
          <DataCard accent={T.red}>
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.red, marginBottom: 12 }}>
                {error}
              </div>
              <button
                onClick={runRebalance}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.red}`,
                  color: T.red,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "6px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                RETRY
              </button>
            </div>
          </DataCard>
        </div>
      )}

      {/* Section 2: Results */}
      {result && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Macro Panel */}
          {result.macro && (
            <DataCard>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <Badge color={regimeBadgeColor(result.macro.regime)} filled>
                    {result.macro.regime}
                  </Badge>
                  <Badge color={agiThesisBadgeColor(result.macro.agiThesis)} filled>
                    {result.macro.agiThesis}
                  </Badge>
                </div>
                {result.macro.observations?.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.macro.observations.map((obs, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, fontFamily: T.font.sans, fontSize: 13, color: T.white, lineHeight: 1.5 }}>
                        <span style={{ color: T.muted, flexShrink: 0 }}>•</span>
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DataCard>
          )}

          {/* Sector Positioning */}
          {result.sectors && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <DataCard accent={T.green}>
                <div style={{ padding: 16 }}>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}>
                    OVERWEIGHT
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.sectors.overweight?.map(s => (
                      <Badge key={s} color={T.green} filled>{s}</Badge>
                    ))}
                    {!result.sectors.overweight?.length && (
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>NONE</span>
                    )}
                  </div>
                </div>
              </DataCard>

              <DataCard>
                <div style={{ padding: 16 }}>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}>
                    NEUTRAL
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.sectors.neutral?.map(s => (
                      <Badge key={s} color={T.white}>{s}</Badge>
                    ))}
                    {!result.sectors.neutral?.length && (
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>NONE</span>
                    )}
                  </div>
                </div>
              </DataCard>

              <DataCard accent={T.red}>
                <div style={{ padding: 16 }}>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 10,
                  }}>
                    UNDERWEIGHT
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.sectors.underweight?.map(s => (
                      <Badge key={s} color={T.red}>{s}</Badge>
                    ))}
                    {!result.sectors.underweight?.length && (
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>NONE</span>
                    )}
                  </div>
                </div>
              </DataCard>
            </div>
          )}

          {/* Current vs Proposed */}
          {(result.current || result.proposed) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DataCard>
                <div style={{ padding: 16 }}>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 12,
                  }}>
                    CURRENT PORTFOLIO
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.current?.map(pos => (
                      <div key={pos.ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.white, fontWeight: 600 }}>
                          {pos.ticker}
                        </span>
                        <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.dim }}>
                          {pos.weight.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                    {!result.current?.length && (
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>NO POSITIONS</span>
                    )}
                  </div>
                </div>
              </DataCard>

              <DataCard>
                <div style={{ padding: 16 }}>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 12,
                  }}>
                    PROPOSED PORTFOLIO
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.proposed?.map(pos => {
                      let color: string = T.white;
                      let textDecoration = "none";
                      if (pos.action === "ADD") color = T.green;
                      else if (pos.action === "REMOVE") { color = T.red; textDecoration = "line-through"; }
                      else if (pos.action === "TRIM") color = T.amber;

                      return (
                        <div key={pos.ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: T.font.mono, fontSize: 12, color, fontWeight: 600, textDecoration }}>
                              {pos.ticker}
                            </span>
                            {pos.action === "ADD" && <Badge color={T.green} filled>NEW</Badge>}
                            {pos.action === "REMOVE" && <Badge color={T.red} filled>EXIT</Badge>}
                            {pos.action === "TRIM" && <Badge color={T.amber} filled>TRIM</Badge>}
                          </div>
                          <span style={{ fontFamily: T.font.mono, fontSize: 12, color }}>
                            {pos.weight.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                    {!result.proposed?.length && (
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.muted }}>NO CHANGES</span>
                    )}
                  </div>
                </div>
              </DataCard>
            </div>
          )}

          {/* Trade Actions Table */}
          {result.trades && result.trades.length > 0 && (
            <DataCard>
              <div style={{ overflowX: "auto" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "72px 72px 72px 88px 96px 1fr",
                  background: T.surfaceAlt,
                  padding: "8px 16px",
                  borderBottom: `1px solid ${T.border}`,
                  minWidth: 600,
                }}>
                  {["ACTION", "TICKER", "SHARES", "PRICE", "VALUE", "RATIONALE"].map(h => (
                    <div key={h} style={{
                      fontFamily: T.font.mono,
                      fontSize: 9,
                      color: T.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}>
                      {h}
                    </div>
                  ))}
                </div>
                {result.trades.map((trade, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "72px 72px 72px 88px 96px 1fr",
                      padding: "10px 16px",
                      borderBottom: `1px solid ${T.border}`,
                      minWidth: 600,
                      background: "transparent",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = T.surfaceAlt}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Badge color={tradeActionColor(trade.action)} filled>{trade.action}</Badge>
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.white, fontWeight: 600, display: "flex", alignItems: "center" }}>
                      {trade.ticker}
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.dim, display: "flex", alignItems: "center" }}>
                      {trade.shares}
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.dim, display: "flex", alignItems: "center" }}>
                      {formatCurrency(trade.price)}
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.dim, display: "flex", alignItems: "center" }}>
                      {formatCurrency(trade.value)}
                    </div>
                    <div style={{
                      fontFamily: T.font.sans,
                      fontSize: 11,
                      color: T.dim,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {trade.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          )}

          {/* Validation */}
          {result.validation && (
            <DataCard>
              <div style={{ padding: 16 }}>
                <div style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                }}>
                  VALIDATION CHECKS
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {result.validation.rules.map((rule, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{
                        fontFamily: T.font.mono,
                        fontSize: 13,
                        color: rule.pass ? T.green : T.red,
                        flexShrink: 0,
                        lineHeight: 1.4,
                      }}>
                        {rule.pass ? "✓" : "✗"}
                      </span>
                      <div>
                        <div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.white }}>{rule.name}</div>
                        <div style={{ fontFamily: T.font.sans, fontSize: 11, color: T.dim, marginTop: 2 }}>{rule.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {result.validation.allPass ? (
                  <DataCard accent={T.green}>
                    <div style={{ padding: "10px 14px" }}>
                      <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        ALL VALIDATION CHECKS PASSED
                      </span>
                    </div>
                  </DataCard>
                ) : (
                  <DataCard accent={T.red}>
                    <div style={{ padding: "10px 14px" }}>
                      <div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.red, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                        VALIDATION FAILURES
                      </div>
                      {result.validation.rules.filter(r => !r.pass).map((rule, i) => (
                        <div key={i} style={{ fontFamily: T.font.sans, fontSize: 11, color: T.red, marginBottom: 4 }}>
                          • {rule.name}: {rule.detail}
                        </div>
                      ))}
                    </div>
                  </DataCard>
                )}
              </div>
            </DataCard>
          )}

          {/* Approve & Execute */}
          {result.validation?.allPass && (
            <DataCard>
              <div style={{ padding: 16 }}>
                {!executing && execResults.length === 0 && (
                  <button
                    onClick={executeTrades}
                    style={{
                      background: T.green,
                      color: T.bg,
                      fontFamily: T.font.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "12px 24px",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    APPROVE AND EXECUTE TRADES
                  </button>
                )}

                {(executing || execResults.length > 0) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 9,
                      color: T.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}>
                      EXECUTION PROGRESS
                    </div>
                    {result.trades?.map((trade, i) => {
                      const res = execResults[i];
                      const dotColor = !res ? T.amber : res.success ? T.green : T.red;
                      const statusText = !res
                        ? "PENDING"
                        : res.success
                        ? "EXECUTED"
                        : `FAILED: ${res.error}`;

                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <StatusDot color={dotColor} size={6} />
                          <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.white, fontWeight: 600, minWidth: 60 }}>
                            {trade.ticker}
                          </span>
                          <span style={{ fontFamily: T.font.mono, fontSize: 11, color: dotColor }}>
                            {statusText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </DataCard>
          )}
        </div>
      )}

      {/* No result yet and not running */}
      {!result && !running && !error && (
        <div style={{ marginTop: 12 }}>
          <EmptyState message="Run the monthly rebalance to generate portfolio recommendations." />
        </div>
      )}
    </div>
  );
}
