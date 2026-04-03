import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Holding } from "@shared/schema";

interface TopMoversProps {
  holdings: Holding[];
  portfolioId?: string;
}

interface ExtendedQuote {
  symbol: string;
  week52High: number;
  week52Low: number;
  currentPrice: number;
}

function Week52Bar({ ticker, currentPrice, extMap }: {
  ticker: string;
  currentPrice: number;
  extMap: Record<string, ExtendedQuote>;
}) {
  const ext = extMap[ticker];
  const lo = ext?.week52Low ?? 0;
  const hi = ext?.week52High ?? 0;
  const hasReal = lo > 0 && hi > 0 && hi > lo;
  const pct = hasReal
    ? Math.max(2, Math.min(98, ((currentPrice - lo) / (hi - lo)) * 100))
    : 50;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: "#484F58", fontFamily: "monospace" }}>
          {hasReal ? `$${lo.toFixed(0)}` : "52W L"}
        </span>
        <span style={{ fontSize: 9, color: "#484F58", fontFamily: "monospace" }}>
          {hasReal ? `$${hi.toFixed(0)}` : "52W H"}
        </span>
      </div>
      <div style={{ position: "relative", height: 4, background: "#1A2332", borderRadius: 2 }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, #FF4D4D 0%, #FFB300 50%, #00C853 100%)",
          borderRadius: 2, opacity: 0.35,
        }} />
        <div style={{
          position: "absolute",
          left: `${pct}%`,
          top: "50%",
          transform: "translate(-50%, -60%)",
          fontSize: 10,
          color: "var(--color-primary)",
          lineHeight: 1,
          textShadow: "0 0 4px var(--color-primary-a50)",
        }}>◆</div>
      </div>
    </div>
  );
}

function MoverCard({ holding, type, extMap }: {
  holding: Holding;
  type: "gainer" | "loser";
  extMap: Record<string, ExtendedQuote>;
}) {
  const isGainer = type === "gainer";
  const color = isGainer ? "var(--color-green)" : "var(--color-red)";
  const arrow = isGainer ? "▲" : "▼";
  const label = isGainer ? "GAINER" : "LOSER";
  const changePct = holding.dayChangePct ?? 0;
  const totalPnlPct = holding.gainLossPct ?? 0;
  const totalColor = totalPnlPct >= 0 ? "var(--color-green)" : "var(--color-red)";

  return (
    <div style={{ background: "#0A0E18", border: "1px solid #1C2840", borderRadius: 2, padding: "6px 8px" }}>
      <div style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: 0.8, marginBottom: 2 }}>
        {arrow} {label}
      </div>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#C9D1D9" }}>
          {holding.ticker}
        </span>
        <span className="font-mono tabular-nums" style={{ fontSize: 12, fontWeight: 700, color }}>
          {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>Total P&L</span>
        <span className="font-mono tabular-nums" style={{ fontSize: 9, fontWeight: 600, color: totalColor }}>
          {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%
        </span>
      </div>
      <Week52Bar ticker={holding.ticker} currentPrice={holding.price ?? 0} extMap={extMap} />
    </div>
  );
}

export function TopMovers({ holdings, portfolioId }: TopMoversProps) {
  const { gainers, losers, upCount, downCount } = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0));
    const up = sorted.filter((h) => (h.dayChangePct ?? 0) > 0);
    const down = sorted.filter((h) => (h.dayChangePct ?? 0) < 0);
    return {
      gainers: up.slice(0, 2),
      losers: down.slice(-2).reverse().sort((a, b) => (a.dayChangePct ?? 0) - (b.dayChangePct ?? 0)),
      upCount: up.length,
      downCount: down.length,
    };
  }, [holdings]);

  const { data: extendedRaw } = useQuery<ExtendedQuote[]>({
    queryKey: ["/api/live/extended-quotes", portfolioId],
    queryFn: async () => {
      const url = portfolioId
        ? `/api/live/extended-quotes?portfolioId=${portfolioId}`
        : "/api/live/extended-quotes";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: holdings.length > 0,
    staleTime: 3_600_000,
  });

  const extMap: Record<string, ExtendedQuote> = useMemo(() => {
    if (!extendedRaw) return {};
    return Object.fromEntries(extendedRaw.map((q) => [q.symbol, q]));
  }, [extendedRaw]);

  return (
    <div className="terminal-panel" style={{ flex: "0.8 1 0", minHeight: 0 }}>
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">Top Movers Today</span>
        <span className="terminal-badge">DAILY</span>
      </div>
      <div style={{ padding: "2px 4px", fontSize: 9, color: "#8B949E", borderBottom: "1px solid #1C2840" }}>
        <span style={{ color: "var(--color-green)" }}>▲ {upCount} up</span>
        {"  "}
        <span style={{ color: "var(--color-red)" }}>▼ {downCount} down</span>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: 4 }}>
        {(gainers.length > 0 || losers.length > 0) ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {gainers.map((m) => (
              <MoverCard key={m.id} holding={m} type="gainer" extMap={extMap} />
            ))}
            {losers.map((m) => (
              <MoverCard key={m.id} holding={m} type="loser" extMap={extMap} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span style={{ fontSize: 9, color: "#8B949E" }}>No movers today</span>
          </div>
        )}
      </div>
    </div>
  );
}
