import { useState } from "react";

interface RebalanceResult {
  memo: string;
  context: {
    currentHoldings: Array<{ ticker: string; weightPct: number; returnPct: number; entryScore: number }>;
    validationStatus: { passed: boolean; checks: Array<{ rule: string; passed: boolean; detail: string }> };
    portfolioValue: number;
    cash: number;
  };
  timestamp: string;
}

interface TradeAction {
  ticker: string;
  action: "BUY" | "SELL" | "TRIM";
  shares: string;
  price: string;
  rationale: string;
}

export function RebalanceView() {
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RebalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState<TradeAction>({ ticker: "", action: "BUY", shares: "", price: "", rationale: "" });
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);

  const runRebalance = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setElapsed(0);
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    try {
      const res = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      clearInterval(timer);
    }
  };

  const executeTrade = async () => {
    if (!tradeForm.ticker || !tradeForm.shares || !tradeForm.price) return;
    setTradeStatus("Executing...");
    try {
      const res = await fetch("/api/portfolio/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: tradeForm.action,
          ticker: tradeForm.ticker.toUpperCase(),
          shares: Number(tradeForm.shares),
          price: Number(tradeForm.price),
          rationale: tradeForm.rationale || `Manual ${tradeForm.action} from rebalance`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTradeStatus(`${tradeForm.action} ${tradeForm.ticker} executed.`);
      setTradeForm({ ticker: "", action: "BUY", shares: "", price: "", rationale: "" });
    } catch (e: any) {
      setTradeStatus(`Error: ${e.message}`);
    }
  };

  const memoLines = result?.memo?.split("\n") ?? [];

  return (
    <div className="space-y-4 font-mono text-xs text-white">
      {/* Run button */}
      <div className="flex items-center gap-3">
        <button
          onClick={runRebalance}
          disabled={loading}
          className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-[#1A2332] disabled:text-[#8899aa] text-white text-xs uppercase font-bold rounded transition-colors"
        >
          {loading ? `RUNNING REBALANCE... ${elapsed}s` : "RUN MONTHLY REBALANCE"}
        </button>
        {!loading && (
          <span className="text-[#8899aa] text-[10px]">Uses Claude Opus. Takes 30-60 seconds.</span>
        )}
      </div>

      {error && <div className="text-red-400 text-[10px]">Error: {error}</div>}

      {result && (
        <div className="space-y-4">
          {/* Memo */}
          <div className="bg-[#0A0E1A] border border-[#1A2332] rounded">
            <div className="px-4 py-2 border-b border-[#1A2332] text-[#8899aa] uppercase text-[10px] font-bold">
              Rebalance Memo
            </div>
            <div className="px-4 py-3 max-h-[500px] overflow-y-auto space-y-0.5">
              {memoLines.map((line, i) => {
                const isH2 = line.startsWith("## ");
                const isH3 = line.startsWith("### ");
                if (isH2) return <div key={i} className="text-cyan-400 font-bold text-sm mt-3 mb-1">{line.replace(/^#+\s/, "")}</div>;
                if (isH3) return <div key={i} className="text-[#8899aa] uppercase text-[10px] font-bold mt-2 mb-0.5">{line.replace(/^#+\s/, "")}</div>;
                if (!line.trim()) return <div key={i} className="h-1" />;
                return <div key={i} className="text-[10px] text-[#ccd0d8] leading-relaxed">{line}</div>;
              })}
            </div>
          </div>

          {/* Current portfolio */}
          <div className="bg-[#0A0E1A] border border-[#1A2332] rounded">
            <div className="px-4 py-2 border-b border-[#1A2332] text-[#8899aa] uppercase text-[10px] font-bold">
              Current Holdings
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[#8899aa] text-[10px] border-b border-[#1A2332]">
                  <th className="px-3 py-1 text-left">Ticker</th>
                  <th className="px-3 py-1 text-right">Weight</th>
                  <th className="px-3 py-1 text-right">Return</th>
                  <th className="px-3 py-1 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {result.context.currentHoldings.map(h => (
                  <tr key={h.ticker} className="border-b border-[#1A2332]/40">
                    <td className="px-3 py-1 text-cyan-400 font-bold">{h.ticker}</td>
                    <td className="px-3 py-1 text-right">{(h.weightPct ?? 0).toFixed(1)}%</td>
                    <td className={`px-3 py-1 text-right ${(h.returnPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {((h.returnPct ?? 0) * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-1 text-right text-[#8899aa]">{h.entryScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation */}
          <div className="bg-[#0A0E1A] border border-[#1A2332] rounded">
            <div className={`px-4 py-2 border-b border-[#1A2332] text-[10px] font-bold uppercase ${result.context.validationStatus.passed ? "text-green-400" : "text-yellow-400"}`}>
              Validation: {result.context.validationStatus.passed ? "ALL PASS" : "VIOLATIONS FOUND"}
            </div>
            <div className="px-4 py-2 space-y-1">
              {result.context.validationStatus.checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className={c.passed ? "text-green-400" : "text-red-400"}>{c.passed ? "PASS" : "FAIL"}</span>
                  <span className="text-[#8899aa]">{c.rule}</span>
                  <span className="text-[#ccd0d8] ml-auto">{c.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Execute trade */}
          <div className="bg-[#0A0E1A] border border-cyan-500/30 rounded p-4">
            <div className="text-[#8899aa] uppercase text-[10px] font-bold mb-3">Execute Trade</div>
            <div className="flex flex-wrap gap-2">
              <select
                value={tradeForm.action}
                onChange={e => setTradeForm(f => ({ ...f, action: e.target.value as any }))}
                className="bg-[#111827] border border-[#1A2332] rounded px-2 py-1 text-white text-xs"
              >
                <option>BUY</option><option>SELL</option><option>TRIM</option>
              </select>
              <input placeholder="TICKER" value={tradeForm.ticker} onChange={e => setTradeForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                className="bg-[#111827] border border-[#1A2332] rounded px-2 py-1 text-white text-xs w-24 uppercase" />
              <input placeholder="Shares" value={tradeForm.shares} onChange={e => setTradeForm(f => ({ ...f, shares: e.target.value }))}
                className="bg-[#111827] border border-[#1A2332] rounded px-2 py-1 text-white text-xs w-20" />
              <input placeholder="Price" value={tradeForm.price} onChange={e => setTradeForm(f => ({ ...f, price: e.target.value }))}
                className="bg-[#111827] border border-[#1A2332] rounded px-2 py-1 text-white text-xs w-20" />
              <input placeholder="Rationale" value={tradeForm.rationale} onChange={e => setTradeForm(f => ({ ...f, rationale: e.target.value }))}
                className="bg-[#111827] border border-[#1A2332] rounded px-2 py-1 text-white text-xs flex-1 min-w-[120px]" />
              <button onClick={executeTrade}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs uppercase font-bold rounded">
                EXECUTE
              </button>
            </div>
            {tradeStatus && <div className="mt-2 text-[10px] text-cyan-400">{tradeStatus}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
