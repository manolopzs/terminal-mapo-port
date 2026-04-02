import { useEffect, useState } from "react";
import { T } from "@/styles/tokens";

interface ScoreBarProps {
  label: string;
  score: number;
  weight: string;
  color: string;
  notes?: string;
}

export function ScoreBar({ label, score, weight, color, notes }: ScoreBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 50);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
        <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.white }}>{label}</span>
        <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>{weight}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, background: T.border, borderRadius: 3, height: 6 }}>
          <div
            style={{
              width: `${width}%`,
              background: color,
              height: 6,
              borderRadius: 3,
              transition: "width 600ms ease-out",
            }}
          />
        </div>
        <span style={{ fontFamily: T.font.mono, fontSize: 12, fontWeight: 700, color, minWidth: 28, textAlign: "right" }}>
          {score}
        </span>
      </div>
      {notes && (
        <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.dim, marginTop: 3 }}>{notes}</div>
      )}
    </div>
  );
}
