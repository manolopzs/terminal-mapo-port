import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  startAgent,
  completeAgent,
  errorAgent,
  addLog,
  setLastOperation,
} from "@/lib/agent-bus";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORE_HISTORY_KEY = "mapo_score_history";
const QUICK_PICKS = ["HIMS", "OKTA", "COHR", "SEZL", "PLTR", "HOOD", "NVDA", "NET", "CRWD", "APP"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuantSignals {
  momentum: { confirmed: boolean; return12m: number };
  goldenCross: { confirmed: boolean; sma50: number; sma200: number };
  sue: { confirmed: boolean; score: number; latestSurprisePct: number };
  revisions: { confirmed: boolean; revisionPct: number };
  beta: { value: number; lowVol: boolean; highVol: boolean };
  valueFactor: { confirmed: boolean; currentEvEbitda: number; avgEvEbitda: number };
  donchian: { position: number; valid: boolean; reject: boolean; high52w: number; low52w: number };
  compositeCount: number;
  signalSummary: string;
}

interface ScoringFactors {
  financialHealth: { base: number; adjusted: number; notes: string };
  valuation: { base: number; adjusted: number; notes: string };
  growth: { base: number; adjusted: number; notes: string };
  technical: { base: number; adjusted: number; notes: string };
  sentiment: { base: number; adjusted: number; notes: string };
  macroAlignment: { base: number; adjusted: number; notes: string };
}

interface AnalysisResult {
  ticker: string;
  profile: any;
  quantSignals: QuantSignals | null;
  scoring: {
    factors: ScoringFactors;
    compositeScore: number;
    rating: "STRONG_BUY" | "BUY" | "HOLD" | "AVOID";
    bullCase: string[];
    bearCase: string[];
    recommendation: string;
    agiAlignment: string;
  } | null;
  rejected: boolean;
  rejectReason?: string;
  timestamp: string;
}

// Flat view model used internally after mapping
interface FactorDetail {
  base: number;
  adjusted: number;
  notes: string;
}

interface MappedResult {
  ticker: string;
  score: number;
  signal: string;
  factors: {
    financialHealth: number;
    valuation: number;
    growth: number;
    technical: number;
    sentiment: number;
    macroFit: number;
  };
  factorDetails: {
    financialHealth: FactorDetail;
    valuation: FactorDetail;
    growth: FactorDetail;
    technical: FactorDetail;
    sentiment: FactorDetail;
    macroFit: FactorDetail;
  } | null;
  thesis: string;
  catalysts: string[];
  risks: string[];
  entryNote: string;
  quantSignals: QuantSignals | null;
  rejected: boolean;
  rejectReason?: string;
}

interface ScoreHistoryEntry {
  ticker: string;
  score: number;
  signal: string;
  date: string;
  factors: MappedResult["factors"];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRating(rating: string): string {
  return rating.replace(/_/g, " ");
}

function mapResult(raw: AnalysisResult): MappedResult {
  const scoring = raw.scoring;
  if (!scoring) {
    return {
      ticker: raw.ticker,
      score: 0,
      signal: "AVOID",
      factors: { financialHealth: 0, valuation: 0, growth: 0, technical: 0, sentiment: 0, macroFit: 0 },
      factorDetails: null,
      thesis: raw.rejectReason ?? "No scoring data available.",
      catalysts: [],
      risks: [],
      entryNote: "",
      quantSignals: raw.quantSignals,
      rejected: raw.rejected,
      rejectReason: raw.rejectReason,
    };
  }

  return {
    ticker: raw.ticker,
    score: scoring.compositeScore,
    signal: formatRating(scoring.rating),
    factors: {
      financialHealth: scoring.factors.financialHealth.adjusted,
      valuation: scoring.factors.valuation.adjusted,
      growth: scoring.factors.growth.adjusted,
      technical: scoring.factors.technical.adjusted,
      sentiment: scoring.factors.sentiment.adjusted,
      macroFit: scoring.factors.macroAlignment.adjusted,
    },
    factorDetails: {
      financialHealth: scoring.factors.financialHealth,
      valuation: scoring.factors.valuation,
      growth: scoring.factors.growth,
      technical: scoring.factors.technical,
      sentiment: scoring.factors.sentiment,
      macroFit: scoring.factors.macroAlignment,
    },
    thesis: scoring.recommendation,
    catalysts: scoring.bullCase ?? [],
    risks: scoring.bearCase ?? [],
    entryNote: scoring.agiAlignment ?? "",
    quantSignals: raw.quantSignals,
    rejected: raw.rejected,
    rejectReason: raw.rejectReason,
  };
}

function loadScoreHistory(): ScoreHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScoreHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveScoreHistory(history: ScoreHistoryEntry[]) {
  localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(history));
}

function scoreColor(score: number): string {
  if (score >= 65) return "var(--color-green)";
  if (score >= 40) return "var(--color-orange)";
  return "var(--color-red)";
}

function factorBarColor(score: number): string {
  if (score >= 65) return "#00E6A8";
  if (score >= 40) return "#F0883E";
  return "#FF4458";
}

function signalBg(signal: string): { bg: string; border: string; color: string } {
  if (signal.includes("STRONG BUY")) return { bg: "rgba(0,230,168,0.1)",  border: "rgba(0,230,168,0.25)", color: "var(--color-green)" };
  if (signal.includes("BUY"))        return { bg: "rgba(0,230,168,0.07)", border: "rgba(0,230,168,0.2)",  color: "var(--color-green)" };
  if (signal.includes("HOLD"))       return { bg: "var(--color-orange-a10)", border: "rgba(240,136,62,0.25)", color: "var(--color-orange)" };
  return                                    { bg: "var(--color-red-a10)",  border: "rgba(255,68,88,0.25)", color: "var(--color-red)" };
}

const FACTORS: { key: keyof MappedResult["factors"]; label: string; weight: number }[] = [
  { key: "growth",          label: "Growth",            weight: 30 },
  { key: "macroFit",        label: "Macro Alignment",   weight: 20 },
  { key: "financialHealth", label: "Financial Health",   weight: 20 },
  { key: "technical",       label: "Technical",          weight: 15 },
  { key: "sentiment",       label: "Sentiment",          weight: 10 },
  { key: "valuation",       label: "Valuation",          weight: 5  },
];

// ─── Staged analysis sub-components ──────────────────────────────────────────

type StageNum = 0 | 1 | 2 | 3 | 4;

function stageStatus(current: StageNum, stageN: StageNum): 'queued' | 'running' | 'complete' {
  if (current > stageN) return 'complete';
  if (current === stageN) return 'running';
  return 'queued';
}

function StageHeader({
  n,
  label,
  status,
  elapsed,
}: {
  n: number;
  label: string;
  status: 'queued' | 'running' | 'complete';
  elapsed?: number;
}) {
  const colorMap = { queued: '#2E3E52', running: 'var(--color-primary)', complete: 'var(--color-green)' };
  const color = colorMap[status];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1.5 }}>
        STAGE {n}{'  '}{label}
      </span>
      <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
        {status === 'complete' && (
          <span style={{ color: 'var(--color-green)' }}>✓{elapsed !== undefined ? ` ${(elapsed / 1000).toFixed(1)}s` : ''}</span>
        )}
        {status === 'running' && (
          <span style={{ color: 'var(--color-primary)' }}>
            <span className="mapo-pulse-dot">●</span> running...
          </span>
        )}
        {status === 'queued' && (
          <span style={{ color: '#2E3E52' }}>queued</span>
        )}
      </span>
    </div>
  );
}

function StageItem({
  prefix,
  label,
  status,
}: {
  prefix: '├─' | '└─';
  label: string;
  status: 'queued' | 'running' | 'complete';
}) {
  const valueMap = {
    queued:   { text: 'queued',       color: '#2E3E52' },
    running:  { text: 'computing...', color: 'var(--color-orange)' },
    complete: { text: '✓',            color: 'var(--color-green)' },
  };
  const { text, color } = valueMap[status];

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
      <span style={{ fontSize: 9, color: '#4A5A6E', fontFamily: 'JetBrains Mono, monospace' }}>
        {prefix} {label}
      </span>
      <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color }}>{text}</span>
    </div>
  );
}

function StagedAnalysisView({ ticker, stage, elapsed }: { ticker: string; stage: StageNum; elapsed: number }) {
  const s1 = stageStatus(stage, 1);
  const s2 = stageStatus(stage, 2);
  const s3 = stageStatus(stage, 3);
  const s4 = stageStatus(stage, 4);

  return (
    <div
      style={{
        background: '#0B0F1A',
        border: '1px solid #1C2840',
        borderRadius: 4,
        padding: '18px 20px',
        maxWidth: 620,
        margin: '40px auto 0',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: 2, marginBottom: 12 }}>
        [MAPO ANALYSIS PIPELINE] — {ticker}
      </div>
      <div style={{ height: 1, background: '#1C2840', marginBottom: 14 }} />

      {/* Stage 1: Fetching Market Data */}
      <div style={{ marginBottom: 12 }}>
        <StageHeader n={1} label="FETCHING MARKET DATA" status={s1} elapsed={s1 === 'complete' ? 800 : undefined} />
        <StageItem prefix="├─" label="Company profile + financials" status={s1} />
        <StageItem prefix="├─" label="Price history (252 days)"     status={s1} />
        <StageItem prefix="└─" label="Earnings + analyst estimates"  status={s1} />
      </div>

      {/* Stage 2: Running Quant Engine */}
      <div style={{ marginBottom: 12 }}>
        <StageHeader n={2} label="RUNNING QUANT ENGINE" status={s2} elapsed={s2 === 'complete' ? 1200 : undefined} />
        <StageItem prefix="├─" label="Momentum (12-1)"           status={s2} />
        <StageItem prefix="├─" label="Golden Cross (50/200 DMA)" status={s2} />
        <StageItem prefix="├─" label="SUE score"                 status={s2} />
        <StageItem prefix="├─" label="Analyst Revisions"         status={s2} />
        <StageItem prefix="├─" label="Beta vs S&P 500"           status={s2} />
        <StageItem prefix="├─" label="Value Factor"              status={s2} />
        <StageItem prefix="└─" label="Donchian Channel"          status={s2} />
      </div>

      {/* Stage 3: Scoring with Claude */}
      <div style={{ marginBottom: 12 }}>
        <StageHeader n={3} label="SCORING WITH CLAUDE" status={s3} />
        <StageItem prefix="├─" label="Growth (30%)"            status={s3} />
        <StageItem prefix="├─" label="Macro Alignment (20%)"  status={s3} />
        <StageItem prefix="├─" label="Financial Health (20%)"  status={s3} />
        <StageItem prefix="├─" label="Technical (15%)"         status={s3} />
        <StageItem prefix="├─" label="Sentiment (10%)"         status={s3} />
        <StageItem prefix="└─" label="Valuation (5%)"          status={s3} />
      </div>

      {/* Stage 4: Validating Signals */}
      <div style={{ marginBottom: 14 }}>
        <StageHeader n={4} label="VALIDATING SIGNALS" status={s4} />
      </div>

      <div style={{ height: 1, background: '#1C2840', marginBottom: 10 }} />
      <div style={{ fontSize: 9, color: '#4A5A6E', letterSpacing: 1.5 }}>
        ELAPSED: {(elapsed / 1000).toFixed(1)}s
      </div>
    </div>
  );
}

// ─── Quant signals strip ──────────────────────────────────────────────────────

function QuantSignalsStrip({ signals }: { signals: QuantSignals }) {
  type SignalCard = {
    label: string;
    value: string;
    confirmed: boolean | null;
    reject?: boolean;
  };

  const cards: SignalCard[] = [
    {
      label: 'MOMENTUM',
      value: `${signals.momentum.return12m >= 0 ? '+' : ''}${(signals.momentum.return12m * 100).toFixed(1)}%`,
      confirmed: signals.momentum.confirmed,
    },
    {
      label: 'GOLDEN X',
      value: `50d/200d ${signals.goldenCross.sma50 > signals.goldenCross.sma200 ? '↑' : '↓'}`,
      confirmed: signals.goldenCross.confirmed,
    },
    {
      label: 'EPS SURPRISE',
      value: `${signals.sue.latestSurprisePct >= 0 ? '+' : ''}${signals.sue.latestSurprisePct.toFixed(1)}%`,
      confirmed: signals.sue.confirmed,
    },
    {
      label: 'EST REVISION',
      value: `${signals.revisions.revisionPct > 0 ? '+' : ''}${signals.revisions.revisionPct.toFixed(1)}%`,
      confirmed: signals.revisions.confirmed,
    },
    {
      label: 'BETA',
      value: signals.beta.value.toFixed(2),
      confirmed: signals.beta.lowVol ? true : signals.beta.highVol ? false : null,
    },
    {
      label: 'VALUE',
      value: `${signals.valueFactor.currentEvEbitda.toFixed(1)}x EV/EBITDA`,
      confirmed: signals.valueFactor.confirmed,
    },
    {
      label: 'DONCHIAN',
      value: `${(signals.donchian.position * 100).toFixed(0)}%`,
      confirmed: signals.donchian.reject ? false : signals.donchian.valid ? null : null,
      reject: signals.donchian.reject,
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        {cards.map((card) => {
          const borderColor =
            card.reject
              ? 'var(--color-red)'
              : card.confirmed === true
              ? 'var(--color-green)'
              : '#1C2840';
          const valueColor =
            card.reject
              ? 'var(--color-red)'
              : card.confirmed === true
              ? 'var(--color-green)'
              : card.confirmed === false
              ? 'var(--color-red)'
              : '#C9D1D9';

          return (
            <div
              key={card.label}
              style={{
                background: '#0B0F1A',
                border: `1px solid ${borderColor}`,
                borderRadius: 3,
                padding: '10px 10px',
                minWidth: 80,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: '#4A5A6E',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: valueColor,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {card.value}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          fontSize: 9,
          color: '#4A5A6E',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: 1,
        }}
      >
        {signals.compositeCount}/7 signals confirmed · {signals.signalSummary}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MAPOScoreTab() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState<MappedResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>(() => loadScoreHistory());

  // Staged reveal state
  const [stage, setStage] = useState<StageNum>(0);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const stage4TimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist score history whenever it changes
  useEffect(() => {
    saveScoreHistory(scoreHistory);
  }, [scoreHistory]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stage4TimerRef.current) clearTimeout(stage4TimerRef.current);
    };
  }, []);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setStage(1);

    timerRef.current = setInterval(() => {
      const ms = Date.now() - startTimeRef.current;
      setElapsed(ms);

      // Stage 1 complete at 800ms → Stage 2 running
      // Stage 2 complete at 1200ms → Stage 3 running (fetch still in-flight)
      if (ms >= 1200) {
        setStage((prev) => (prev < 3 ? 3 : prev));
      } else if (ms >= 800) {
        setStage((prev) => (prev < 2 ? 2 : prev));
      }
    }, 100);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }

  const analyze = useMutation({
    mutationFn: async (symbol: string) => {
      startAgent('quant-engine');
      addLog({
        agentName: 'QUANT ENGINE',
        message: `Starting analysis: ${symbol}`,
        type: 'info',
      });
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Analysis failed');
        throw new Error(errText || 'Analysis failed');
      }
      return res.json() as Promise<AnalysisResult>;
    },
    onSuccess: (raw) => {
      stopTimer();
      const data = mapResult(raw);
      const compositeScore = data.score;

      // Stage 3 complete → Stage 4 running → complete after 400ms
      setStage(4);
      if (stage4TimerRef.current) clearTimeout(stage4TimerRef.current);
      stage4TimerRef.current = setTimeout(() => {
        completeAgent('quant-engine', `Score: ${compositeScore}`);
        addLog({
          agentName: 'QUANT ENGINE',
          message: `Analysis complete: ${data.ticker} scored ${compositeScore}`,
          type: 'success',
        });
        setLastOperation(`MAPO SCORE: ${data.ticker}`);

        setResult(data);
        setHistory((prev) => {
          const updated = [data.ticker, ...prev.filter((t) => t !== data.ticker)];
          return updated.slice(0, 6);
        });
        const entry: ScoreHistoryEntry = {
          ticker: data.ticker,
          score: compositeScore,
          signal: data.signal,
          date: new Date().toISOString(),
          factors: data.factors,
        };
        setScoreHistory((prev) => {
          const deduped = [entry, ...prev.filter((h) => h.ticker !== data.ticker)];
          return deduped.slice(0, 20);
        });
      }, 400);
    },
    onError: (err: Error) => {
      stopTimer();
      errorAgent('quant-engine', err.message);
      addLog({
        agentName: 'QUANT ENGINE',
        message: `Analysis failed: ${err.message}`,
        type: 'error',
      });
      setStage(0);
    },
  });

  function runAnalysis(sym: string) {
    if (!sym) return;
    setResult(null);
    startTimer();
    analyze.mutate(sym);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runAnalysis(ticker.trim().toUpperCase());
  }

  function clearScoreHistory() {
    setScoreHistory([]);
  }

  const sig = result ? signalBg(result.signal) : null;

  // While stage 4 timer is pending (mutation succeeded but 400ms not elapsed yet)
  const isRevealPending = analyze.isSuccess && !result;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Main analysis area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Search bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1C2840",
            flexShrink: 0,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                fontSize: 9,
                color: "var(--color-primary)",
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: 2,
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              MAPO 6-FACTOR SCORE
            </div>
            <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
              <Search
                size={11}
                color="#4A5A6E"
                style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Enter ticker (e.g. NVDA)"
                style={{
                  width: "100%",
                  background: "#070B14",
                  border: "1px solid #1C2840",
                  borderRadius: 3,
                  padding: "7px 10px 7px 28px",
                  fontSize: 11,
                  color: "#C9D1D9",
                  fontFamily: "JetBrains Mono, monospace",
                  outline: "none",
                  boxSizing: "border-box",
                  textTransform: "uppercase",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "#1C2840")}
              />
            </div>
            <button
              type="submit"
              disabled={analyze.isPending || isRevealPending}
              style={{
                padding: "7px 18px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                background: (analyze.isPending || isRevealPending)
                  ? "#0E1828"
                  : "linear-gradient(135deg, #C49B3C 0%, #8B6420 100%)",
                border: "none",
                borderRadius: 3,
                color: (analyze.isPending || isRevealPending) ? "#4A5A6E" : "#070B14",
                fontFamily: "JetBrains Mono, monospace",
                cursor: (analyze.isPending || isRevealPending) ? "not-allowed" : "pointer",
              }}
            >
              {(analyze.isPending || isRevealPending) ? "Analyzing..." : "Analyze"}
            </button>
          </form>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* Empty state */}
          {!result && !analyze.isPending && !isRevealPending && !analyze.isError && (
            <div style={{ textAlign: "center", marginTop: 60 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "#4A5A6E",
                  fontFamily: "JetBrains Mono, monospace",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Enter a ticker to run full MAPO 6-factor analysis
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#2E3E52",
                  maxWidth: 400,
                  margin: "0 auto",
                  lineHeight: 1.8,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                Growth (30%) · Macro Alignment (20%) · Financial Health (20%) · Technical (15%) · Sentiment (10%) · Valuation (5%)
              </div>

              {history.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#4A5A6E",
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "JetBrains Mono, monospace",
                      marginBottom: 10,
                    }}
                  >
                    Recent
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    {history.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTicker(t); runAnalysis(t); }}
                        style={{
                          padding: "4px 10px",
                          fontSize: 9,
                          fontFamily: "JetBrains Mono, monospace",
                          background: "var(--color-primary-a06)",
                          border: "1px solid var(--color-primary-a20)",
                          borderRadius: 3,
                          color: "var(--color-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: "#4A5A6E",
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    fontFamily: "JetBrains Mono, monospace",
                    marginBottom: 10,
                  }}
                >
                  Quick picks
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  {QUICK_PICKS.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTicker(t); runAnalysis(t); }}
                      style={{
                        padding: "4px 10px",
                        fontSize: 9,
                        fontFamily: "JetBrains Mono, monospace",
                        background: "transparent",
                        border: "1px solid #1C2840",
                        borderRadius: 3,
                        color: "#8B949E",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-primary)";
                        e.currentTarget.style.color = "var(--color-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#1C2840";
                        e.currentTarget.style.color = "#8B949E";
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Staged analysis reveal */}
          {(analyze.isPending || isRevealPending) && stage > 0 && (
            <StagedAnalysisView
              ticker={ticker || "..."}
              stage={stage}
              elapsed={elapsed}
            />
          )}

          {/* Error state */}
          {analyze.isError && (
            <div
              style={{
                padding: 14,
                background: "var(--color-red-a08)",
                border: "1px solid var(--color-red-a20)",
                borderRadius: 4,
                fontSize: 10,
                color: "var(--color-red)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Analysis failed. Check that Anthropic API key is configured.
            </div>
          )}

          {/* Recent ticker chips when result exists */}
          {result && !analyze.isPending && !isRevealPending && history.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {history.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTicker(t); runAnalysis(t); }}
                  style={{
                    padding: "3px 10px",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono, monospace",
                    background: t === result.ticker ? "var(--color-primary-a10)" : "transparent",
                    border:
                      t === result.ticker
                        ? "1px solid var(--color-primary-a30)"
                        : "1px solid #1C2840",
                    borderRadius: 3,
                    color: t === result.ticker ? "var(--color-primary)" : "#8B949E",
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {result && !analyze.isPending && !isRevealPending && (
            <>
              {/* Rejection notice */}
              {result.rejected && result.rejectReason && (
                <div
                  style={{
                    padding: 14,
                    background: "var(--color-red-a08)",
                    border: "1px solid var(--color-red-a20)",
                    borderRadius: 4,
                    fontSize: 10,
                    color: "var(--color-red)",
                    fontFamily: "JetBrains Mono, monospace",
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontWeight: 700, letterSpacing: 1.5 }}>REJECTED: </span>
                  {result.rejectReason}
                </div>
              )}

              {/* Quant signals strip */}
              {result.quantSignals && (
                <QuantSignalsStrip signals={result.quantSignals} />
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "340px 1fr",
                  gap: 16,
                  maxWidth: 1100,
                }}
              >
                {/* Left: Score card */}
                <div>
                  {/* Main score */}
                  <div
                    style={{
                      background: "#0B0F1A",
                      border: "1px solid #1C2840",
                      borderRadius: 4,
                      padding: 20,
                      marginBottom: 12,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#C9D1D9",
                        fontFamily: "JetBrains Mono, monospace",
                        letterSpacing: 4,
                        marginBottom: 16,
                      }}
                    >
                      {result.ticker}
                    </div>

                    {/* Circular score with SVG ring */}
                    {(() => {
                      const radius = 52;
                      const stroke = 5;
                      const circumference = 2 * Math.PI * radius;
                      const progress = Math.min(result.score, 100) / 100;
                      const dashOffset = circumference * (1 - progress);
                      const color = scoreColor(result.score);
                      const size = (radius + stroke) * 2;
                      return (
                        <div style={{ position: "relative", width: size, height: size, margin: "0 auto 16px" }}>
                          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                            {/* Background track */}
                            <circle
                              cx={radius + stroke}
                              cy={radius + stroke}
                              r={radius}
                              fill="none"
                              stroke="#1C2840"
                              strokeWidth={stroke}
                            />
                            {/* Progress arc */}
                            <circle
                              cx={radius + stroke}
                              cy={radius + stroke}
                              r={radius}
                              fill="none"
                              stroke={color}
                              strokeWidth={stroke}
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={dashOffset}
                              style={{ transition: "stroke-dashoffset 1s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 6px ${color})` }}
                            />
                          </svg>
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 32,
                                fontWeight: 700,
                                color,
                                fontFamily: "JetBrains Mono, monospace",
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                              }}
                            >
                              {result.score}
                            </div>
                            <div style={{ fontSize: 9, color: "#8B949E", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
                              /100
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Signal badge */}
                    {sig && (
                      <div
                        style={{
                          display: "inline-block",
                          padding: "5px 14px",
                          background: sig.bg,
                          border: `1px solid ${sig.border}`,
                          borderRadius: 3,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: sig.color,
                          fontFamily: "JetBrains Mono, monospace",
                          marginBottom: 14,
                        }}
                      >
                        {result.signal}
                      </div>
                    )}

                    {/* Position sizing guidance */}
                    <div style={{ borderTop: "1px solid #1C2840", paddingTop: 14, textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#4A5A6E",
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          fontFamily: "JetBrains Mono, monospace",
                          marginBottom: 8,
                        }}
                      >
                        MAPO Position Sizing
                      </div>
                      {(() => {
                        const score = result.score;
                        const tiers = [
                          { min: 80,  max: 100, label: "STRONG BUY", mult: 1.25, color: "var(--color-green)", note: "1.25× equal-weight target" },
                          { min: 65,  max: 79,  label: "BUY",        mult: 1.0,  color: "var(--color-green)", note: "1.0× equal-weight target"  },
                          { min: 50,  max: 64,  label: "HOLD",       mult: 0.75, color: "var(--color-orange)", note: "0.75× equal-weight target" },
                          { min: 0,   max: 49,  label: "AVOID",      mult: 0,    color: "var(--color-red)", note: "No position recommended"   },
                        ];
                        const tier = tiers.find((t) => score >= t.min && score <= t.max)!;
                        const baseAlloc = (1 / 7) * 100;
                        const suggestedAlloc = Math.min(baseAlloc * tier.mult, 25);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 9, color: "#5A6B80", fontFamily: "JetBrains Mono, monospace" }}>
                                Sizing multiplier
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: tier.color, fontFamily: "JetBrains Mono, monospace" }}>
                                {tier.mult > 0 ? `${tier.mult}×` : "—"}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 9, color: "#5A6B80", fontFamily: "JetBrains Mono, monospace" }}>
                                Suggested allocation
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: tier.color, fontFamily: "JetBrains Mono, monospace", fontVariantNumeric: "tabular-nums" }}>
                                {tier.mult > 0 ? `${suggestedAlloc.toFixed(1)}%` : "0%"}
                              </span>
                            </div>
                            <div style={{ fontSize: 9, color: "#3A4A5C", fontFamily: "JetBrains Mono, monospace", marginTop: 2, lineHeight: 1.5 }}>
                              {tier.note}
                            </div>
                            <div style={{ fontSize: 9, color: "#2E3E52", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.4 }}>
                              Max single position: 25% · Min: 5%
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Factor breakdown */}
                  <div
                    style={{
                      background: "#0B0F1A",
                      border: "1px solid #1C2840",
                      borderRadius: 4,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--color-primary)",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 14,
                        fontFamily: "JetBrains Mono, monospace",
                        fontWeight: 700,
                      }}
                    >
                      Factor Breakdown
                    </div>
                    {FACTORS.map(({ key, label, weight }) => {
                      const val = result.factors[key] ?? 0;
                      const color = factorBarColor(val);
                      const detail = result.factorDetails?.[key];
                      return (
                        <div key={key} style={{ marginBottom: 14 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 4,
                              alignItems: "baseline",
                            }}
                          >
                            <span style={{ fontSize: 10, color: "#C9D1D9", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                              {label}
                            </span>
                            <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  color: "#4A5A6E",
                                  fontFamily: "JetBrains Mono, monospace",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {weight}%
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color,
                                  fontFamily: "JetBrains Mono, monospace",
                                  fontVariantNumeric: "tabular-nums",
                                  minWidth: 32,
                                  textAlign: "right",
                                }}
                              >
                                {val}
                              </span>
                            </span>
                          </div>
                          {/* Bar */}
                          <div style={{ height: 6, background: "#1C2840", borderRadius: 3, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(val, 100)}%`,
                                background: `linear-gradient(90deg, ${color}CC, ${color})`,
                                borderRadius: 3,
                                transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                                boxShadow: `0 0 8px ${color}40`,
                              }}
                            />
                          </div>
                          {/* Notes */}
                          {detail?.notes && (
                            <div
                              style={{
                                fontSize: 9,
                                color: "#5A6B80",
                                fontFamily: "Inter, sans-serif",
                                marginTop: 3,
                                lineHeight: 1.5,
                              }}
                            >
                              {detail.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Analysis */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Bull Case + Bear Case */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div
                      style={{
                        background: "#0B0F1A",
                        border: "1px solid rgba(0,230,168,0.15)",
                        borderRadius: 4,
                        padding: 16,
                        borderTop: "2px solid rgba(0,230,168,0.4)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--color-green)",
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          marginBottom: 10,
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700,
                        }}
                      >
                        Bull Case
                      </div>
                      {(result.catalysts ?? []).length > 0 ? result.catalysts.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 10,
                            color: "#C9D1D9",
                            lineHeight: 1.7,
                            display: "flex",
                            gap: 8,
                            marginBottom: 4,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          <span style={{ color: "var(--color-green)", flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>+</span>
                          <span>{c}</span>
                        </div>
                      )) : (
                        <div style={{ fontSize: 10, color: "#4A5A6E", fontStyle: "italic" }}>No bull case provided</div>
                      )}
                    </div>
                    <div
                      style={{
                        background: "#0B0F1A",
                        border: "1px solid rgba(255,68,88,0.15)",
                        borderRadius: 4,
                        padding: 16,
                        borderTop: "2px solid rgba(255,68,88,0.4)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--color-red)",
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          marginBottom: 10,
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700,
                        }}
                      >
                        Bear Case
                      </div>
                      {(result.risks ?? []).length > 0 ? result.risks.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 10,
                            color: "#C9D1D9",
                            lineHeight: 1.7,
                            display: "flex",
                            gap: 8,
                            marginBottom: 4,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          <span style={{ color: "var(--color-red)", flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>-</span>
                          <span>{r}</span>
                        </div>
                      )) : (
                        <div style={{ fontSize: 10, color: "#4A5A6E", fontStyle: "italic" }}>No bear case provided</div>
                      )}
                    </div>
                  </div>

                  {/* Recommendation */}
                  {result.thesis && (
                    <div
                      style={{
                        background: "#0B0F1A",
                        border: "1px solid #1C2840",
                        borderRadius: 4,
                        padding: 16,
                        borderLeft: "3px solid var(--color-primary)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--color-primary)",
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          marginBottom: 8,
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700,
                        }}
                      >
                        Recommendation
                      </div>
                      <div style={{ fontSize: 11, color: "#C9D1D9", lineHeight: 1.7, fontFamily: "Inter, sans-serif" }}>
                        {result.thesis}
                      </div>
                    </div>
                  )}

                  {/* AGI Alignment */}
                  {result.entryNote && (
                    <div
                      style={{
                        background: "#0B0F1A",
                        border: "1px solid #1C2840",
                        borderRadius: 4,
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--color-orange)",
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          marginBottom: 8,
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700,
                        }}
                      >
                        AGI Alignment
                      </div>
                      <div style={{ fontSize: 11, color: "#C9D1D9", lineHeight: 1.7, fontFamily: "Inter, sans-serif" }}>
                        {result.entryNote}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes mapo-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          .mapo-pulse-dot {
            display: inline-block;
            animation: mapo-pulse 1s ease-in-out infinite;
          }
        `}</style>
      </div>

      {/* History side panel */}
      {scoreHistory.length > 0 && (
        <div
          data-mapo="history-panel"
          style={{
            width: 200,
            flexShrink: 0,
            borderLeft: "1px solid #1C2840",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid #1C2840",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#4A5A6E",
              fontFamily: "JetBrains Mono, monospace",
              flexShrink: 0,
            }}
          >
            History
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {scoreHistory.map((h) => {
              const sc = scoreColor(h.score);
              const hs = signalBg(h.signal);
              const dateStr = new Date(h.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <button
                  key={h.ticker + h.date}
                  data-mapo={`history-row-${h.ticker}`}
                  onClick={() => { setTicker(h.ticker); runAnalysis(h.ticker); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    padding: "8px 10px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(28,40,64,0.5)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 10,
                        color: "#C9D1D9",
                      }}
                    >
                      {h.ticker}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 11,
                        color: sc,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {h.score}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: hs.color,
                        fontFamily: "JetBrains Mono, monospace",
                        letterSpacing: 0.5,
                      }}
                    >
                      {h.signal}
                    </span>
                    <span style={{ fontSize: 9, color: "#4A5A6E", fontFamily: "JetBrains Mono, monospace" }}>
                      {dateStr}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            data-mapo="btn-clear-history"
            onClick={clearScoreHistory}
            style={{
              padding: "7px 10px",
              fontSize: 9,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontFamily: "JetBrains Mono, monospace",
              background: "transparent",
              border: "none",
              borderTop: "1px solid #1C2840",
              color: "#4A5A6E",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--color-red)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#4A5A6E";
            }}
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}
