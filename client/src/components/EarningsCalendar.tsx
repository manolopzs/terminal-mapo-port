import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Holding } from "@shared/schema";
import type { EarningsEvent } from "@/hooks/use-portfolio";

interface EarningsCalendarProps {
  holdings: Holding[];
  liveEarnings?: EarningsEvent[];
}

interface EarningsRow {
  ticker: string;
  wt: string;
  nextDate: string;
  time: string;
  fiscalPeriod: string;
  isLive: boolean;
}


interface MacroEvent {
  date: string;
  type: "FOMC" | "CPI" | "GDP";
  label: string;
  impact: "HIGH" | "MEDIUM";
  daysUntil: number;
}

export function EarningsCalendar({ holdings, liveEarnings }: EarningsCalendarProps) {
  const earnings = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
    const sorted = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    return sorted.slice(0, 10).map((h): EarningsRow => {
      const wt = totalValue > 0 ? ((h.value ?? 0) / totalValue * 100).toFixed(1) : "0.0";
      const liveEvent = liveEarnings?.find(e => e.ticker === h.ticker);

      if (liveEvent) {
        // Format the date nicely
        const dateParts = liveEvent.date.split("-");
        const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateStr = dateParts.length === 3
          ? `${months[parseInt(dateParts[1])]} ${parseInt(dateParts[2])}`
          : liveEvent.date;

        return {
          ticker: h.ticker,
          wt: `${wt}%`,
          nextDate: dateStr,
          time: liveEvent.time || "",
          fiscalPeriod: liveEvent.fiscalPeriod || "",
          isLive: true,
        };
      }

      return {
        ticker: h.ticker,
        wt: `${wt}%`,
        nextDate: "—",
        time: "",
        fiscalPeriod: "",
        isLive: false,
      };
    });
  }, [holdings, liveEarnings]);

  // Sort: tickers with earnings dates first (sorted by date), then unknowns
  const sortedEarnings = useMemo(() => {
    const withDates = earnings.filter(e => e.isLive);
    const withoutDates = earnings.filter(e => !e.isLive);
    return [...withDates, ...withoutDates];
  }, [earnings]);


  const { data: macroEvents } = useQuery<MacroEvent[]>({
    queryKey: ["/api/macro/calendar"],
    queryFn: async () => {
      const res = await fetch("/api/macro/calendar");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 3_600_000,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "#0B0F1A" }}>
      <div className="terminal-panel-header" style={{ flexShrink: 0 }}>
        <span className="terminal-panel-title">Earnings Calendar</span>
        <span className="terminal-badge terminal-badge-green">
          {liveEarnings === undefined ? "LOADING" : sortedEarnings.filter(e => e.isLive).length > 0 ? `${sortedEarnings.filter(e => e.isLive).length} SCHEDULED` : "NONE SCHEDULED"}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: "#0B0F1A",
                zIndex: 1,
                borderBottom: "1px solid #1C2840",
              }}
            >
              <th style={thStyle("left")}>TICKER</th>
              <th style={thStyle("right")}>WT%</th>
              <th style={thStyle("left")}>NEXT DATE</th>
              <th style={thStyle("left")}>PERIOD</th>
            </tr>
          </thead>
          <tbody>
            {sortedEarnings.map((e) => (
              <tr key={e.ticker} style={{ borderBottom: "1px solid rgba(26, 35, 50, 0.5)" }}>
                <td
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#00D9FF",
                    padding: "4px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.ticker}
                </td>
                <td
                  className="font-mono tabular-nums"
                  style={{
                    fontSize: 10,
                    color: "#C9D1D9",
                    padding: "4px 6px",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.wt}
                </td>
                <td
                  style={{
                    fontSize: 10,
                    color: e.isLive ? "#C9D1D9" : "#4A5568",
                    padding: "4px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.nextDate}
                  {e.time && (
                    <span style={{ color: "#8B949E", fontSize: 8, marginLeft: 4 }}>
                      {e.time}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    fontSize: 9,
                    color: "#8B949E",
                    padding: "4px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.fiscalPeriod}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Macro Events section */}
        {macroEvents && macroEvents.length > 0 && (
          <div style={{ borderTop: "2px solid #1A2332", marginTop: 4, paddingTop: 4 }}>
            <div style={{ padding: "4px 6px 2px", fontSize: 7, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: "#484F58", fontFamily: "monospace" }}>
              Macro Events
            </div>
            {macroEvents.slice(0, 5).map((ev) => {
              const typeColor = ev.type === "FOMC" ? "#FFB300" : ev.type === "CPI" ? "#00D9FF" : "#8B949E";
              const urgency = ev.daysUntil <= 7 ? "#FF4D4D" : ev.daysUntil <= 14 ? "#FFB300" : "#484F58";
              return (
                <div key={ev.date + ev.type} style={{ display: "flex", alignItems: "center", padding: "3px 6px", borderBottom: "1px solid rgba(26,35,50,0.4)" }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: typeColor, fontFamily: "monospace", width: 36, flexShrink: 0 }}>{ev.type}</span>
                  <span style={{ fontSize: 8, color: "#8B949E", flex: 1, fontFamily: "monospace" }}>{ev.label}</span>
                  <span style={{ fontSize: 8, color: urgency, fontFamily: "monospace", flexShrink: 0 }}>
                    {ev.daysUntil === 0 ? "TODAY" : ev.daysUntil === 1 ? "TMRW" : `${ev.daysUntil}d`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function thStyle(align: "left" | "right"): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 600,
    color: "#8B949E",
    letterSpacing: 0.8,
    padding: "5px 6px",
    textAlign: align,
    fontFamily: "'Inter', system-ui, sans-serif",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}
