import { useState, useEffect } from "react";

interface FactorDetail { base: number; adjusted: number; notes: string }
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

const SIGNAL_DEFS = [
  { key: "momentum",    label: "Momentum",     getValue: (q: QuantSignals) => `${(q.momentum.return12m * 100).toFixed(1)}% 12m` },
  { key: "goldenCross", label: "Golden Cross",  getValue: (q: QuantSignals) => `50MA $${q.goldenCross.sma50}` },
  { key: "sue",         label: "SUE",           getValue: (q: QuantSignals) => `${q.sue.score}σ` },
  { key: "revisions",   label: "Revisions",     getValue: (q: QuantSignals) => `${(q.revisions.revisionPct * 100).toFixed(1)}% EPS` },
  { key: "beta",        label: "Beta",          getValue: (q: QuantSignals) => `β${q.beta.value}` },
  { key: "valueFactor", label: "Value",         getValue: (q: QuantSignals) => `EV/EBITDA ${q.valueFactor.currentEvEbitda}` },
  { key: "donchian",    label: "Donchian",      getValue: (q: QuantSignals) => `${(q.donchian.position * 100).toFixed(0)}% range` },
];

const isSignalConfirmed = (key: string, q: QuantSignals): boolean => {
  if (key === "momentum") return q.momentum.confirmed;
  if (key === "goldenCross") return q.goldenCross.confirmed;
  if (key === "sue") return q.sue.confirmed;
  if (key === "revisions") return q.revisions.confirmed;
  if (key === "beta") return q.beta.lowVol;
  if (key === "valueFactor") return q.valueFactor.confirmed;
  if (key === "donchian") return q.donchian.valid && !q.donchian.reject;
  return false;
};

const FACTOR_LABELS: Record<string, string> = {
  financialHealth: "Financial Health",
  valuation: "Valuation",
  growth: "Growth",
  technical: "Technical",
  sentiment: "Sentiment",
  macroAlignment: "Macro Alignment",
};

const FACTOR_WEIGHTS: Record<string, string> = {
  financialHealth: "25%", valuation: "20%", growth: "20%",
  technical: "15%", sentiment: "10%", macroAlignment: "10%",
};

const scoreColor = (s: number) =>
  s >= 80 ? "text-cyan-400" : s >= 65 ? "text-green-400" : s >= 50 ? "text-yellow-400" : "text-red-400";

const ratingStyle: Record<string, string> = {
  STRONG_BUY: "bg-cyan-600 text-white",
  BUY:        "bg-green-600 text-white",
  HOLD:       "bg-yellow-600 text-black",
  AVOID:      "bg-red-600 text-white",
};

export function StockAnalysis({ initialTicker }: { initialTicker?: string } = {}) {
  const [ticker, setTicker] = useState(initialTicker ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (initialTicker) analyze(initialTicker);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicker]);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (overrideTicker?: string) => {
    const t = (overrideTicker ?? ticker).trim();
    if (!t) return;
    setTicker(t);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t.toUpperCase() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0A0E1A] border border-[#1A2332] rounded p-4 font-mono text-xs text-white space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <input
          className="bg-[#111827] border border-[#1A2332] rounded px-3 py-2 text-white font-mono text-sm uppercase w-32 focus:outline-none focus:border-cyan-500"
          placeholder="TICKER"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && analyze()}
        />
        <button
          onClick={() => analyze()}
          disabled={loading}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#1A2332] disabled:text-[#8899aa] text-white text-xs uppercase font-bold rounded transition-colors"
        >
          {loading ? "ANALYZING..." : "ANALYZE"}
        </button>
      </div>

      {loading && (
        <div className="text-cyan-400 animate-pulse text-xs">Running MAPO analysis pipeline...</div>
      )}
      {error && <div className="text-red-400">Error: {error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Rejection banner */}
          {result.rejected && (
            <div className="border border-red-500 bg-red-900/20 rounded p-3 text-red-300">
              <span className="font-bold text-red-400 uppercase">REJECTED: </span>
              {result.rejectReason}
            </div>
          )}

          {/* Company header */}
          {result.profile && (
            <div className="border-b border-[#1A2332] pb-3">
              <div className="text-cyan-400 font-bold text-base">{result.ticker}</div>
              <div className="text-white text-sm">{result.profile.companyName}</div>
              <div className="text-[#8899aa] text-[10px] mt-1 flex gap-3">
                <span>{result.profile.sector}</span>
                <span>${result.profile.price?.toFixed(2)}</span>
                {result.profile.marketCap > 0 && (
                  <span>${(result.profile.marketCap / 1e9).toFixed(1)}B mkt cap</span>
                )}
              </div>
            </div>
          )}

          {/* Quant signals */}
          {result.quantSignals && (
            <div>
              <div className="text-[#8899aa] uppercase text-[10px] mb-2">Quant Signals ({result.quantSignals.compositeCount}/7)</div>
              <div className="flex flex-wrap gap-2">
                {SIGNAL_DEFS.map(sig => {
                  const confirmed = isSignalConfirmed(sig.key, result.quantSignals!);
                  return (
                    <div key={sig.key} className={`border rounded px-2 py-1 ${confirmed ? "border-green-500 bg-green-900/20" : "border-[#1A2332] bg-[#111827]"}`}>
                      <div className={`text-[10px] uppercase font-bold ${confirmed ? "text-green-400" : "text-[#8899aa]"}`}>
                        {confirmed ? "YES" : "NO"} {sig.label}
                      </div>
                      <div className="text-[9px] text-[#8899aa]">{sig.getValue(result.quantSignals!)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Score */}
          {result.scoring && (
            <>
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-bold ${scoreColor(result.scoring.compositeScore)}`}>
                  {result.scoring.compositeScore}
                </span>
                <span className="text-[#8899aa] text-sm">/100</span>
                <span className={`text-xs px-3 py-1 rounded uppercase font-bold ${ratingStyle[result.scoring.rating] ?? "bg-[#1A2332] text-white"}`}>
                  {result.scoring.rating?.replace("_", " ")}
                </span>
              </div>

              {/* Factor breakdown */}
              <div className="space-y-2">
                <div className="text-[#8899aa] uppercase text-[10px] mb-1">6-Factor Breakdown</div>
                {Object.entries(result.scoring.factors ?? {}).map(([key, factor]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[#ccd0d8]">{FACTOR_LABELS[key] ?? key}</span>
                      <span className="text-[#8899aa] text-[10px]">{FACTOR_WEIGHTS[key]} weight</span>
                      <span className={`font-bold ${scoreColor(factor.adjusted)}`}>{factor.adjusted}</span>
                    </div>
                    <div className="w-full bg-[#1A2332] rounded h-1.5 mb-1">
                      <div
                        className={`h-1.5 rounded ${factor.adjusted >= 80 ? "bg-cyan-500" : factor.adjusted >= 65 ? "bg-green-500" : factor.adjusted >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${factor.adjusted}%` }}
                      />
                    </div>
                    {factor.notes && <div className="text-[9px] text-[#8899aa]">{factor.notes}</div>}
                  </div>
                ))}
              </div>

              {/* Bull/Bear */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-green-400 uppercase text-[10px] font-bold mb-1">Bull Case</div>
                  <ul className="space-y-1">
                    {result.scoring.bullCase?.map((b, i) => (
                      <li key={i} className="text-[10px] text-[#ccd0d8] before:content-['+'] before:text-green-400 before:mr-1">{b}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-red-400 uppercase text-[10px] font-bold mb-1">Bear Case</div>
                  <ul className="space-y-1">
                    {result.scoring.bearCase?.map((b, i) => (
                      <li key={i} className="text-[10px] text-[#ccd0d8] before:content-['-'] before:text-red-400 before:mr-1">{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {result.scoring.recommendation && (
                <div className="border border-[#1A2332] rounded p-3 text-[10px] text-[#ccd0d8] leading-relaxed">
                  {result.scoring.recommendation}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
