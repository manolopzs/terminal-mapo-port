import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatPercent } from "@/lib/format";

interface DrawdownAlert {
  ticker: string;
  level: "REVIEW" | "RESCORE" | "AUTO_EXIT" | "FORCED_EXIT";
  drawdownPct: number;
  action: string;
}

interface EnrichedHolding {
  ticker: string;
  companyName: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  value: number;
  weightPct: number;
  returnPct: number;
  sector: string;
}

interface PortfolioStatus {
  holdings: EnrichedHolding[];
  metrics: { totalValue: number; cash: number; cashPct: number; totalReturnPct: number };
  sectorWeights: Record<string, number>;
  drawdownAlerts: DrawdownAlert[];
  validation: { passed: boolean; checks: Array<{ rule: string; passed: boolean; detail: string }> };
}

const SIGNAL_LABELS = ["M", "GX", "S", "R", "V"];

function alertLevel(ticker: string, alerts: DrawdownAlert[]): DrawdownAlert["level"] | null {
  return alerts.find(a => a.ticker === ticker)?.level ?? null;
}

const rowBg: Record<string, string> = {
  REVIEW: "bg-yellow-900/20 border-l-2 border-yellow-500",
  RESCORE: "bg-orange-900/20 border-l-2 border-orange-500",
  AUTO_EXIT: "bg-red-900/30 border-l-2 border-red-500",
  FORCED_EXIT: "bg-red-900/40 border-l-2 border-red-600",
};

export function PortfolioOverview() {
  const { data, isLoading, error } = useQuery<PortfolioStatus>({
    queryKey: ["/api/portfolio/status"],
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="p-4 text-cyan-400 font-mono text-sm animate-pulse">LOADING PORTFOLIO...</div>
  );
  if (error) return (
    <div className="p-4 text-red-400 font-mono text-sm">ERROR: {String(error)}</div>
  );
  if (!data) return null;

  const { holdings, metrics, sectorWeights, drawdownAlerts } = data;

  return (
    <div className="bg-[#0A0E1A] border border-[#1A2332] rounded text-white font-mono text-xs">
      {/* Summary row */}
      <div className="flex gap-6 px-4 py-3 border-b border-[#1A2332]">
        <div>
          <div className="text-[#8899aa] uppercase text-[10px]">Total Value</div>
          <div className="text-white text-sm font-bold">{formatCurrency(metrics.totalValue)}</div>
        </div>
        <div>
          <div className="text-[#8899aa] uppercase text-[10px]">Total Return</div>
          <div className={`text-sm font-bold ${metrics.totalReturnPct >= 0 ? "text-green-400" : "text-red-400"}`}>
            {metrics.totalReturnPct >= 0 ? "+" : ""}{metrics.totalReturnPct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[#8899aa] uppercase text-[10px]">Cash</div>
          <div className="text-white text-sm font-bold">
            {formatCurrency(metrics.cash)} <span className="text-[#8899aa] text-[10px]">({metrics.cashPct.toFixed(1)}%)</span>
          </div>
        </div>
        <div>
          <div className="text-[#8899aa] uppercase text-[10px]">Positions</div>
          <div className="text-white text-sm font-bold">{holdings.length}</div>
        </div>
        {drawdownAlerts.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-red-400 text-[10px] uppercase font-bold animate-pulse">
              {drawdownAlerts.length} ALERT{drawdownAlerts.length > 1 ? "S" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[#8899aa] uppercase text-[10px] border-b border-[#1A2332]">
              <th className="px-3 py-2 text-left">Ticker</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-right">Shares</th>
              <th className="px-3 py-2 text-right">Entry</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right">Wt%</th>
              <th className="px-3 py-2 text-right">Return</th>
              <th className="px-3 py-2 text-center">Signals</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(h => {
              const level = alertLevel(h.ticker, drawdownAlerts);
              return (
                <tr key={h.ticker} className={`border-b border-[#1A2332]/50 hover:bg-white/5 ${level ? rowBg[level] : ""}`}>
                  <td className="px-3 py-2 text-cyan-400 font-bold">{h.ticker}</td>
                  <td className="px-3 py-2 text-[#ccd0d8] max-w-[120px] truncate">{h.companyName}</td>
                  <td className="px-3 py-2 text-right">{h.shares}</td>
                  <td className="px-3 py-2 text-right text-[#8899aa]">${h.entryPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">${(h.currentPrice ?? h.entryPrice).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(h.value)}</td>
                  <td className="px-3 py-2 text-right text-[#8899aa]">{(h.weightPct ?? 0).toFixed(1)}%</td>
                  <td className={`px-3 py-2 text-right font-bold ${(h.returnPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(h.returnPct ?? 0) >= 0 ? "+" : ""}{((h.returnPct ?? 0) * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-center">
                      {SIGNAL_LABELS.map(lbl => (
                        <span key={lbl} className="text-[9px] px-1 py-0.5 rounded bg-[#1A2332] text-[#8899aa]">{lbl}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sector weights */}
      {Object.keys(sectorWeights).length > 0 && (
        <div className="px-4 py-3 border-t border-[#1A2332]">
          <div className="text-[#8899aa] uppercase text-[10px] mb-2">Sector Exposure</div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(sectorWeights)
              .sort(([, a], [, b]) => b - a)
              .map(([sector, pct]) => (
                <span key={sector} className="text-[10px] text-[#ccd0d8]">
                  {sector}: <span className="text-cyan-400 font-bold">{pct.toFixed(1)}%</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
