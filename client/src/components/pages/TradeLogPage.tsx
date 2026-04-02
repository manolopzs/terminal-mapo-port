import { useState, useEffect, useMemo } from "react";
import { T } from "@/styles/tokens";
import { DataCard } from "@/components/terminal/DataCard";
import { Badge } from "@/components/terminal/Badge";
import { MetricBox } from "@/components/terminal/MetricBox";
import { LoadingState } from "@/components/terminal/LoadingState";
import { EmptyState } from "@/components/terminal/EmptyState";

interface Trade {
  id?: string;
  date: string;
  action: "BUY" | "SELL" | "TRIM";
  ticker: string;
  shares: number;
  price: number;
  total?: number;
  rationale?: string;
  score?: number;
  name?: string;
}

type ActionFilter = "ALL" | "BUY" | "SELL" | "TRIM";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTotal(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function actionColor(action: Trade["action"]): string {
  if (action === "BUY") return T.green;
  if (action === "SELL") return T.red;
  return T.amber;
}

function tradeTotal(trade: Trade): number {
  return trade.total ?? trade.shares * trade.price;
}

export function TradeLogPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<ActionFilter>("ALL");
  const [filterTicker, setFilterTicker] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/trades");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Trade[] = await res.json();
        // Sort by date descending
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTrades(data);
      } catch (e) {
        setTrades([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  // Summary stats over ALL trades (unfiltered)
  const totalTrades = trades.length;
  const buyCount = trades.filter(t => t.action === "BUY").length;
  const sellCount = trades.filter(t => t.action === "SELL").length;
  const totalVolume = trades.reduce((sum, t) => sum + tradeTotal(t), 0);

  // Client-side filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (filterAction !== "ALL" && t.action !== filterAction) return false;
      if (filterTicker && !t.ticker.toUpperCase().includes(filterTicker.toUpperCase())) return false;
      if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.date) > new Date(dateTo)) return false;
      return true;
    });
  }, [trades, filterAction, filterTicker, dateFrom, dateTo]);

  const ACTION_FILTERS: ActionFilter[] = ["ALL", "BUY", "SELL", "TRIM"];

  const inputStyle: React.CSSProperties = {
    fontFamily: T.font.mono,
    background: T.surfaceAlt,
    border: `1px solid ${T.border}`,
    color: T.white,
    padding: "6px 10px",
    borderRadius: 4,
    outline: "none",
    fontSize: 12,
  };

  return (
    <div style={{ animation: "fadeSlideIn 200ms ease forwards" }}>
      {/* Summary Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricBox value={totalTrades} label="TOTAL TRADES" color={T.white} />
        <MetricBox value={buyCount} label="BUY ORDERS" color={T.green} />
        <MetricBox value={sellCount} label="SELL ORDERS" color={T.red} />
        <MetricBox
          value={`$${(totalVolume / 1000).toFixed(0)}K`}
          label="TOTAL VOLUME"
          color={T.gold}
        />
      </div>

      {/* Filter Bar */}
      <DataCard>
        <div style={{ padding: "12px 16px", marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="FILTER TICKER..."
              value={filterTicker}
              onChange={e => setFilterTicker(e.target.value.toUpperCase())}
              style={{ ...inputStyle, fontSize: 12, letterSpacing: "0.06em", width: 160 }}
            />

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {ACTION_FILTERS.map(a => (
                <span key={a} onClick={() => setFilterAction(a)} style={{ cursor: "pointer" }}>
                  <Badge
                    color={a === "BUY" ? T.green : a === "SELL" ? T.red : a === "TRIM" ? T.amber : T.white}
                    filled={filterAction === a}
                  >
                    {a}
                  </Badge>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>FROM</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ ...inputStyle, fontSize: 11 }}
              />
              <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>TO</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ ...inputStyle, fontSize: 11 }}
              />
            </div>
          </div>
        </div>
      </DataCard>

      <div style={{ marginBottom: 12 }} />

      {/* Trade Table */}
      <DataCard>
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: 16 }}>
              <LoadingState rows={8} />
            </div>
          ) : filteredTrades.length === 0 ? (
            <EmptyState message="No trades recorded yet." />
          ) : (
            <>
              {/* Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "110px 64px 72px 140px 64px 80px 88px 64px 1fr",
                background: T.surfaceAlt,
                padding: "8px 16px",
                borderBottom: `1px solid ${T.border}`,
                minWidth: 860,
              }}>
                {["DATE", "ACTION", "TICKER", "COMPANY", "SHARES", "PRICE", "TOTAL", "SCORE", "RATIONALE"].map(h => (
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

              {/* Rows */}
              {filteredTrades.map((trade, i) => (
                <div
                  key={trade.id ?? i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 64px 72px 140px 64px 80px 88px 64px 1fr",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${T.border}`,
                    background: "transparent",
                    minWidth: 860,
                    transition: "background 100ms",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = T.surfaceAlt}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                >
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    color: T.dim,
                    display: "flex",
                    alignItems: "center",
                  }}>
                    {formatDate(trade.date)}
                  </div>

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Badge color={actionColor(trade.action)} filled>{trade.action}</Badge>
                  </div>

                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    color: T.white,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                  }}>
                    {trade.ticker}
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
                    {trade.name ?? "--"}
                  </div>

                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    color: T.white,
                    display: "flex",
                    alignItems: "center",
                  }}>
                    {trade.shares}
                  </div>

                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    color: T.white,
                    display: "flex",
                    alignItems: "center",
                  }}>
                    {formatCurrency(trade.price)}
                  </div>

                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    color: T.white,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                  }}>
                    {formatTotal(tradeTotal(trade))}
                  </div>

                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    color: T.gold,
                    display: "flex",
                    alignItems: "center",
                  }}>
                    {trade.score != null ? trade.score : "--"}
                  </div>

                  <div
                    title={trade.rationale ?? ""}
                    style={{
                      fontFamily: T.font.sans,
                      fontSize: 11,
                      color: T.dim,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 300,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {trade.rationale ?? "--"}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </DataCard>
    </div>
  );
}
