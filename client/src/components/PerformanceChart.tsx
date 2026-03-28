import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getQueryFn } from "@/lib/queryClient";

interface PerformanceChartProps {
  portfolioId: string;
}

interface PerformancePoint {
  date: string;
  portfolio: number;
  voo: number;
  qqq: number;
}

type Period = "5D" | "1M" | "ALL";

const PERIODS: Period[] = ["5D", "1M", "ALL"];

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month)]} ${parseInt(day)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: "#0B0F1A",
        border: "1px solid #1C2840",
        borderRadius: 4,
        padding: "8px 12px",
        fontSize: 11,
        lineHeight: 1.6,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ color: "#8B949E", fontWeight: 600, marginBottom: 6, fontSize: 10, letterSpacing: 1 }}>
        {formatDateLabel(label)}
      </div>
      {payload.map((entry: any) => {
        const colorMap: Record<string, string> = {
          portfolio: "#00D9FF",
          voo: "#F0883E",
          qqq: "#A371F7",
        };
        const nameMap: Record<string, string> = {
          portfolio: "Portfolio",
          voo: "VOO",
          qqq: "QQQ",
        };
        const color = colorMap[entry.dataKey] ?? "#8B949E";
        const name = nameMap[entry.dataKey] ?? entry.dataKey;
        const val = entry.value as number;
        return (
          <div
            key={entry.dataKey}
            style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#8B949E", minWidth: 60 }}>{name}</span>
            <span
              style={{
                color: val >= 0 ? "#00E6A8" : "#FF4458",
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 600,
              }}
            >
              {val >= 0 ? "+" : ""}
              {val.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PerformanceChart({ portfolioId }: PerformanceChartProps) {
  const [period, setPeriod] = useState<Period>("1M");

  const { data: rawData, isLoading } = useQuery<PerformancePoint[]>({
    queryKey: [`/api/performance?portfolioId=${portfolioId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    staleTime: Infinity,
  });

  const { data, alpha } = useMemo(() => {
    if (!rawData || rawData.length === 0) return { data: [], alpha: null };

    // Skip leading zero-portfolio baseline
    const startIdx = rawData.length > 1 && rawData[0].portfolio === 0 && rawData[0].voo !== 0 ? 1 : 0;
    const all = rawData.slice(startIdx);

    let sliced = all;
    if (period === "5D") sliced = all.slice(-5);
    else if (period === "1M") sliced = all.slice(-21);

    // Compute alpha = portfolio return - SPY return over the period
    let alphaVal: number | null = null;
    if (sliced.length >= 2) {
      const first = sliced[0];
      const last = sliced[sliced.length - 1];
      const portReturn = last.portfolio - first.portfolio;
      const vooReturn = last.voo - first.voo;
      alphaVal = portReturn - vooReturn;
    } else if (sliced.length === 1) {
      alphaVal = sliced[0].portfolio - sliced[0].voo;
    }

    return { data: sliced, alpha: alphaVal };
  }, [rawData, period]);

  const tickInterval = data.length > 0 ? Math.max(Math.floor(data.length / 7), 1) : 1;
  const latest = data.length > 0 ? data[data.length - 1] : null;

  if (isLoading) {
    return (
      <div className="terminal-panel" style={{ flex: "1.2 1 0", minHeight: 0 }}>
        <div className="terminal-panel-header">
          <span className="terminal-panel-title">Performance</span>
          <span className="terminal-badge">LOADING...</span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "#8B949E",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel" style={{ flex: "1.2 1 0", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderBottom: "1px solid #1C2840",
          background: "#0B0F1A",
          flexShrink: 0,
          height: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="terminal-panel-title">Performance vs Benchmarks</span>
          {alpha !== null && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 2,
                background: alpha >= 0 ? "rgba(0,230,168,0.1)" : "rgba(255,68,88,0.1)",
                color: alpha >= 0 ? "#00E6A8" : "#FF4458",
                border: `1px solid ${alpha >= 0 ? "rgba(0,230,168,0.2)" : "rgba(255,68,88,0.2)"}`,
                letterSpacing: 0.5,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              α {alpha >= 0 ? "+" : ""}
              {alpha.toFixed(1)}%
            </span>
          )}
        </div>
        {/* Period selector */}
        <div style={{ display: "flex", gap: 2 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "2px 8px",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 0.8,
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
                background: period === p ? "rgba(0,217,255,0.12)" : "transparent",
                color: period === p ? "#00D9FF" : "#4A5A6E",
                transition: "all 0.15s",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onMouseEnter={(e) => {
                if (period !== p) e.currentTarget.style.color = "#8B949E";
              }}
              onMouseLeave={(e) => {
                if (period !== p) e.currentTarget.style.color = "#4A5A6E";
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-3"
        style={{ height: 22, borderBottom: "1px solid #1C2840", flexShrink: 0 }}
      >
        {[
          { key: "portfolio", label: "Portfolio", color: "#00D9FF", dash: false },
          { key: "voo", label: "VOO", color: "#F0883E", dash: true },
          { key: "qqq", label: "QQQ", color: "#A371F7", dash: true },
        ].map(({ key, label, color, dash }) => {
          const val = latest ? (latest as any)[key] as number : null;
          return (
            <div key={key} className="flex items-center gap-1">
              {dash ? (
                <div style={{ width: 14, height: 0, borderTop: `2px dashed ${color}` }} />
              ) : (
                <div style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />
              )}
              <span style={{ fontSize: 9, color: "#C9D1D9" }}>{label}</span>
              {val !== null && (
                <span
                  style={{
                    fontSize: 9,
                    color: val >= 0 ? "#00E6A8" : "#FF4458",
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 600,
                    marginLeft: 2,
                  }}
                >
                  {val >= 0 ? "+" : ""}
                  {val.toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1C2840" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#8B949E" }}
              axisLine={{ stroke: "#1C2840" }}
              tickLine={false}
              interval={tickInterval}
              tickFormatter={formatDateLabel}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#8B949E" }}
              axisLine={{ stroke: "#1C2840" }}
              tickLine={false}
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
              domain={["auto", "auto"]}
            />
            <ReferenceLine y={0} stroke="#2A3A4C" strokeWidth={1} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="portfolio"
              stroke="#00D9FF"
              strokeWidth={2}
              fill="rgba(0, 217, 255, 0.06)"
              dot={false}
              activeDot={{ r: 3, fill: "#00D9FF", stroke: "#0B0F1A", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="voo"
              stroke="#F0883E"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3, fill: "#F0883E", stroke: "#0B0F1A", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="qqq"
              stroke="#A371F7"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3, fill: "#A371F7", stroke: "#0B0F1A", strokeWidth: 1 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
