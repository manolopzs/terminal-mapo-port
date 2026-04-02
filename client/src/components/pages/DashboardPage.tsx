import { useState } from "react";
import { useLocation } from "wouter";
import {
  Sunrise,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { T } from "@/styles/tokens";
import { useHoldings, useSummary, useLiveQuotes } from "@/hooks/use-portfolio";
import { DataCard } from "@/components/terminal/DataCard";
import { MetricBox } from "@/components/terminal/MetricBox";
import { SignalBadge } from "@/components/terminal/SignalBadge";
import { StatusDot } from "@/components/terminal/StatusDot";
import { Badge } from "@/components/terminal/Badge";
import { AlertRow } from "@/components/terminal/AlertRow";
import { LoadingState } from "@/components/terminal/LoadingState";
import { EmptyState } from "@/components/terminal/EmptyState";
import type { Holding } from "@shared/schema";

interface PortfolioAlert {
  severity: "WARNING" | "CRITICAL" | "INFO";
  ticker?: string;
  message: string;
}

function fmt$(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function DashboardPage() {
  const [, navigate] = useLocation();
  const { data: summary, isLoading: summaryLoading } = useSummary();
  const { data: holdingsData, isLoading: holdingsLoading } = useHoldings();
  const { data: liveData } = useLiveQuotes();
  const holdings: Holding[] = holdingsData ?? [];
  const quotes = liveData?.quotes ?? [];

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PortfolioAlert[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsFetched, setAlertsFetched] = useState(false);

  // Fetch alerts once on mount
  if (!alertsFetched) {
    setAlertsFetched(true);
    setAlertsLoading(true);
    fetch("/api/portfolio/validate")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.alerts)) setAlerts(data.alerts);
        else setAlerts([]);
      })
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  }

  const totalValue = summary?.totalValue ?? 0;
  const cash = summary?.cash ?? 0;
  const cashPct =
    totalValue > 0 ? ((cash / totalValue) * 100).toFixed(1) : "0.0";

  // Mega-cap: holdings with live quote marketCap > 100B
  let megaCapPct = "--";
  if (quotes.length > 0 && totalValue > 0) {
    const megaCapValue = holdings.reduce((acc, h) => {
      const q = quotes.find((q) => q.symbol === h.ticker);
      if (q && q.marketCap > 100_000_000_000) {
        return acc + (h.value ?? 0);
      }
      return acc;
    }, 0);
    megaCapPct = ((megaCapValue / totalValue) * 100).toFixed(1);
  }

  const megaCapNum = megaCapPct === "--" ? 0 : parseFloat(megaCapPct);
  const cashPctNum = parseFloat(cashPct);
  const megaCapFill = megaCapNum > 25 ? T.amber : T.green;
  const megaCapBarWidth = Math.min((megaCapNum / 30) * 100, 100);
  const cashBarWidth = Math.min((cashPctNum / 30) * 100, 100);

  const handleBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      const data = await res.json();
      setBriefingText(data.briefing ?? data.text ?? JSON.stringify(data));
    } catch {
      setBriefingText("Failed to load morning briefing.");
    } finally {
      setBriefingLoading(false);
      setBriefingOpen(true);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 200ms ease forwards" }}>
      {/* SECTION 1: Portfolio Summary Strip */}
      <div style={{ paddingBottom: 20 }}>
        {summaryLoading ? (
          <LoadingState rows={1} />
        ) : (
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <MetricBox
              value={fmt$(totalValue)}
              label="Total Value"
              color={T.green}
            />
            <MetricBox
              value={
                summary
                  ? `${summary.dayChange >= 0 ? "+" : ""}${fmt$(summary.dayChange)}`
                  : "--"
              }
              label="P&L Today"
              color={summary && summary.dayChange >= 0 ? T.green : T.red}
              trend={
                summary
                  ? summary.dayChange >= 0
                    ? "up"
                    : "down"
                  : undefined
              }
            />
            <MetricBox
              value={summary ? fmtPct(summary.totalGainLossPct) : "--"}
              label="Total Return %"
              color={
                summary && summary.totalGainLossPct >= 0 ? T.green : T.red
              }
              trend={
                summary
                  ? summary.totalGainLossPct >= 0
                    ? "up"
                    : "down"
                  : undefined
              }
            />
            <MetricBox
              value={summary ? `${fmt$(cash)} (${cashPct}%)` : "--"}
              label="Cash Reserve"
              color={T.white}
            />
            <MetricBox
              value={summary?.holdingsCount ?? "--"}
              label="Positions"
              color={T.white}
            />
          </div>
        )}

        {/* Exposure Bars */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <DataCard>
            <div style={{ padding: "12px 16px", minWidth: 220 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    textTransform: "uppercase" as const,
                    color: T.muted,
                    letterSpacing: "0.12em",
                  }}
                >
                  Mega-Cap Exposure
                </span>
                <span
                  style={{ fontFamily: T.font.mono, fontSize: 12, color: T.amber }}
                >
                  {megaCapPct === "--" ? "--" : `${megaCapPct}%`}
                </span>
              </div>
              <div
                style={{
                  position: "relative" as const,
                  background: T.border,
                  height: 4,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: `${megaCapBarWidth}%`,
                    background: megaCapFill,
                    height: 4,
                    transition: "width 600ms ease-out",
                  }}
                />
                {/* 30% threshold tick at 100% position (bar represents 30% scale) */}
                <div
                  style={{
                    position: "absolute" as const,
                    right: 0,
                    top: -4,
                    width: 1,
                    height: 12,
                    background: T.dim,
                  }}
                />
              </div>
              <div
                style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}
              >
                <span style={{ fontFamily: T.font.mono, fontSize: 8, color: T.dim }}>
                  30%
                </span>
              </div>
            </div>
          </DataCard>

          <DataCard>
            <div style={{ padding: "12px 16px", minWidth: 220 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    textTransform: "uppercase" as const,
                    color: T.muted,
                    letterSpacing: "0.12em",
                  }}
                >
                  Cash Reserve
                </span>
                <span
                  style={{ fontFamily: T.font.mono, fontSize: 12, color: T.blue }}
                >
                  {cashPct}%
                </span>
              </div>
              <div style={{ background: T.border, height: 4, width: "100%" }}>
                <div
                  style={{
                    width: `${cashBarWidth}%`,
                    background: T.blue,
                    height: 4,
                    transition: "width 600ms ease-out",
                  }}
                />
              </div>
            </div>
          </DataCard>
        </div>
      </div>

      {/* SECTION 2: Holdings Table */}
      <DataCard>
        <div style={{ overflowX: "auto" }}>
          {/* Header Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "80px 160px 100px 70px 90px 100px 80px 90px 110px 70px",
              padding: "8px 16px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceAlt,
              gap: 8,
              minWidth: 960,
            }}
          >
            {[
              "TICKER",
              "COMPANY",
              "SECTOR",
              "SHARES",
              "COST BASIS",
              "VALUE",
              "WEIGHT",
              "RETURN",
              "SIGNALS",
              "STATUS",
            ].map((col) => (
              <span
                key={col}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  textTransform: "uppercase" as const,
                  color: T.muted,
                  letterSpacing: "0.1em",
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {holdingsLoading ? (
            <LoadingState rows={6} />
          ) : holdings.length === 0 ? (
            <EmptyState message="No holdings. Add your first position." />
          ) : (
            holdings.map((h) => {
              const liveQ = quotes.find((q) => q.symbol === h.ticker);
              const currentPrice = liveQ?.price ?? h.price;
              const costBasis = h.costBasis;
              const returnPct =
                costBasis > 0
                  ? ((currentPrice - costBasis) / costBasis) * 100
                  : (h.gainLossPct ?? 0);
              const value = h.value ?? h.quantity * currentPrice;
              const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
              const tickerColor = returnPct >= 0 ? T.green : T.red;
              const isExpanded = expandedRow === h.id;

              return (
                <div key={h.id}>
                  {/* Main Row */}
                  <div
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : h.id)
                    }
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "80px 160px 100px 70px 90px 100px 80px 90px 110px 70px",
                      padding: "10px 16px",
                      borderBottom: `1px solid ${T.border}`,
                      cursor: "pointer",
                      gap: 8,
                      minWidth: 960,
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        T.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "transparent";
                    }}
                  >
                    {/* Ticker */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase" as const,
                          color: tickerColor,
                        }}
                      >
                        {h.ticker}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={10} color={T.dim} />
                      ) : (
                        <ChevronDown size={10} color={T.dim} />
                      )}
                    </div>

                    {/* Company */}
                    <span
                      style={{
                        fontFamily: T.font.sans,
                        fontSize: 12,
                        color: T.dim,
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                        display: "block",
                      }}
                    >
                      {h.name ?? liveQ?.name ?? h.ticker}
                    </span>

                    {/* Sector */}
                    <div>
                      <Badge color={T.cyan}>{h.sector ?? "—"}</Badge>
                    </div>

                    {/* Shares / Quantity */}
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 12,
                        color: T.white,
                      }}
                    >
                      {h.quantity.toLocaleString()}
                    </span>

                    {/* Cost Basis */}
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 12,
                        color: T.dim,
                      }}
                    >
                      ${costBasis.toFixed(2)}
                    </span>

                    {/* Value */}
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 12,
                        color: T.white,
                        fontWeight: 700,
                      }}
                    >
                      {fmt$(value)}
                    </span>

                    {/* Weight with sparkline bar */}
                    <div>
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: 12,
                          color: T.white,
                        }}
                      >
                        {weight.toFixed(1)}%
                      </span>
                      <div
                        style={{
                          background: T.muted,
                          height: 4,
                          width: Math.min(weight * 2, 60),
                          marginTop: 2,
                        }}
                      >
                        <div
                          style={{ width: "100%", height: "100%", background: T.blue }}
                        />
                      </div>
                    </div>

                    {/* Return */}
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 12,
                        color: returnPct >= 0 ? T.green : T.red,
                      }}
                    >
                      {returnPct >= 0 ? "+" : ""}
                      {returnPct.toFixed(2)}%
                    </span>

                    {/* Signals */}
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["M", "E", "G", "V"] as const).map((sig) => (
                        <span
                          key={sig}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/analyze?ticker=${h.ticker}`);
                          }}
                        >
                          <SignalBadge signal={sig} confirmed={false} />
                        </span>
                      ))}
                    </div>

                    {/* Status */}
                    <div>
                      <StatusDot color={T.green} size={6} />
                    </div>
                  </div>

                  {/* Expanded Row */}
                  {isExpanded && (
                    <div
                      style={{
                        background: T.surfaceAlt,
                        borderTop: `1px solid ${T.border}`,
                        borderBottom: `1px solid ${T.border}`,
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 24,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: 9,
                            color: T.muted,
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.1em",
                          }}
                        >
                          Entry Date
                        </span>
                        <div
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: 12,
                            color: T.white,
                            marginTop: 2,
                          }}
                        >
                          --
                        </div>
                      </div>
                      <div>
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: 9,
                            color: T.muted,
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.1em",
                          }}
                        >
                          Entry Score
                        </span>
                        <div
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: 12,
                            color: T.gold,
                            marginTop: 2,
                          }}
                        >
                          --
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/analyze?ticker=${h.ticker}`);
                        }}
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: 9,
                          textTransform: "uppercase" as const,
                          color: T.green,
                          background: "transparent",
                          border: `1px solid ${T.green}`,
                          padding: "4px 10px",
                          borderRadius: 4,
                          cursor: "pointer",
                          letterSpacing: "0.08em",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            T.green;
                          (e.currentTarget as HTMLButtonElement).style.color = T.bg;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                          (e.currentTarget as HTMLButtonElement).style.color = T.green;
                        }}
                      >
                        Re-analyze
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DataCard>

      {/* SECTION 3: Active Alerts */}
      <div style={{ marginTop: 12 }}>
        <DataCard accent={T.rose}>
          <div style={{ padding: "12px 16px" }}>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                textTransform: "uppercase" as const,
                color: T.muted,
                letterSpacing: "0.12em",
              }}
            >
              Active Alerts
            </span>
          </div>
          {alertsLoading ? (
            <LoadingState rows={2} />
          ) : alerts && alerts.length > 0 ? (
            <div>
              {alerts.map((a, i) => (
                <AlertRow
                  key={i}
                  severity={a.severity}
                  ticker={a.ticker}
                  message={a.message}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px 12px",
              }}
            >
              <StatusDot color={T.green} size={6} />
              <span
                style={{ fontFamily: T.font.mono, fontSize: 11, color: T.dim }}
              >
                No active alerts
              </span>
            </div>
          )}
        </DataCard>
      </div>

      {/* SECTION 4: Quick Actions */}
      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: 12, marginTop: 12 }}
      >
        {/* Morning Briefing */}
        <DataCard>
          <div
            onClick={briefingLoading ? undefined : handleBriefing}
            style={{ padding: 16, cursor: briefingLoading ? "default" : "pointer" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Sunrise size={16} color={T.gold} />
              <span
                style={{
                  fontFamily: T.font.display,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.white,
                }}
              >
                Morning Briefing
              </span>
            </div>
            <span style={{ fontFamily: T.font.sans, fontSize: 11, color: T.dim }}>
              {briefingLoading
                ? "Loading briefing..."
                : "Get your AI-powered portfolio morning brief"}
            </span>
          </div>
        </DataCard>

        {/* Analyze Stock */}
        <DataCard>
          <div
            onClick={() => navigate("/analyze")}
            style={{ padding: 16, cursor: "pointer" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Search size={16} color={T.cyan} />
              <span
                style={{
                  fontFamily: T.font.display,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.white,
                }}
              >
                Analyze Stock
              </span>
            </div>
            <span style={{ fontFamily: T.font.sans, fontSize: 11, color: T.dim }}>
              Run 6-factor MAPO scoring on any ticker
            </span>
          </div>
        </DataCard>

        {/* Screen Universe */}
        <DataCard>
          <div
            onClick={() => navigate("/screen")}
            style={{ padding: 16, cursor: "pointer" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Filter size={16} color={T.purple} />
              <span
                style={{
                  fontFamily: T.font.display,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.white,
                }}
              >
                Screen Universe
              </span>
            </div>
            <span style={{ fontFamily: T.font.sans, fontSize: 11, color: T.dim }}>
              Filter and rank stocks by quant signals
            </span>
          </div>
        </DataCard>
      </div>

      {/* Briefing Overlay */}
      {briefingOpen && (
        <div
          style={{
            position: "fixed" as const,
            top: 0,
            right: 0,
            bottom: 0,
            width: 400,
            background: T.surface,
            borderLeft: `1px solid ${T.border}`,
            padding: 20,
            zIndex: 50,
            overflowY: "auto" as const,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: 11,
                textTransform: "uppercase" as const,
                color: T.gold,
                letterSpacing: "0.12em",
              }}
            >
              Morning Briefing
            </span>
            <button
              onClick={() => setBriefingOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: T.dim,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
          <pre
            style={{
              fontFamily: T.font.mono,
              fontSize: 11,
              color: T.dim,
              whiteSpace: "pre-wrap" as const,
              wordBreak: "break-word" as const,
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {briefingText}
          </pre>
        </div>
      )}
    </div>
  );
}
