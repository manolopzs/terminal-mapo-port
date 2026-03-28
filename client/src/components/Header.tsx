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

export function Header({ portfolioId, liveSentiment, liveQuotes }: HeaderProps) {
  const { data: summary } = useSummary(portfolioId);

  // Fetch performance data to compute real period returns
  const { data: perfData } = useQuery<PerformancePoint[]>({
    queryKey: [`/api/performance?portfolioId=${portfolioId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: Infinity,
  });

  const totalValue = summary?.totalValue ?? 0;
  const cash = (summary as any)?.cash ?? 0;
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
        { label: "6M", value: null },
        { label: "1Y", value: null },
      ];
    }

    const latest = perfData[perfData.length - 1];
    const latestPct = latest.portfolio;

    // Helper to get return N trading days back
    function getReturnNDaysBack(n: number): number | null {
      if (perfData!.length <= n) return null;
      const pastPoint = perfData![perfData!.length - 1 - n];
      return latestPct - pastPoint.portfolio;
    }

    // 1D = 1 trading day back
    const oneDay = getReturnNDaysBack(1);
    // 5D = 5 trading days back
    const fiveDay = getReturnNDaysBack(5);
    // 1M ≈ 21 trading days
    const oneMonth = perfData.length > 21 ? getReturnNDaysBack(21) : getReturnNDaysBack(perfData.length - 1);
    // Since inception (we only have ~30 days of data)
    const sinceInception = latestPct;

    return [
      { label: "1D", value: oneDay },
      { label: "5D", value: fiveDay },
      { label: "1M", value: oneMonth },
      { label: "30D", value: sinceInception },
    ];
  }, [perfData, dayChangePct]);

  const dayColor = dayChange >= 0 ? "#00E6A8" : "#FF4458";

  return (
    <div
      className="flex items-center justify-between px-4 flex-shrink-0 terminal-chrome-top"
      style={{
        background: "#070B14",
        borderBottom: "1px solid #1C2840",
        height: 56,
        minHeight: 56,
      }}
    >
      {/* Left: Logo + Name */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div
          className="flex items-center justify-center font-bold"
          style={{
            width: 30,
            height: 30,
            background: "linear-gradient(135deg, #00D9FF 0%, #0088CC 100%)",
            color: "#040810",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            borderRadius: 4,
            letterSpacing: 1,
            boxShadow: "0 0 10px rgba(0,217,255,0.2)",
          }}
        >
          MT
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#D6DFE8",
              letterSpacing: 2.5,
              lineHeight: 1,
            }}
          >
            MAPO TERMINAL
          </div>
          <div
            style={{
              fontSize: 8,
              color: "#4A5A6E",
              letterSpacing: 1.8,
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            PERSONAL PORTFOLIO
          </div>
        </div>
      </div>

      {/* Center-left: Portfolio Value */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ borderLeft: "1px solid #1C2840", paddingLeft: 16 }}>
        <div
          style={{
            fontSize: 8,
            color: "#4A5A6E",
            letterSpacing: 1.8,
            textTransform: "uppercase",
          }}
        >
          PORTFOLIO VALUE
        </div>
        <div
          className="font-mono tabular-nums"
          style={{ fontSize: 22, fontWeight: 700, color: "#E8EDF2", lineHeight: 1.1 }}
        >
          ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
        <div
          className="font-mono tabular-nums"
          style={{ fontSize: 10, color: dayColor, lineHeight: 1, fontWeight: 600 }}
        >
          {dayChange >= 0 ? "+" : ""}${dayChange.toLocaleString("en-US", { minimumFractionDigits: 2 })} today
        </div>
        {cash > 0 && (
          <div
            className="font-mono tabular-nums"
            style={{ fontSize: 9, color: "#3A4A5C", lineHeight: 1, marginTop: 2 }}
          >
            CASH ${cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {/* Center: Period Returns */}
      <div className="flex items-center gap-0 flex-shrink-0">
        <div
          style={{
            fontSize: 8,
            color: "#4A5A6E",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginRight: 10,
          }}
        >
          CHANGE
        </div>
        {periodReturns.map((p) => (
          <div
            key={p.label}
            className="flex flex-col items-center"
            style={{
              padding: "2px 10px",
              borderLeft: "1px solid #1C2840",
            }}
          >
            <div style={{ fontSize: 8, color: "#4A5A6E", letterSpacing: 1.2 }}>
              {p.label}
            </div>
            <div
              className="font-mono tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: p.value === null ? "#3A4A5C" : p.value >= 0 ? "#00E6A8" : "#FF4458",
                lineHeight: 1.2,
              }}
            >
              {p.value === null ? "—" : `${p.value >= 0 ? "+" : ""}${p.value.toFixed(1)}%`}
            </div>
          </div>
        ))}
      </div>

      {/* Center-right: Total Return */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ borderLeft: "1px solid #1C2840", paddingLeft: 14 }}>
        <div
          style={{
            fontSize: 8,
            color: "#4A5A6E",
            letterSpacing: 1.8,
            textTransform: "uppercase",
          }}
        >
          TOTAL P/L
        </div>
        <div
          className="font-mono tabular-nums"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: totalReturn >= 0 ? "#00E6A8" : "#FF4458",
            lineHeight: 1.1,
          }}
        >
          {totalReturn >= 0 ? "+" : ""}
          {totalReturn.toFixed(1)}%
        </div>
        <div
          className="font-mono tabular-nums"
          style={{ fontSize: 9, color: "#4A5A6E", lineHeight: 1 }}
        >
          {totalReturnDollar >= 0 ? "+" : ""}${totalReturnDollar.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Right: Sentiment + Live + Market */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex flex-col items-center">
          <div style={{ fontSize: 8, color: "#4A5A6E", letterSpacing: 1.5, textTransform: "uppercase" }}>
            SENTIMENT
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: liveSentiment?.sentiment === "BULLISH" ? "#00E6A8" : liveSentiment?.sentiment === "BEARISH" ? "#FF4458" : "#F0883E",
            letterSpacing: 1.2,
          }}>
            {liveSentiment?.sentiment || "LOADING"}
          </div>
        </div>

        <div className="flex flex-col items-center" style={{ borderLeft: "1px solid #1C2840", paddingLeft: 10 }}>
          <div className="flex items-center gap-1">
            <div
              className="animate-pulse-dot"
              style={{ width: 6, height: 6, borderRadius: "50%", background: liveQuotes ? "#00E6A8" : "#F0883E", boxShadow: liveQuotes ? "0 0 5px rgba(0,230,168,0.4)" : "none" }}
            />
            <span style={{ fontSize: 8, color: liveQuotes ? "#00E6A8" : "#F0883E", letterSpacing: 1.2, fontWeight: 700 }}>
              {liveQuotes ? "LIVE" : "LOADING"}
            </span>
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: 9, color: "#4A5A6E" }}>
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "America/Chicago" })} CST
          </div>
        </div>

        {(() => {
          const quoteMktStatus = liveQuotes?.quotes?.[0]?.marketStatus;
          const sentimentMktStatus = liveSentiment?.marketStatus;
          // Prefer quotes-based status (reliable); only use sentiment if it's a real value (not "unknown")
          const mktStatus = (quoteMktStatus && quoteMktStatus !== "unknown" ? quoteMktStatus : null)
            || (sentimentMktStatus && sentimentMktStatus !== "unknown" ? sentimentMktStatus : null)
            || "unknown";
          const isOpen = mktStatus === "open";
          return (
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.2,
                padding: "4px 10px",
                borderRadius: 3,
                background: isOpen ? "rgba(0, 230, 168, 0.1)" : "rgba(255, 68, 88, 0.1)",
                color: isOpen ? "#00E6A8" : "#FF4458",
                border: `1px solid ${isOpen ? "rgba(0, 230, 168, 0.25)" : "rgba(255, 68, 88, 0.25)"}`,
              }}
            >
              MARKET {isOpen ? "OPEN" : "CLOSED"}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
