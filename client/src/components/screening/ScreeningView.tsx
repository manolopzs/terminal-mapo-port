import { useState, useEffect, useRef } from "react";
import { StockAnalysis } from "@/components/analysis/StockAnalysis";

interface ScreenCandidate {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  marketCapB: string;
  price: number;
  changePct: number;
  beta: number;
  exchange: string;
  description: string;
  score?: number;
  rating?: string;
  agiAlignmentScore?: number;
  screenType?: string;
  screeningNotes?: string;
  signalCount?: number;
}

export function ScreeningView() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScreenCandidate[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScreen = async () => {
    setLoading(true);
    setResults([]);
    setError(null);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    try {
      const res = await fetch("/api/screen/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const ratingColor: Record<string, string> = {
    STRONG_BUY: "text-cyan-400", BUY: "text-green-400",
    HOLD: "text-yellow-400", AVOID: "text-red-400",
  };

  return (
    <div className="space-y-4 font-mono text-xs text-white">
      <div className="flex items-center gap-4">
        <button
          onClick={runScreen}
          disabled={loading}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#1A2332] disabled:text-[#8899aa] text-white text-xs uppercase font-bold rounded transition-colors"
        >
          {loading ? `SCANNING... ${elapsed}s` : "RUN FULL SCREEN"}
        </button>
        {loading && (
          <span className="text-[#8899aa] text-[10px]">
            Running AGI + broad market agents. Expect 30-60 seconds.
          </span>
        )}
        {results.length > 0 && !loading && (
          <span className="text-green-400 text-[10px]">{results.length} candidates found</span>
        )}
      </div>

      {error && <div className="text-red-400 text-[10px]">Error: {error}</div>}

      {results.length === 0 && !loading && !error && (
        <div className="border border-[#1A2332] rounded p-6 text-center text-[#8899aa]">
          <div className="text-sm mb-2">MAPO Universe Screen</div>
          <div className="text-[10px] leading-relaxed">
            Runs AGI engine (compute infra, power grid, semiconductors, defense AI) and
            broad market engine (sector rotation, value discovery, growth scout) in parallel.
            Results scored with full 6-factor MAPO methodology.
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#8899aa] uppercase text-[10px] border-b border-[#1A2332]">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Ticker</th>
                <th className="px-2 py-2 text-left">Company</th>
                <th className="px-2 py-2 text-right">Cap</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Chg%</th>
                <th className="px-2 py-2 text-left">Sector</th>
                <th className="px-2 py-2 text-center">Score</th>
                <th className="px-2 py-2 text-center">Rating</th>
                <th className="px-2 py-2 text-center">Source</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={r.ticker}
                  onClick={() => setSelectedTicker(r.ticker === selectedTicker ? null : r.ticker)}
                  className={`border-b border-[#1A2332]/50 cursor-pointer transition-colors ${
                    r.ticker === selectedTicker ? "bg-cyan-900/20" : "hover:bg-white/5"
                  }`}
                >
                  <td className="px-2 py-2 text-[#8899aa]">{i + 1}</td>
                  <td className="px-2 py-2 text-cyan-400 font-bold">{r.ticker}</td>
                  <td className="px-2 py-2 text-[#ccd0d8] max-w-[140px] truncate">{r.name}</td>
                  <td className="px-2 py-2 text-right text-[#8899aa]">{r.marketCapB}</td>
                  <td className="px-2 py-2 text-right">${r.price?.toFixed(2)}</td>
                  <td className={`px-2 py-2 text-right font-bold ${(r.changePct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(r.changePct ?? 0) >= 0 ? "+" : ""}{(r.changePct ?? 0).toFixed(2)}%
                  </td>
                  <td className="px-2 py-2 text-[#8899aa] max-w-[100px] truncate">{r.sector}</td>
                  <td className="px-2 py-2 text-center">
                    {r.score != null ? (
                      <span className={`font-bold ${r.score >= 80 ? "text-cyan-400" : r.score >= 65 ? "text-green-400" : r.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                        {r.score}
                      </span>
                    ) : <span className="text-[#8899aa]">-</span>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.rating ? (
                      <span className={`text-[9px] font-bold uppercase ${ratingColor[r.rating] ?? "text-[#8899aa]"}`}>
                        {r.rating.replace("_", " ")}
                      </span>
                    ) : <span className="text-[#8899aa]">-</span>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-[9px] text-[#8899aa] uppercase">
                      {r.screenType ?? "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTicker && (
        <div className="border border-cyan-500/30 rounded p-1 mt-2">
          <div className="flex justify-between items-center px-3 py-1 border-b border-[#1A2332]">
            <span className="text-cyan-400 text-xs font-bold uppercase">Analysis: {selectedTicker}</span>
            <button onClick={() => setSelectedTicker(null)} className="text-[#8899aa] hover:text-white text-xs">close</button>
          </div>
          <div className="p-2">
            <StockAnalysis initialTicker={selectedTicker} />
          </div>
        </div>
      )}
    </div>
  );
}
