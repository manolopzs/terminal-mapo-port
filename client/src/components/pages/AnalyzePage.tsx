import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { T } from "@/styles/tokens";
import { DataCard } from "@/components/terminal/DataCard";
import { Badge } from "@/components/terminal/Badge";
import { ScoreBar } from "@/components/terminal/ScoreBar";
import { SignalBadge } from "@/components/terminal/SignalBadge";
import { useHoldings } from "@/hooks/use-portfolio";

// ── Types ──────────────────────────────────────────────────────────────────

interface FactorDetail {
  base: number;
  adjusted: number;
  notes: string;
}

interface QuantSignals {
  momentum: { confirmed: boolean; return12m: number };
  goldenCross: { confirmed: boolean; sma50: number; sma200: number };
  sue: { confirmed: boolean; score: number; latestSurprisePct: number };
  revisions: { confirmed: boolean; revisionPct: number };
  beta: { value: number; lowVol: boolean; highVol: boolean };
  valueFactor: { confirmed: boolean; currentEvEbitda: number; avgEvEbitda: number };
  donchian: { position: number; valid: boolean; reject: boolean; high52w: number; low52w: number };
  compositeCount: number;
}

interface AnalysisResult {
  ticker: string;
  profile: { companyName: string; sector: string; marketCap: number; price: number };
  quantSignals: QuantSignals | null;
  scoring: {
    factors: Record<string, FactorDetail>;
    compositeScore: number;
    rating: string;
    bullCase: string[];
    bearCase: string[];
    recommendation: string;
    agiAlignment: string;
  } | null;
  rejected: boolean;
  rejectReason?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

function isSignalConfirmed(key: string, qs: QuantSignals): boolean {
  switch (key) {
    case "momentum":    return qs.momentum.confirmed;
    case "goldenCross": return qs.goldenCross.confirmed;
    case "sue":         return qs.sue.confirmed;
    case "revisions":   return qs.revisions.confirmed;
    case "beta":        return qs.beta.lowVol;
    case "valueFactor": return qs.valueFactor.confirmed;
    case "donchian":    return qs.donchian.valid && !qs.donchian.reject;
    default:            return false;
  }
}

function signalSubtext(key: string, qs: QuantSignals): string {
  switch (key) {
    case "momentum":    return `${qs.momentum.return12m >= 0 ? "+" : ""}${qs.momentum.return12m.toFixed(1)}% 12m`;
    case "goldenCross": return `50d/${qs.goldenCross.sma50.toFixed(0)} 200d/${qs.goldenCross.sma200.toFixed(0)}`;
    case "sue":         return `${qs.sue.latestSurprisePct >= 0 ? "+" : ""}${qs.sue.latestSurprisePct.toFixed(1)}%`;
    case "revisions":   return `${qs.revisions.revisionPct >= 0 ? "+" : ""}${qs.revisions.revisionPct.toFixed(1)}%`;
    case "beta":        return `β${qs.beta.value.toFixed(2)}`;
    case "valueFactor": return `EV/EBITDA ${qs.valueFactor.currentEvEbitda.toFixed(1)}x`;
    case "donchian":    return `pos ${(qs.donchian.position * 100).toFixed(0)}%`;
    default:            return "";
  }
}

const SIGNAL_DEFS = [
  { key: "momentum",    label: "MOM" },
  { key: "goldenCross", label: "GX" },
  { key: "sue",         label: "SUE" },
  { key: "revisions",   label: "REV" },
  { key: "beta",        label: "BETA" },
  { key: "valueFactor", label: "VAL" },
  { key: "donchian",    label: "DCH" },
];

const FACTOR_ORDER = [
  "financialHealth",
  "valuation",
  "growth",
  "technical",
  "sentiment",
  "macroAlignment",
];

const FACTOR_COLORS: Record<string, string> = {
  financialHealth: T.green,
  valuation:       T.blue,
  growth:          T.purple,
  technical:       T.amber,
  sentiment:       T.rose,
  macroAlignment:  T.cyan,
};

function formatFactorName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function ratingColor(rating: string): string {
  switch (rating) {
    case "STRONG_BUY": return T.green;
    case "BUY":        return T.blue;
    case "HOLD":       return T.amber;
    case "AVOID":      return T.red;
    default:           return T.dim;
  }
}

// ── Loading steps component ────────────────────────────────────────────────

const STEPS = [
  "Fetching financial profile",
  "Computing quant signals",
  "Running 6-factor scoring",
  "Generating recommendation",
];

function AnalysisLoadingCard() {
  return (
    <DataCard>
      <div style={{ padding: 20 }}>
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: 11,
            color: T.green,
            letterSpacing: "0.1em",
            marginBottom: 16,
            textTransform: "uppercase" as const,
          }}
        >
          Running MAPO Analysis Pipeline...
        </div>
        {STEPS.map((step, i) => (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              opacity: 0,
              animation: `fadeSlideIn 300ms ease ${i * 800}ms forwards`,
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: 12,
                color: T.green,
                animation: "pulse 1s infinite",
              }}
            >
              ▶
            </span>
            <span
              style={{ fontFamily: T.font.mono, fontSize: 11, color: T.dim }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </DataCard>
  );
}

// ── Trade modal ────────────────────────────────────────────────────────────

interface TradeModalProps {
  ticker: string;
  price: number;
  onClose: () => void;
}

function TradeModal({ ticker, price, onClose }: TradeModalProps) {
  const [shares, setShares] = useState("");
  const [tradePrice, setTradePrice] = useState(price.toFixed(2));
  const [rationale, setRationale] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BUY",
          ticker,
          shares: parseFloat(shares),
          price: parseFloat(tradePrice),
          rationale,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed" as const,
        inset: 0,
        background: "rgba(7,8,12,0.8)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderTop: `2px solid ${T.green}`,
          borderRadius: 6,
          padding: 24,
          width: 400,
          maxWidth: "95vw",
        }}
        onClick={(e) => e.stopPropagation()}
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
              color: T.green,
              letterSpacing: "0.12em",
            }}
          >
            Execute BUY — {ticker}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: T.dim,
              cursor: "pointer",
              fontFamily: T.font.mono,
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div
            style={{
              fontFamily: T.font.mono,
              fontSize: 12,
              color: T.green,
              textAlign: "center" as const,
              padding: 16,
            }}
          >
            Order submitted successfully.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            <div>
              <label
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.muted,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Shares
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 14,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  color: T.white,
                  padding: "8px 12px",
                  borderRadius: 4,
                  width: "100%",
                  outline: "none",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.muted,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Price
              </label>
              <input
                type="number"
                value={tradePrice}
                onChange={(e) => setTradePrice(e.target.value)}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 14,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  color: T.white,
                  padding: "8px 12px",
                  borderRadius: 4,
                  width: "100%",
                  outline: "none",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.muted,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Rationale
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  color: T.white,
                  padding: "8px 12px",
                  borderRadius: 4,
                  width: "100%",
                  outline: "none",
                  resize: "vertical" as const,
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            {error && (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  color: T.red,
                }}
              >
                {error}
              </span>
            )}

            <button
              onClick={execute}
              disabled={loading || !shares}
              style={{
                fontFamily: T.font.mono,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
                background: loading || !shares ? T.muted : T.green,
                color: loading || !shares ? T.dim : T.bg,
                border: "none",
                padding: "10px 0",
                borderRadius: 4,
                cursor: loading || !shares ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              {loading ? "Submitting..." : "Execute BUY"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function AnalyzePage() {
  const [location] = useLocation();
  const [ticker, setTicker] = useState(() => {
    // Pre-fill from URL ?ticker=XXX
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("ticker") ?? "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentTickers, setRecentTickers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mapo_recent_tickers") || "[]");
    } catch {
      return [];
    }
  });
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [scoreBarsVisible, setScoreBarsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: holdingsData } = useHoldings();
  const holdings = holdingsData ?? [];

  const analyze = async (t?: string) => {
    const sym = (t ?? ticker).trim().toUpperCase();
    if (!sym) return;
    setTicker(sym);
    setLoading(true);
    setResult(null);
    setError(null);
    setScoreBarsVisible(false);

    const recent = JSON.parse(
      localStorage.getItem("mapo_recent_tickers") || "[]"
    );
    const updated = [sym, ...recent.filter((x: string) => x !== sym)].slice(0, 5);
    localStorage.setItem("mapo_recent_tickers", JSON.stringify(updated));
    setRecentTickers(updated);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sym }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      // Trigger score bars animation after render
      setTimeout(() => setScoreBarsVisible(true), 50);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze if pre-filled ticker
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (!hasAutoRun.current && ticker) {
      hasAutoRun.current = true;
      analyze(ticker);
    }
  }, []);

  const score = result?.scoring?.compositeScore ?? 0;
  const isInPortfolio = holdings.some((h) => h.ticker === result?.ticker);

  const donchian = result?.quantSignals?.donchian;

  return (
    <div style={{ animation: "fadeSlideIn 200ms ease forwards" }}>
      {/* SECTION 1: Input Bar */}
      <DataCard>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="ENTER TICKER..."
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              style={{
                fontFamily: T.font.mono,
                fontSize: 16,
                background: T.surfaceAlt,
                border: `1px solid ${T.border}`,
                color: T.white,
                caretColor: T.green,
                borderRadius: 6,
                padding: "12px 16px",
                width: 240,
                outline: "none",
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.border = `1px solid ${T.green}`;
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.border = `1px solid ${T.border}`;
              }}
            />
            <button
              onClick={() => analyze()}
              disabled={loading || !ticker.trim()}
              style={{
                fontFamily: T.font.mono,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
                background:
                  loading || !ticker.trim() ? T.muted : T.green,
                color: loading || !ticker.trim() ? T.dim : T.bg,
                border: "none",
                padding: "10px 20px",
                borderRadius: 4,
                cursor:
                  loading || !ticker.trim() ? "not-allowed" : "pointer",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!loading && ticker.trim())
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#00cc88";
              }}
              onMouseLeave={(e) => {
                if (!loading && ticker.trim())
                  (e.currentTarget as HTMLButtonElement).style.background =
                    T.green;
              }}
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          {/* Recent Tickers */}
          {recentTickers.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 12,
                flexWrap: "wrap" as const,
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.muted,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  alignSelf: "center",
                }}
              >
                Recent:
              </span>
              {recentTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => analyze(t)}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    background: T.surfaceAlt,
                    border: `1px solid ${T.border}`,
                    color: T.green,
                    padding: "3px 8px",
                    borderRadius: 3,
                    cursor: "pointer",
                    transition: "border-color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      T.green;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      T.border;
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </DataCard>

      {/* Error State */}
      {error && !loading && (
        <div style={{ marginTop: 12 }}>
          <DataCard accent={T.red}>
            <div style={{ padding: "12px 16px" }}>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  color: T.red,
                }}
              >
                Error: {error}
              </span>
            </div>
          </DataCard>
        </div>
      )}

      {/* SECTION 2: Loading State */}
      {loading && (
        <div style={{ marginTop: 12 }}>
          <AnalysisLoadingCard />
        </div>
      )}

      {/* SECTION 3: Result Display */}
      {result && !loading && (
        <div style={{ marginTop: 12 }}>
          {/* Rejection Banner */}
          {result.rejected && (
            <DataCard accent={T.rose}>
              <div style={{ padding: 16, marginBottom: 12 }}>
                <div
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.rose,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.12em",
                    marginBottom: 6,
                  }}
                >
                  Rejected
                </div>
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: 13,
                    color: T.white,
                  }}
                >
                  {result.rejectReason ?? "Does not meet MAPO criteria."}
                </span>
              </div>
            </DataCard>
          )}

          {/* Header Card */}
          <DataCard>
            <div style={{ padding: 16, marginBottom: 12 }}>
              {/* Name + Ticker row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap" as const,
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    flexWrap: "wrap" as const,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.font.display,
                      fontSize: 20,
                      color: T.white,
                      fontWeight: 600,
                    }}
                  >
                    {result.profile.companyName}
                  </span>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 14,
                      color: T.green,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {result.ticker}
                  </span>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 22,
                      color: T.white,
                      fontWeight: 700,
                    }}
                  >
                    ${result.profile.price.toFixed(2)}
                  </div>
                  <div
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 12,
                      color: T.dim,
                      marginTop: 2,
                    }}
                  >
                    {fmt$(result.profile.marketCap)} Mkt Cap
                  </div>
                </div>
              </div>

              {/* Sector + 52w range */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap" as const,
                  marginBottom: donchian ? 12 : 0,
                }}
              >
                <Badge color={T.cyan}>{result.profile.sector}</Badge>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    color: T.dim,
                  }}
                >
                  {fmt$(result.profile.marketCap)}
                </span>
              </div>

              {/* 52w range bar */}
              {donchian && donchian.high52w > 0 && donchian.low52w >= 0 && (
                <div>
                  <div
                    style={{
                      position: "relative" as const,
                      background: T.border,
                      height: 6,
                      width: "100%",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute" as const,
                        left: `${Math.min(Math.max(((result.profile.price - donchian.low52w) / (donchian.high52w - donchian.low52w)) * 100, 0), 100)}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 2,
                        height: 10,
                        background: T.gold,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 3,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 9,
                        color: T.dim,
                      }}
                    >
                      ${donchian.low52w.toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 9,
                        color: T.dim,
                      }}
                    >
                      ${donchian.high52w.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </DataCard>

          {/* Quant Signals Row */}
          {result.quantSignals && (
            <DataCard>
              <div style={{ padding: "12px 16px", marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 9,
                        textTransform: "uppercase" as const,
                        color: T.muted,
                        letterSpacing: "0.12em",
                      }}
                    >
                      Quant Signals
                    </span>
                    <span
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: 9,
                        color: T.gold,
                      }}
                    >
                      {result.quantSignals.compositeCount}/7
                    </span>
                  </div>
                  {result.quantSignals.compositeCount >= 3 && (
                    <Badge color={T.green} filled>
                      Strong Setup
                    </Badge>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                  {SIGNAL_DEFS.map(({ key, label }) => (
                    <div key={key} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4 }}>
                      <SignalBadge
                        signal={label}
                        confirmed={isSignalConfirmed(key, result.quantSignals!)}
                      />
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: 8,
                          color: T.dim,
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {signalSubtext(key, result.quantSignals!)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </DataCard>
          )}

          {/* Scoring Section */}
          {result.scoring && (
            <DataCard>
              <div style={{ padding: 16, marginBottom: 12 }}>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    textTransform: "uppercase" as const,
                    color: T.muted,
                    letterSpacing: "0.12em",
                    display: "block",
                    marginBottom: 16,
                  }}
                >
                  6-Factor Scoring
                </span>

                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {FACTOR_ORDER.map((key, i) => {
                    const factor = result.scoring!.factors[key];
                    if (!factor) return null;
                    return (
                      <div
                        key={key}
                        style={{
                          opacity: scoreBarsVisible ? 1 : 0,
                          transition: `opacity 200ms ease ${i * 50}ms`,
                        }}
                      >
                        <ScoreBar
                          label={formatFactorName(key)}
                          score={factor.adjusted}
                          weight="25%"
                          color={FACTOR_COLORS[key] ?? T.green}
                          notes={factor.notes}
                        />
                      </div>
                    );
                  })}
                </div>

                <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />

                {/* Composite Score */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 48,
                      fontWeight: 700,
                      color: T.gold,
                      lineHeight: 1,
                    }}
                  >
                    {result.scoring.compositeScore}
                  </span>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 20,
                      color: T.dim,
                    }}
                  >
                    /100
                  </span>
                  <div style={{ marginLeft: 8 }}>
                    <Badge
                      color={ratingColor(result.scoring.rating)}
                      filled
                    >
                      {result.scoring.rating.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                {result.scoring.agiAlignment && (
                  <div
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 11,
                      color: T.dim,
                    }}
                  >
                    {result.scoring.agiAlignment}
                  </div>
                )}
              </div>
            </DataCard>
          )}

          {/* Bull / Bear Cases */}
          {result.scoring && (
            <div
              className="grid grid-cols-1 md:grid-cols-2"
              style={{ gap: 12, marginBottom: 12 }}
            >
              {/* Bull Case */}
              <DataCard accent={T.green}>
                <div style={{ padding: 16 }}>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 9,
                      textTransform: "uppercase" as const,
                      color: T.green,
                      letterSpacing: "0.12em",
                      display: "block",
                      marginBottom: 10,
                    }}
                  >
                    Bull Case
                  </span>
                  <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {result.scoring.bullCase.map((item, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          gap: 8,
                          marginBottom: 6,
                          lineHeight: 1.6,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: 11,
                            color: T.green,
                            flexShrink: 0,
                          }}
                        >
                          +{i + 1}
                        </span>
                        <span
                          style={{
                            fontFamily: T.font.sans,
                            fontSize: 12,
                            color: T.white,
                          }}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </DataCard>

              {/* Bear Case */}
              <DataCard accent={T.red}>
                <div style={{ padding: 16 }}>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 9,
                      textTransform: "uppercase" as const,
                      color: T.red,
                      letterSpacing: "0.12em",
                      display: "block",
                      marginBottom: 10,
                    }}
                  >
                    Bear Case
                  </span>
                  <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {result.scoring.bearCase.map((item, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          gap: 8,
                          marginBottom: 6,
                          lineHeight: 1.6,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: 11,
                            color: T.red,
                            flexShrink: 0,
                          }}
                        >
                          -{i + 1}
                        </span>
                        <span
                          style={{
                            fontFamily: T.font.sans,
                            fontSize: 12,
                            color: T.white,
                          }}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </DataCard>
            </div>
          )}

          {/* Recommendation */}
          {result.scoring && (
            <DataCard accent={score >= 65 ? T.green : T.amber}>
              <div style={{ padding: 16 }}>
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: 13,
                    color: T.white,
                    lineHeight: 1.6,
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  {result.scoring.recommendation}
                </span>

                {score >= 65 && (
                  <button
                    onClick={() => setTradeModalOpen(true)}
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.1em",
                      background: T.green,
                      color: T.bg,
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 4,
                      cursor: "pointer",
                      marginRight: 8,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#00cc88";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        T.green;
                    }}
                  >
                    Add to Portfolio
                  </button>
                )}

                {score < 50 && isInPortfolio && (
                  <Badge color={T.red} filled>
                    Consider Exit
                  </Badge>
                )}
              </div>
            </DataCard>
          )}
        </div>
      )}

      {/* Trade Modal */}
      {tradeModalOpen && result && (
        <TradeModal
          ticker={result.ticker}
          price={result.profile.price}
          onClose={() => setTradeModalOpen(false)}
        />
      )}
    </div>
  );
}
