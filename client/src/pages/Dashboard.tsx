import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { TickerTape } from "@/components/TickerTape";
import { HoldingsTable } from "@/components/HoldingsTable";
import { PerformanceChart } from "@/components/PerformanceChart";
import { MarketPulse } from "@/components/MarketPulse";
import { SectorAllocation } from "@/components/SectorAllocation";
import { EarningsCalendar } from "@/components/EarningsCalendar";
import { PositionAttribution } from "@/components/PositionAttribution";
import { TopMovers } from "@/components/TopMovers";
import { NewsTicker } from "@/components/NewsTicker";
import { AgentConsole } from "@/components/AgentConsole";
import { SettingsTab } from "@/pages/SettingsTab";
import { NavRail } from "@/components/NavRail";
import { TradeHistory } from "@/components/TradeHistory";
import { AIAnalyst } from "@/components/AIAnalyst";
import { AddPositionDialog } from "@/components/AddPositionDialog";
import { LogTradeDialog } from "@/components/LogTradeDialog";
import { MarketTab } from "@/pages/MarketTab";
import { ScreenerTab } from "@/pages/ScreenerTab";
import { MAPOScoreTab } from "@/pages/MAPOScoreTab";
import { RebalanceTab } from "@/pages/RebalanceTab";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { DrawdownAlerts } from "@/components/dashboard/DrawdownAlerts";
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { AnalyzePage } from "@/components/pages/AnalyzePage";
import { ScreenPage } from "@/components/pages/ScreenPage";
import { RebalancePage } from "@/components/pages/RebalancePage";
import { TradeLogPage } from "@/components/pages/TradeLogPage";
import { BriefingPanel } from "@/components/panels/BriefingPanel";
import { JournalTab } from "@/pages/JournalTab";
import { useHoldings, usePortfolios, useSummary, useLiveQuotes, useLiveEarnings, useLiveSentiment, useLiveNews, useAnalytics } from "@/hooks/use-portfolio";
import { useIsMobile } from "@/hooks/use-mobile";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Bot, Plus, ArrowRightLeft, BarChart2, Globe, Search, Star, RefreshCw, BookOpen } from "lucide-react";

type TabId = "PORTFOLIO" | "MARKET" | "SCREENER" | "MAPO" | "REBALANCE" | "JOURNAL" | "TRADES" | "SETTINGS";

const TABS: { id: TabId; label: string }[] = [
  { id: "PORTFOLIO", label: "PORTFOLIO" },
  { id: "MARKET", label: "MARKET" },
  { id: "SCREENER", label: "SCREENER" },
  { id: "MAPO", label: "MAPO SCORE" },
  { id: "REBALANCE", label: "REBALANCE" },
  { id: "TRADES", label: "TRADE LOG" },
  { id: "JOURNAL", label: "JOURNAL" },
  { id: "SETTINGS", label: "SETTINGS" },
];

export default function Dashboard() {
  const [activePortfolioId, setActivePortfolioId] = useState<string>("");
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [logTradeOpen, setLogTradeOpen] = useState(false);
  const [analystOpen, setAnalystOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("PORTFOLIO");

  // Keyboard shortcuts
  useEffect(() => {
    const TAB_KEYS: Record<string, TabId> = {
      "1": "PORTFOLIO", "2": "MARKET", "3": "SCREENER",
      "4": "MAPO", "5": "REBALANCE", "6": "TRADES", "7": "JOURNAL",
    };
    function onKey(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (TAB_KEYS[e.key]) { setActiveTab(TAB_KEYS[e.key]); return; }
      if (e.key === "a" || e.key === "A") { setAddPositionOpen(true); return; }
      if (e.key === "t" || e.key === "T") { setLogTradeOpen(true); return; }
      if (e.key === "b" || e.key === "B") { setBriefingOpen(true); return; }
      if (e.key === "/" || e.key === "q" || e.key === "Q") { setAnalystOpen(true); return; }
      if (e.key === "Escape") { setAnalystOpen(false); setBriefingOpen(false); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Safety timeout: if loading takes >8s, show dashboard anyway
  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const { data: portfolios, isLoading: portfoliosLoading, isError: portfoliosError } = usePortfolios();

  // Auto-select first portfolio when portfolios load (or when active one is deleted)
  useEffect(() => {
    if (portfolios && portfolios.length > 0) {
      if (!activePortfolioId || !portfolios.find((p) => p.id === activePortfolioId)) {
        setActivePortfolioId(portfolios[0].id);
      }
    }
  }, [portfolios, activePortfolioId]);

  // If loading timed out but we still have no portfolio, set a fallback
  useEffect(() => {
    if (loadingTimeout && !activePortfolioId && portfoliosError) {
      setActivePortfolioId("fallback");
    }
  }, [loadingTimeout, activePortfolioId, portfoliosError]);

  const { data: holdings, isLoading: holdingsLoading, isError: holdingsError } = useHoldings(activePortfolioId || undefined);
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useSummary(activePortfolioId || undefined);

  // Live data — triggers server-side price updates + caches
  const { data: liveQuotesData } = useLiveQuotes(activePortfolioId || undefined);
  const { data: liveEarnings } = useLiveEarnings(activePortfolioId || undefined);
  const { data: liveSentiment } = useLiveSentiment();
  const { data: liveNews } = useLiveNews(activePortfolioId || undefined);
  const { data: analytics } = useAnalytics(activePortfolioId || undefined);
  const isMobile = useIsMobile();

  // When live quotes arrive, refetch holdings & summary to get updated prices
  const liveUpdatedAt = liveQuotesData?.updatedAt;
  useEffect(() => {
    if (liveUpdatedAt) {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"], exact: false });
    }
  }, [liveUpdatedAt]);

  // Only block on initial portfolio load — errors should not block rendering
  // After 8s timeout, force-show the dashboard even if data hasn't arrived
  const stillLoading = portfoliosLoading || (!holdingsError && holdingsLoading) || (!summaryError && summaryLoading);
  const shouldShowLoader = !loadingTimeout && stillLoading && !activePortfolioId;
  if (shouldShowLoader) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ background: "#040810" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--color-primary)", opacity: 0.8 }} />
          <span
            style={{
              fontSize: 10,
              color: "#5A6B80",
              textTransform: "uppercase",
              letterSpacing: 2.5,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Initializing terminal...
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#2E3E52",
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Connecting to market data
          </span>
        </div>
      </div>
    );
  }

  const holdingsData = holdings ?? [];
  const totalValue = summary?.totalValue ?? 0;

  // ─── MOBILE LAYOUT ───────────────────────────────────────────────────────────
  if (isMobile) {
    const MOBILE_TABS: { id: TabId; label: string; icon: typeof BarChart2 }[] = [
      { id: "PORTFOLIO", label: "Portfolio", icon: BarChart2 },
      { id: "MARKET", label: "Market", icon: Globe },
      { id: "SCREENER", label: "Screen", icon: Search },
      { id: "MAPO", label: "MAPO", icon: Star },
      { id: "REBALANCE", label: "Rebalance", icon: RefreshCw },
      { id: "TRADES", label: "Trades", icon: ArrowRightLeft },
      { id: "JOURNAL", label: "Journal", icon: BookOpen },
    ];

    return (
      <div style={{ background: "#040810", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Mobile Header */}
        <div
          style={{
            background: "#070B14",
            borderBottom: "1px solid #1C2840",
            padding: "10px 14px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 26, height: 26, borderRadius: 4,
                  background: "linear-gradient(135deg, #D4A853 0%, #0088CC 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "#040810",
                  fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1,
                }}
              >
                MT
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#D6DFE8", letterSpacing: 2 }}>MAPO</div>
                <div style={{ fontSize: 9, color: "#3A4A5C", letterSpacing: 1 }}>TERMINAL</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="font-mono tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: "#E8EDF2", lineHeight: 1 }}>
                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 2 }}>
                <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: (summary?.dayChange ?? 0) >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                  {(summary?.dayChange ?? 0) >= 0 ? "+" : ""}${Math.abs(summary?.dayChange ?? 0).toFixed(2)} today
                </span>
                <span
                  style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                    background: (liveSentiment?.marketStatus === "open") ? "rgba(0,230,168,0.1)" : "var(--color-red-a10)",
                    color: (liveSentiment?.marketStatus === "open") ? "var(--color-green)" : "var(--color-red)",
                    border: `1px solid ${(liveSentiment?.marketStatus === "open") ? "rgba(0,230,168,0.2)" : "var(--color-red-a20)"}`,
                  }}
                >
                  MKT {(liveSentiment?.marketStatus === "open") ? "OPEN" : "CLOSED"}
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio P/L row */}
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            {[
              { label: "TOTAL P/L", value: `${(summary?.totalGainLossPct ?? 0) >= 0 ? "+" : ""}${(summary?.totalGainLossPct ?? 0).toFixed(2)}%`, color: (summary?.totalGainLossPct ?? 0) >= 0 ? "var(--color-green)" : "var(--color-red)" },
              { label: "POSITIONS", value: String(summary?.holdingsCount ?? 0), color: "#8B949E" },
              { label: "CASH", value: `$${(summary?.cash ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "#8B949E" },
              { label: "SENTIMENT", value: liveSentiment?.sentiment ?? "—", color: liveSentiment?.sentiment === "BULLISH" ? "var(--color-green)" : liveSentiment?.sentiment === "BEARISH" ? "var(--color-red)" : "var(--color-orange)" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 8, color: "#4A5A6E", letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
                <div className="font-mono tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile ticker tape */}
        <TickerTape />

        {/* Mobile tab bar — horizontally scrollable */}
        <div
          style={{
            display: "flex",
            background: "#070B14",
            borderBottom: "1px solid #1C2840",
            overflowX: "auto",
            flexShrink: 0,
            WebkitOverflowScrolling: "touch" as any,
          }}
        >
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "8px 16px", gap: 3, flexShrink: 0,
                  background: active ? "var(--color-primary-a06)" : "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid #D4A853" : "2px solid transparent",
                  color: active ? "var(--color-primary)" : "#5A6B80",
                  cursor: "pointer",
                  minWidth: 64,
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile tab content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {activeTab === "PORTFOLIO" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Holdings */}
              <div style={{ height: 380, flexShrink: 0 }}>
                <HoldingsTable holdings={holdingsData} totalValue={totalValue} />
              </div>
              {/* Performance */}
              <div style={{ height: 280, flexShrink: 0, borderTop: "1px solid #1C2840" }}>
                <PerformanceChart portfolioId={activePortfolioId} />
              </div>
              {/* Sector Allocation */}
              <div style={{ height: 320, flexShrink: 0, borderTop: "1px solid #1C2840" }}>
                <SectorAllocation holdings={holdingsData} totalValue={totalValue} />
              </div>
              {/* Top Movers */}
              <div style={{ height: 240, flexShrink: 0, borderTop: "1px solid #1C2840" }}>
                <TopMovers holdings={holdingsData} portfolioId={activePortfolioId} />
              </div>
              {/* Trade History */}
              <div style={{ height: 320, flexShrink: 0, borderTop: "1px solid #1C2840" }}>
                <TradeHistory portfolioId={activePortfolioId} />
              </div>
              {/* Drawdown Alerts */}
              <div style={{ padding: "12px 16px", flexShrink: 0, borderTop: "1px solid #1C2840" }}>
                <DrawdownAlerts />
              </div>
              {/* Morning Briefing */}
              <div style={{ padding: "12px 16px", flexShrink: 0, borderTop: "1px solid #1C2840" }}>
                <MorningBriefing />
              </div>
            </div>
          )}
          {activeTab === "MARKET" && (
            <div style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
              <MarketTab portfolioHoldings={holdingsData.map((h) => ({ ticker: h.ticker, name: h.name, gainLossPct: h.gainLossPct ?? 0, dayChangePct: h.dayChangePct ?? 0 }))} />
            </div>
          )}
          {activeTab === "SCREENER" && (
            <div style={{ minHeight: 500 }}>
              <ScreenerTab />
            </div>
          )}
          {activeTab === "MAPO" && (
            <div style={{ minHeight: 500 }}>
              <MAPOScoreTab />
            </div>
          )}
          {activeTab === "REBALANCE" && (
            <div style={{ minHeight: 500 }}>
              <RebalanceTab portfolioId={activePortfolioId} />
            </div>
          )}
          {activeTab === "TRADES" && (
            <div style={{ minHeight: 500 }}>
              <TradeLogPage />
            </div>
          )}
          {activeTab === "JOURNAL" && (
            <div style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
              <JournalTab />
            </div>
          )}
        </div>

        {/* Mobile bottom action bar */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#070B14",
            borderTop: "1px solid #1C2840",
            display: "flex",
            padding: "8px 12px",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
            gap: 8,
            zIndex: 50,
          }}
        >
          <button
            onClick={() => setAddPositionOpen(true)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px", borderRadius: 6, border: "1px solid var(--color-primary-a25)",
              background: "var(--color-primary-a08)", color: "var(--color-primary)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            }}
          >
            <Plus size={13} />
            ADD
          </button>
          <button
            onClick={() => setLogTradeOpen(true)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px", borderRadius: 6, border: "1px solid var(--color-red-a20)",
              background: "rgba(255,68,88,0.07)", color: "var(--color-red)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            }}
          >
            <ArrowRightLeft size={13} />
            TRADE
          </button>
          <button
            onClick={() => setAnalystOpen(true)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px", borderRadius: 6, border: "none",
              background: "linear-gradient(135deg, #C49B3C 0%, #8B6420 100%)", color: "#fff",
              fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
              boxShadow: "0 2px 12px var(--color-primary-a25)",
            }}
          >
            <Bot size={13} />
            ANALYST
          </button>
        </div>

        {/* Dialogs — shared with desktop */}
        <AIAnalyst portfolioId={activePortfolioId} open={analystOpen} onClose={() => setAnalystOpen(false)} />
        <AddPositionDialogControlled open={addPositionOpen} onOpenChange={setAddPositionOpen} activePortfolioId={activePortfolioId} />
        <LogTradeDialog open={logTradeOpen} onOpenChange={setLogTradeOpen} portfolioId={activePortfolioId} />
        <BriefingPanel open={briefingOpen} onClose={() => setBriefingOpen(false)} />
      </div>
    );
  }
  // ─── END MOBILE LAYOUT ───────────────────────────────────────────────────────

  return (
    <div
      className="h-screen w-screen flex overflow-hidden"
      style={{ background: "#080C14" }}
    >
      {/* Main terminal area */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
        {/* Header bar */}
        <Header portfolioId={activePortfolioId} liveSentiment={liveSentiment} liveQuotes={liveQuotesData} />

        {/* Markets ticker tape */}
        <TickerTape />

        {/* Body: nav rail + content side by side */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Vertical nav rail */}
        <NavRail
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activePortfolioId={activePortfolioId}
          onSelectPortfolio={setActivePortfolioId}
          onAddPosition={() => setAddPositionOpen(true)}
          onLogTrade={() => setLogTradeOpen(true)}
          onBriefing={() => setBriefingOpen(true)}
        />

        {/* Content column */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>

        {/* Portfolio stats bar — always visible */}
        {activePortfolioId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 34,
              minHeight: 34,
              background: "#060A11",
              borderBottom: "1px solid #131E2E",
              padding: "0 12px",
              gap: 0,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {[
              {
                label: "VALUE",
                value: summary
                  ? `$${summary.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                  : "—",
                color: "var(--color-primary)",
                bold: true,
              },
              {
                label: "DAY",
                value: summary
                  ? `${summary.dayChange >= 0 ? "+" : ""}$${Math.abs(summary.dayChange).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${summary.dayChangePct >= 0 ? "+" : ""}${summary.dayChangePct.toFixed(2)}%)`
                  : "—",
                color: summary
                  ? summary.dayChange >= 0 ? "var(--color-green)" : "var(--color-red)"
                  : "#3A4A5C",
              },
              {
                label: "P&L",
                value: summary
                  ? `${summary.totalGainLoss >= 0 ? "+" : ""}$${Math.abs(summary.totalGainLoss).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${summary.totalGainLossPct >= 0 ? "+" : ""}${summary.totalGainLossPct.toFixed(2)}%)`
                  : "—",
                color: summary
                  ? summary.totalGainLoss >= 0 ? "var(--color-green)" : "var(--color-red)"
                  : "#3A4A5C",
              },
              {
                label: "POS",
                value: summary ? String(summary.holdingsCount) : "—",
                color: "#8B949E",
              },
              {
                label: "CASH",
                value: summary
                  ? `$${summary.cash.toLocaleString("en-US", { maximumFractionDigits: 0 })} · ${summary.totalValue > 0 ? ((summary.cash / summary.totalValue) * 100).toFixed(1) : "0"}%`
                  : "—",
                color: "#8B949E",
              },
              {
                label: "β",
                value: analytics?.beta != null ? analytics.beta.toFixed(2) : "—",
                color: analytics?.beta != null
                  ? analytics.beta > 1.3 ? "var(--color-orange)" : analytics.beta < 0.7 ? "#A371F7" : "#8B949E"
                  : "#3A4A5C",
              },
              {
                label: "SHARPE",
                value: analytics?.sharpe != null ? analytics.sharpe.toFixed(2) : "—",
                color: analytics?.sharpe != null
                  ? analytics.sharpe >= 1.5 ? "var(--color-green)" : analytics.sharpe >= 0.5 ? "#8B949E" : "var(--color-red)"
                  : "#3A4A5C",
              },
              {
                label: "SORTINO",
                value: analytics?.sortino != null ? analytics.sortino.toFixed(2) : "—",
                color: "#8B949E",
              },
              {
                label: "MAX DD",
                value: analytics?.maxDrawdown != null ? `${analytics.maxDrawdown.toFixed(1)}%` : "—",
                color: analytics?.maxDrawdown != null
                  ? analytics.maxDrawdown < -20 ? "var(--color-red)" : analytics.maxDrawdown < -10 ? "var(--color-orange)" : "#8B949E"
                  : "#3A4A5C",
              },
              {
                label: "ANN VOL",
                value: analytics?.annualizedVol != null ? `${analytics.annualizedVol.toFixed(1)}%` : "—",
                color: "#8B949E",
              },
              {
                label: "BEST",
                value: summary?.bestPerformer
                  ? `${summary.bestPerformer.ticker} +${summary.bestPerformer.gainLossPct.toFixed(1)}%`
                  : "—",
                color: "var(--color-green)",
              },
              {
                label: "WORST",
                value: summary?.worstPerformer
                  ? `${summary.worstPerformer.ticker} ${summary.worstPerformer.gainLossPct.toFixed(1)}%`
                  : "—",
                color: "var(--color-red)",
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0 10px",
                  height: "100%",
                  borderRight: "1px solid #0F1825",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "#3A4A5C",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    fontWeight: 600,
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  {stat.label}
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}
                >
                  {stat.value}
                </span>
              </div>
            ))}
            {/* Spacer + keyboard hint */}
            <div style={{ flex: 1 }} />
            <div
              style={{
                fontSize: 10,
                color: "#2A3A4C",
                letterSpacing: 0.8,
                fontFamily: "'Inter', system-ui, sans-serif",
                flexShrink: 0,
                paddingRight: 4,
              }}
            >
              1–7 tabs · A add · T trade · B briefing · / analyst
            </div>
          </div>
        )}

        {/* Tab content */}
        {activeTab === "MARKET" && (
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <MarketTab
              portfolioHoldings={holdingsData.map((h) => ({
                ticker: h.ticker,
                name: h.name,
                gainLossPct: h.gainLossPct ?? 0,
                dayChangePct: h.dayChangePct ?? 0,
              }))}
            />
          </div>
        )}
        {activeTab === "SCREENER" && (
          <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
            <ScreenerTab />
          </div>
        )}
        {activeTab === "MAPO" && (
          <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
            <MAPOScoreTab />
          </div>
        )}
        {activeTab === "REBALANCE" && (
          <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
            <RebalanceTab portfolioId={activePortfolioId} />
          </div>
        )}
        {activeTab === "TRADES" && (
          <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
            <TradeLogPage />
          </div>
        )}
        {activeTab === "JOURNAL" && (
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <JournalTab />
          </div>
        )}

        {activeTab === "SETTINGS" && (
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <SettingsTab />
          </div>
        )}

        {/* Portfolio tab — 3-column × 2-row, 6 panels */}
        <div
          className="flex-1 overflow-hidden"
          style={{
            display: activeTab === "PORTFOLIO" ? "grid" : "none",
            gridTemplateColumns: "1.4fr 1.8fr 1.2fr",
            gridTemplateRows: "1fr 1fr",
            gap: 0,
            minHeight: 0,
            background: "#0A0E1A",
          }}
        >
          {/* Row 1, Col 1: Position Attribution */}
          <div className="flex flex-col" style={{ borderRight: "1px solid #1C2840", borderBottom: "1px solid #1C2840", overflow: "hidden" }}>
            <PositionAttribution holdings={holdingsData} totalValue={totalValue} />
          </div>

          {/* Row 1, Col 2: Performance Chart */}
          <div className="flex flex-col" style={{ borderRight: "1px solid #1C2840", borderBottom: "1px solid #1C2840", overflow: "hidden" }}>
            <PerformanceChart portfolioId={activePortfolioId} />
          </div>

          {/* Row 1, Col 3: Earnings Calendar */}
          <div className="flex flex-col" style={{ borderBottom: "1px solid #1C2840", overflow: "auto" }}>
            <EarningsCalendar holdings={holdingsData} liveEarnings={liveEarnings} />
          </div>

          {/* Row 2, Col 1: Market Pulse */}
          <div className="flex flex-col" style={{ borderRight: "1px solid #1C2840", overflow: "hidden" }}>
            <MarketPulse />
          </div>

          {/* Row 2, Col 2: Holdings */}
          <div className="flex flex-col" style={{ borderRight: "1px solid #1C2840", overflow: "auto" }}>
            <HoldingsTable holdings={holdingsData} totalValue={totalValue} />
          </div>

          {/* Row 2, Col 3: Sector Allocation */}
          <div className="flex flex-col" style={{ overflow: "hidden" }}>
            <SectorAllocation holdings={holdingsData} totalValue={totalValue} />
          </div>
        </div>

        {/* Agent Operations Console — persistent above news ticker */}
        <AgentConsole />

        {/* News ticker at bottom — only on portfolio tab */}
        {activeTab === "PORTFOLIO" && <NewsTicker holdings={holdingsData} liveNews={liveNews} />}
        </div>{/* end content column */}
        </div>{/* end body row (nav + content) */}
      </div>{/* end main terminal area */}

      {/* AI Analyst FAB */}
      <button
        onClick={() => setAnalystOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 46,
          height: 46,
          borderRadius: 12,
          background: "linear-gradient(135deg, #C49B3C 0%, #8B6420 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px var(--color-primary-a30), 0 0 0 1px var(--color-primary-a15)",
          border: "none",
          cursor: "pointer",
          zIndex: 90,
          transition: "all 0.2s ease",
          opacity: analystOpen ? 0 : 1,
          pointerEvents: analystOpen ? "none" : "auto",
          transform: analystOpen ? "scale(0.8)" : "scale(1)",
        }}
        onMouseEnter={(e) => {
          if (!analystOpen) {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 28px rgba(212,168,83,0.45), 0 0 0 1px var(--color-primary-a25)";
          }
        }}
        onMouseLeave={(e) => {
          if (!analystOpen) {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 24px var(--color-primary-a30), 0 0 0 1px var(--color-primary-a15)";
          }
        }}
        data-testid="button-open-analyst"
      >
        <Bot size={20} color="#fff" />
      </button>

      {/* AI Analyst Panel */}
      <AIAnalyst
        portfolioId={activePortfolioId}
        open={analystOpen}
        onClose={() => setAnalystOpen(false)}
      />

      {/* Add Position Dialog (controlled by sidebar) */}
      <AddPositionDialogControlled
        open={addPositionOpen}
        onOpenChange={setAddPositionOpen}
        activePortfolioId={activePortfolioId}
      />

      {/* Log Trade Dialog */}
      <LogTradeDialog
        open={logTradeOpen}
        onOpenChange={setLogTradeOpen}
        portfolioId={activePortfolioId}
      />

      {/* Morning Briefing Panel */}
      <BriefingPanel open={briefingOpen} onClose={() => setBriefingOpen(false)} />
    </div>
  );
}

/* Controlled version of AddPositionDialog that takes open/onOpenChange props */
import { useCreateHolding } from "@/hooks/use-portfolio";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function AddPositionDialogControlled({
  open,
  onOpenChange,
  activePortfolioId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activePortfolioId: string;
}) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("Stock");
  const [sector, setSector] = useState("Other");

  const createHolding = useCreateHolding();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const cost = parseFloat(costBasis);
    const prc = parseFloat(price) || cost / qty;
    const value = qty * prc;
    const gainLoss = value - cost;
    const gainLossPct = cost > 0 ? (gainLoss / cost) * 100 : 0;

    const portfolioId = activePortfolioId;
    if (!portfolioId) {
      toast({ title: "Error", description: "No portfolio found", variant: "destructive" });
      return;
    }

    createHolding.mutate(
      {
        portfolioId,
        ticker: ticker.toUpperCase(),
        name,
        quantity: qty,
        costBasis: cost,
        price: prc,
        value,
        dayChange: 0,
        dayChangePct: 0,
        gainLoss,
        gainLossPct,
        type,
        sector,
        source: "manual",
      },
      {
        onSuccess: () => {
          toast({ title: "Position added", description: `${ticker.toUpperCase()} added to portfolio` });
          onOpenChange(false);
          resetForm();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to add position", variant: "destructive" });
        },
      }
    );
  }

  function resetForm() {
    setTicker("");
    setName("");
    setQuantity("");
    setCostBasis("");
    setPrice("");
    setType("Stock");
    setSector("Other");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          background: "#0B0F1A",
          border: "1px solid #1C2840",
          borderRadius: 4,
          maxWidth: 420,
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#C9D1D9",
            }}
          >
            Add Position
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Ticker</Label>
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="AAPL"
                required
                className="mt-1 font-mono"
                style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 11 }}
              />
            </div>
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apple Inc."
                required
                className="mt-1"
                style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 11 }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Quantity</Label>
              <Input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                required
                className="mt-1 font-mono"
                style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 11 }}
              />
            </div>
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Total Cost</Label>
              <Input
                type="number"
                step="any"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder="15000"
                required
                className="mt-1 font-mono"
                style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 11 }}
              />
            </div>
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Current Price</Label>
              <Input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="175.00"
                className="mt-1 font-mono"
                style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 11 }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1" style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 10 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0B0F1A", border: "1px solid #1C2840" }}>
                  <SelectItem value="Stock">Stock</SelectItem>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="Bond">Bond</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: 0.8 }}>Sector</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="mt-1" style={{ background: "#080C14", border: "1px solid #1C2840", color: "#C9D1D9", fontSize: 10 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#0B0F1A", border: "1px solid #1C2840" }}>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Financials">Financials</SelectItem>
                  <SelectItem value="Energy">Energy</SelectItem>
                  <SelectItem value="Industrials">Industrials</SelectItem>
                  <SelectItem value="Consumer Discretionary">Consumer Disc.</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            style={{
              background: "var(--color-primary)",
              color: "#080C14",
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
            disabled={createHolding.isPending}
          >
            {createHolding.isPending ? "Adding..." : "Add Position"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
