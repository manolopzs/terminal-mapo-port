import { useState } from "react";

interface BriefingData {
  briefing: string;
  data: {
    date: string;
    holdingsStatus: Array<{ ticker: string; changePct: number; drawdownAlert: any }>;
  };
  timestamp: string;
}

const REGIME_STYLE: Record<string, { label: string; cls: string }> = {
  "RISK-ON":  { label: "RISK-ON",  cls: "bg-green-700 text-white" },
  "RISK_ON":  { label: "RISK-ON",  cls: "bg-green-700 text-white" },
  "RISK-OFF": { label: "RISK-OFF", cls: "bg-red-700 text-white" },
  "RISK_OFF": { label: "RISK-OFF", cls: "bg-red-700 text-white" },
  "NEUTRAL":  { label: "NEUTRAL",  cls: "bg-yellow-600 text-black" },
};

function detectRegime(text: string): string {
  if (/RISK.ON/i.test(text)) return "RISK-ON";
  if (/RISK.OFF/i.test(text)) return "RISK-OFF";
  return "NEUTRAL";
}

function detectThesis(text: string): string {
  if (/ACCELERATING/i.test(text)) return "ACCELERATING";
  if (/DECELERATING/i.test(text)) return "DECELERATING";
  return "STABLE";
}

const THESIS_STYLE: Record<string, string> = {
  ACCELERATING: "bg-cyan-600 text-white",
  STABLE:       "bg-blue-700 text-white",
  DECELERATING: "bg-orange-600 text-white",
};

const CACHE_KEY = "mapo_briefing_cache";

export function MorningBriefing() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BriefingData | null>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"); } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);

  const getBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/briefing");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const regime = data ? detectRegime(data.briefing) : null;
  const thesis = data ? detectThesis(data.briefing) : null;
  const ageMin = data ? Math.round((Date.now() - new Date(data.timestamp).getTime()) / 60_000) : null;

  const lines = data?.briefing?.split("\n") ?? [];

  return (
    <div className="bg-[#0A0E1A] border border-[#1A2332] rounded font-mono text-xs text-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1A2332]">
        <span className="text-[#8899aa] uppercase text-[10px] font-bold">Morning Briefing</span>
        <div className="flex items-center gap-2">
          {regime && (
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${REGIME_STYLE[regime]?.cls ?? REGIME_STYLE.NEUTRAL.cls}`}>
              {REGIME_STYLE[regime]?.label ?? regime}
            </span>
          )}
          {thesis && (
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${THESIS_STYLE[thesis]}`}>
              AGI: {thesis}
            </span>
          )}
          {ageMin !== null && (
            <span className="text-[#8899aa] text-[9px]">{ageMin}m ago</span>
          )}
          <button
            onClick={getBriefing}
            disabled={loading}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#1A2332] disabled:text-[#8899aa] text-white text-[10px] uppercase font-bold rounded transition-colors"
          >
            {loading ? "LOADING..." : "GET BRIEFING"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="px-4 py-3 text-cyan-400 animate-pulse text-[10px]">
          Running macro analysis and portfolio review...
        </div>
      )}
      {error && <div className="px-4 py-2 text-red-400 text-[10px]">Error: {error}</div>}

      {data && !loading && (
        <div className="px-4 py-3 max-h-96 overflow-y-auto">
          {lines.map((line, i) => {
            const isH2 = line.startsWith("## ");
            const isH3 = line.startsWith("### ");
            const isAction = /action required|ALERT|CRITICAL|WARNING/i.test(line);
            if (isH2) return (
              <div key={i} className="text-cyan-400 font-bold text-sm mt-3 mb-1">
                {line.replace(/^#+\s/, "")}
              </div>
            );
            if (isH3) return (
              <div key={i} className="text-[#8899aa] uppercase text-[10px] font-bold mt-2 mb-0.5">
                {line.replace(/^#+\s/, "")}
              </div>
            );
            if (isAction && line.trim()) return (
              <div key={i} className="text-yellow-300 text-[10px] leading-relaxed">{line}</div>
            );
            if (!line.trim()) return <div key={i} className="h-1" />;
            return <div key={i} className="text-[10px] text-[#ccd0d8] leading-relaxed">{line}</div>;
          })}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="px-4 py-4 text-[#8899aa] text-[10px] text-center">
          Press GET BRIEFING for daily market analysis
        </div>
      )}
    </div>
  );
}
