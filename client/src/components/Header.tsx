import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSummary } from "@/hooks/use-portfolio";
import type { MarketSentiment, LiveQuote } from "@/hooks/use-portfolio";
import { getQueryFn } from "@/lib/queryClient";

interface HeaderProps {
  portfolioId: string;
  liveSentiment?: MarketSentiment;
  liveQuotes?: { quotes: LiveQuote[]; updatedAt: string };
}

interface PerformancePoint {
  date: string;
  portfolio: number;
  voo: number;
  qqq: number;
}

const INDEX_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "NDX" },
  { symbol: "DIA", label: "DOW" },
  { symbol: "VIX", label: "VIX" },
];

export function Header({ portfolioId, liveSentiment, liveQuotes }: HeaderProps) {
  const { data: summary } = useSummary(portfolioId);

  // Fetch performance data to compute real period returns
  const { data: perfData } = useQuery<PerformancePoint[]>({
    queryKey: [`/api/performance?portfolioId=${portfolioId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: Infinity,
  });

  // Fetch live market index prices
  const { data: indexData } = useQuery<Record<string, any>>({
    queryKey: ["/api/market/quotes", "header-indices"],
    queryFn: async () => {
      const syms = INDEX_SYMBOLS.map((i) => i.symbol).join(",");
      const res = await fetch(`/api/market/quotes?symbols=${syms}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const totalValue = summary?.totalValue ?? 0;
  const cash = summary?.cash ?? 0;
  const dayChange = summary?.dayChange ?? 0;
  const dayChangePct = summary?.dayChangePct ?? 0;
  const totalReturn = summary?.totalGainLossPct ?? 0;
  const totalReturnDollar = summary?.totalGainLoss ?? 0;

  // Compute period returns from real performance data
  const periodReturns = useMemo(() => {
    if (!perfData || perfData.length === 0) {
      return [
        { label: "1D", value: dayChangePct },
        { label: "5D", value: null },
        { label: "1M", value: null },
        { label: "ALL", value: null },
      ];
    }

    const latest = perfData[perfData.length - 1];
    const latestPct = latest.portfolio;

    function getReturnNDaysBack(n: number): number | null {
      if (perfData!.length <= n) return null;
      const pastPoint = perfData![perfData!.length - 1 - n];
      return latestPct - pastPoint.portfolio;
    }

    const oneDay = getReturnNDaysBack(1);
    const fiveDay = getReturnNDaysBack(5);
    const oneMonth = perfData.length > 21 ? getReturnNDaysBack(21) : getReturnNDaysBack(perfData.length - 1);
    const sinceInception = latestPct;

    return [
      { label: "1D", value: oneDay },
      { label: "5D", value: fiveDay },
      { label: "1M", value: oneMonth },
      { label: "ALL", value: sinceInception },
    ];
  }, [perfData, dayChangePct]);

  const dayColor = dayChange >= 0 ? "var(--color-green)" : "var(--color-red)";

  const mktStatus = (() => {
    const quoteMktStatus = liveQuotes?.quotes?.[0]?.marketStatus;
    const sentimentMktStatus = liveSentiment?.marketStatus;
    return (quoteMktStatus && quoteMktStatus !== "unknown" ? quoteMktStatus : null)
      || (sentimentMktStatus && sentimentMktStatus !== "unknown" ? sentimentMktStatus : null)
      || "unknown";
  })();
  const isOpen = mktStatus === "open";

  return (
    <div
      className="flex items-center flex-shrink-0 terminal-chrome-top"
      style={{
        background: "#070B14",
        borderBottom: "1px solid #1C2840",
        height: 64,
        minHeight: 64,
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 flex-shrink-0"
        style={{ padding: "0 14px", borderRight: "1px solid #1C2840", height: "100%" }}
      >
        <div
          className="flex items-center justify-center font-bold"
          style={{
            width: 34,
            height: 34,
            background: "linear-gradient(135deg, #D4A853 0%, #8B6420 100%)",
            color: "#fff",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            borderRadius: 6,
            letterSpacing: 1,
            boxShadow: "0 0 16px var(--color-primary-a35), 0 0 0 1px var(--color-primary-a15)",
            flexShrink: 0,
          }}
        >
          M
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#E2E8F0",
              letterSpacing: 4,
              lineHeight: 1,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            MAPO
          </div>
          <div
            style={{
              fontSize: 9,
              color: "var(--color-primary)",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginTop: 3,
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            TERMINAL
          </div>
        </div>
      </div>

      {/* Portfolio Value */}
      <div
        className="flex flex-col justify-center flex-shrink-0"
        style={{ padding: "0 14px", borderRight: "1px solid #1C2840", height: "100%" }}
      >
        <div style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", lineHeight: 1 }}>
          PORTFOLIO
        </div>
        <div
          className="font-mono tabular-nums"
          style={{ fontSize: 22, fontWeight: 700, color: "#E8EDF2", lineHeight: 1.15 }}
        >
          ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="font-mono tabular-nums" style={{ fontSize: 11, color: dayColor, fontWeight: 600, lineHeight: 1 }}>
            {dayChange >= 0 ? "+" : ""}${Math.abs(dayChange).toLocaleString("en-US", { minimumFractionDigits: 2 })} today
          </span>
          {cash > 0 && (
            <span className="font-mono tabular-nums" style={{ fontSize: 10, color: "#2E3E52", lineHeight: 1 }}>
              · ${cash.toLocaleString("en-US", { maximumFractionDigits: 0 })} cash
            </span>
          )}
        </div>
      </div>

      {/* Period Returns */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ borderRight: "1px solid #1C2840", height: "100%", padding: "0 4px" }}
      >
        {periodReturns.map((p) => (
          <div
            key={p.label}
            className="flex flex-col items-center justify-center"
            style={{ padding: "0 10px", height: "100%", borderRight: "1px solid #0F1825" }}
          >
            <div style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1.2, lineHeight: 1 }}>
              {p.label}
            </div>
            <div
              className="font-mono tabular-nums"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: p.value === null ? "#2E3E52" : p.value >= 0 ? "var(--color-green)" : "var(--color-red)",
                lineHeight: 1.3,
              }}
            >
              {p.value === null ? "—" : `${p.value >= 0 ? "+" : ""}${p.value.toFixed(1)}%`}
            </div>
          </div>
        ))}
      </div>

      {/* Total P/L */}
      <div
        className="flex flex-col justify-center flex-shrink-0"
        style={{ padding: "0 14px", borderRight: "1px solid #1C2840", height: "100%" }}
      >
        <div style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", lineHeight: 1 }}>
          TOTAL P/L
        </div>
        <div
          className="font-mono tabular-nums"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: totalReturn >= 0 ? "var(--color-green)" : "var(--color-red)",
            lineHeight: 1.15,
          }}
        >
          {totalReturn >= 0 ? "+" : ""}
          {totalReturn.toFixed(2)}%
        </div>
        <div className="font-mono tabular-nums" style={{ fontSize: 10, color: "#4A5A6E", lineHeight: 1 }}>
          {totalReturnDollar >= 0 ? "+" : ""}${totalReturnDollar.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Live Index Quotes — SPY, QQQ, DIA, VIX */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ borderRight: "1px solid #1C2840", height: "100%", padding: "0 4px" }}
      >
        {INDEX_SYMBOLS.map(({ symbol, label }) => {
          const q = indexData?.[symbol];
          const price = q?.c ?? 0;
          const pct = q?.dp ?? 0;
          const isPos = pct >= 0;
          const color = Math.abs(pct) < 0.02 ? "#8B949E" : isPos ? "var(--color-green)" : "var(--color-red)";
          return (
            <div
              key={symbol}
              className="flex flex-col justify-center items-end"
              style={{
                padding: "0 10px",
                height: "100%",
                borderRight: "1px solid #0F1825",
                minWidth: 72,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1, fontWeight: 600 }}>
                  {symbol}
                </span>
                <span style={{ fontSize: 9, color: "#2E3E52" }}>{label}</span>
              </div>
              <div
                className="font-mono tabular-nums"
                style={{ fontSize: 13, fontWeight: 700, color: "#C9D1D9", lineHeight: 1.2 }}
              >
                {price > 0 ? (price >= 1000 ? price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : `$${price.toFixed(2)}`) : "—"}
              </div>
              <div
                className="font-mono tabular-nums"
                style={{ fontSize: 10, color, fontWeight: 600, lineHeight: 1 }}
              >
                {price > 0 ? `${isPos ? "+" : ""}${pct.toFixed(2)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: Sentiment + Market Status + Live */}
      <div
        className="flex items-center gap-3 flex-shrink-0 ml-auto"
        style={{ padding: "0 14px", height: "100%" }}
      >
        {/* Sentiment */}
        <div className="flex flex-col items-center justify-center">
          <div style={{ fontSize: 10, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase", lineHeight: 1 }}>
            SENTIMENT
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color:
                liveSentiment?.sentiment === "BULLISH"
                  ? "var(--color-green)"
                  : liveSentiment?.sentiment === "BEARISH"
                    ? "var(--color-red)"
                    : "var(--color-orange)",
              letterSpacing: 1,
              lineHeight: 1.3,
            }}
          >
            {liveSentiment?.sentiment || "—"}
          </div>
        </div>

        {/* Market Status */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            padding: "3px 8px",
            borderRadius: 3,
            background: isOpen ? "var(--color-green-a08)" : "rgba(255, 68, 88, 0.08)",
            color: isOpen ? "var(--color-green)" : "var(--color-red)",
            border: `1px solid ${isOpen ? "var(--color-green-a20)" : "var(--color-red-a20)"}`,
            lineHeight: 1.6,
            animation: isOpen ? "mkt-badge-pulse 3s ease-in-out infinite" : "none",
          }}
        >
          MKT {isOpen ? "OPEN" : "CLOSED"}
        </div>
        <style>{`
          @keyframes mkt-badge-pulse {
            0%, 100% { box-shadow: 0 0 0px rgba(0,230,168,0); }
            50% { box-shadow: 0 0 8px rgba(0,230,168,0.3); }
          }
        `}</style>

        {/* Live dot + time */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: liveQuotes ? "var(--color-green)" : "var(--color-orange)",
                boxShadow: liveQuotes ? "0 0 4px rgba(0,230,168,0.5)" : "none",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: liveQuotes ? "var(--color-green)" : "var(--color-orange)",
                letterSpacing: 1,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {liveQuotes ? "LIVE" : "—"}
            </span>
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: 10, color: "#3A4A5C", lineHeight: 1.2 }}>
            {new Date().toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
              timeZone: "America/Chicago",
            })}{" "}
            CT
          </div>
        </div>
      </div>
    </div>
  );
}
