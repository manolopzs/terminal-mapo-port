import { T } from "@/styles/tokens";

interface MetricBoxProps {
  value: string | number;
  label: string;
  color: string;
  trend?: "up" | "down" | "flat";
}

export function MetricBox({ value, label, color, trend }: MetricBoxProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: 20,
            fontWeight: 700,
            color,
          }}
        >
          {value}
        </span>
        {trend === "up" && (
          <span style={{ color: T.green, fontSize: 12, lineHeight: 1 }}>▲</span>
        )}
        {trend === "down" && (
          <span style={{ color: T.red, fontSize: 12, lineHeight: 1 }}>▼</span>
        )}
      </div>
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: T.muted,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
