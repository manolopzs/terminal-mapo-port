import { useMemo } from "react";
import type { Holding } from "@shared/schema";
import type { NewsItem } from "@/hooks/use-portfolio";

interface NewsTickerProps {
  holdings: Holding[];
  liveNews?: NewsItem[];
}

export function NewsTicker({ holdings, liveNews }: NewsTickerProps) {
  const headlines = useMemo(() => {
    if (liveNews && liveNews.length > 0) {
      return liveNews.map(n => ({
        source: n.ticker,
        text: n.headline,
        time: n.time,
      }));
    }
    return [];
  }, [liveNews]);

  // No live news yet — show a waiting indicator instead of fake headlines
  if (headlines.length === 0) {
    if (holdings.length === 0) return null;
    return (
      <div
        className="flex items-center flex-shrink-0 overflow-hidden"
        style={{ height: 30, minHeight: 30, background: "#0A0E18", borderTop: "1px solid #1C2840" }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(139,148,158,0.08)", padding: "0 8px", height: "100%", borderRight: "1px solid #1C2840" }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "#4A5A6E", letterSpacing: 1 }}>NEWS</span>
        </div>
        <span style={{ fontSize: 11, color: "#2E3E52", padding: "0 12px", fontFamily: "monospace" }}>
          Awaiting live news feed...
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center flex-shrink-0 overflow-hidden"
      style={{
        height: 30,
        minHeight: 30,
        background: "#0A0E18",
        borderTop: "1px solid #1C2840",
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          background: "rgba(0, 217, 255, 0.1)",
          padding: "0 8px",
          height: "100%",
          borderRight: "1px solid #1C2840",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#00D9FF",
            letterSpacing: 1,
          }}
        >
          {liveNews && liveNews.length > 0 ? "LIVE NEWS" : "NEWS"}
        </span>
      </div>
      <div
        className="flex-1 overflow-hidden whitespace-nowrap"
        style={{ padding: "0 8px" }}
      >
        <div className="inline-flex animate-marquee items-center gap-6">
          {headlines.concat(headlines).map((h, i) => (
            <span key={i} className="inline-flex items-center gap-2" style={{ fontSize: 11 }}>
              <span
                className="font-mono"
                style={{ color: "#00D9FF", fontWeight: 600 }}
              >
                {h.source}
              </span>
              <span style={{ color: "#8B949E", fontSize: 11 }}>{h.text}</span>
              <span style={{ color: "#4A5568", fontSize: 10 }}>{h.time}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
