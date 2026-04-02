import { T } from "@/styles/tokens";

type Severity = "WARNING" | "CRITICAL" | "INFO";

interface AlertRowProps {
  severity: Severity;
  ticker?: string;
  message: string;
  timestamp?: string;
}

const criticalPulseStyle = `
@keyframes criticalBorderPulse {
  0%, 100% { border-left-color: ${T.rose}; }
  50% { border-left-color: ${T.rose}88; }
}
`;

const severityColor: Record<Severity, string> = {
  WARNING: T.amber,
  CRITICAL: T.rose,
  INFO: T.blue,
};

export function AlertRow({ severity, ticker, message, timestamp }: AlertRowProps) {
  const borderColor = severityColor[severity];
  const isCritical = severity === "CRITICAL";

  return (
    <>
      {isCritical && <style>{criticalPulseStyle}</style>}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 12px",
          background: T.surfaceAlt,
          borderLeft: `3px solid ${borderColor}`,
          animation: isCritical ? "criticalBorderPulse 1.5s ease-in-out infinite" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              textTransform: "uppercase",
              fontWeight: 700,
              color: borderColor,
              flexShrink: 0,
            }}
          >
            {severity}
          </span>
          {ticker && (
            <span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.gold, flexShrink: 0 }}>
              {ticker}
            </span>
          )}
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: 11,
              color: T.white,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {message}
          </span>
        </div>
        {timestamp && (
          <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.dim, flexShrink: 0 }}>
            {timestamp}
          </span>
        )}
      </div>
    </>
  );
}
