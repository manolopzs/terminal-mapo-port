import { useQuery } from "@tanstack/react-query";

interface DrawdownAlert {
  ticker: string;
  level: "REVIEW" | "RESCORE" | "AUTO_EXIT" | "FORCED_EXIT";
  drawdownPct: number;
  action: string;
}

const LEVEL_ORDER = { FORCED_EXIT: 0, AUTO_EXIT: 1, RESCORE: 2, REVIEW: 3 };

const LEVEL_STYLE: Record<DrawdownAlert["level"], { border: string; badge: string; text: string }> = {
  FORCED_EXIT: { border: "border-red-600 animate-pulse", badge: "bg-red-700 text-white", text: "text-red-300" },
  AUTO_EXIT:   { border: "border-red-500",               badge: "bg-red-600 text-white",  text: "text-red-300" },
  RESCORE:     { border: "border-orange-500",            badge: "bg-orange-600 text-white", text: "text-orange-300" },
  REVIEW:      { border: "border-yellow-500",            badge: "bg-yellow-600 text-black", text: "text-yellow-300" },
};

export function DrawdownAlerts() {
  const { data, isLoading } = useQuery<{ drawdownAlerts: DrawdownAlert[] }>({
    queryKey: ["/api/portfolio/status"],
    refetchInterval: 60_000,
    select: d => ({ drawdownAlerts: (d as any).drawdownAlerts ?? [] }),
  });

  if (isLoading) return (
    <div className="p-3 text-cyan-400 font-mono text-xs animate-pulse">CHECKING DRAWDOWNS...</div>
  );

  const alerts = (data?.drawdownAlerts ?? []).sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
  );

  if (alerts.length === 0) return (
    <div className="p-3 border border-[#1A2332] rounded bg-[#0A0E1A] font-mono text-xs text-green-400">
      No active drawdown alerts
    </div>
  );

  return (
    <div className="space-y-2 font-mono text-xs">
      {alerts.map(alert => {
        const s = LEVEL_STYLE[alert.level];
        return (
          <div key={alert.ticker} className={`bg-[#0A0E1A] border rounded p-3 ${s.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-cyan-400 font-bold">{alert.ticker}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${s.badge}`}>
                {alert.level.replace("_", " ")}
              </span>
              <span className="text-red-400 font-bold ml-auto">
                -{(alert.drawdownPct * 100).toFixed(1)}%
              </span>
            </div>
            <div className={`text-[10px] leading-relaxed ${s.text}`}>{alert.action}</div>
          </div>
        );
      })}
    </div>
  );
}
