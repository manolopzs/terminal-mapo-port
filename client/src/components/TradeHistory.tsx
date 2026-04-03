import { useTrades } from "@/hooks/use-portfolio";
import type { Trade } from "@shared/schema";

export function TradeHistory({ portfolioId }: { portfolioId: string }) {
  const { data: trades } = useTrades(portfolioId);

  const sortedTrades = (trades ?? []).sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  const closedTrades = (trades ?? []).filter(t => t.pnl != null);
  const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winCount = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? Math.round((winCount / closedTrades.length) * 100) : null;
  const hasPnl = closedTrades.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0B0F1A" }}>
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid #1C2840" }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#8B949E",
          }}
        >
          Trade History
        </span>
        <div className="flex items-center gap-3">
          {hasPnl && (
            <span className="font-mono tabular-nums" style={{ fontSize: 9, fontWeight: 700, color: totalRealizedPnl >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
              {totalRealizedPnl >= 0 ? "+" : ""}${totalRealizedPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {winRate !== null && (
            <span style={{ fontSize: 9, color: winRate >= 50 ? "var(--color-green)" : "var(--color-red)" }}>
              {winRate}% win
            </span>
          )}
          <span style={{ fontSize: 9, color: "#58A6FF" }}>
            {sortedTrades.length} TRADES
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        <table className="w-full" style={{ fontSize: 10 }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #1C2840",
                position: "sticky",
                top: 0,
                background: "#0B0F1A",
                zIndex: 1,
              }}
            >
              {["DATE", "ACTION", "TICKER", "SHARES", "PRICE", "TOTAL", "P&L"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-2 py-1.5"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "#4A5A6E",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((trade, i) => (
              <TradeRow key={trade.id ?? i} trade={trade} />
            ))}
          </tbody>
        </table>
        {sortedTrades.length === 0 && (
          <div
            className="flex items-center justify-center py-8"
            style={{ color: "#4A5A6E", fontSize: 10 }}
          >
            No trades recorded
          </div>
        )}
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.action === "BUY";
  const actionColor = isBuy ? "var(--color-green)" : "var(--color-red)";
  const pnlColor = trade.pnl != null ? (trade.pnl >= 0 ? "var(--color-green)" : "var(--color-red)") : "#4A5A6E";

  return (
    <tr
      style={{ borderBottom: "1px solid #111820" }}
      className="hover:bg-[#161B22] transition-colors"
    >
      <td className="px-2 py-1.5" style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}>
        {formatDate(trade.date)}
      </td>
      <td className="px-2 py-1.5">
        <span
          style={{
            color: actionColor,
            fontWeight: 700,
            fontSize: 9,
            letterSpacing: 0.5,
          }}
        >
          {trade.action}
        </span>
      </td>
      <td className="px-2 py-1.5" style={{ color: "#C9D1D9", fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
        {trade.ticker}
      </td>
      <td className="px-2 py-1.5" style={{ color: "#C9D1D9", fontFamily: "JetBrains Mono, monospace" }}>
        {trade.shares}
      </td>
      <td className="px-2 py-1.5" style={{ color: "#C9D1D9", fontFamily: "JetBrains Mono, monospace" }}>
        ${trade.price.toFixed(2)}
      </td>
      <td className="px-2 py-1.5" style={{ color: "#C9D1D9", fontFamily: "JetBrains Mono, monospace" }}>
        ${trade.total.toFixed(2)}
      </td>
      <td className="px-2 py-1.5" style={{ color: pnlColor, fontFamily: "JetBrains Mono, monospace" }}>
        {trade.pnl != null ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}` : "—"}
      </td>
    </tr>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
