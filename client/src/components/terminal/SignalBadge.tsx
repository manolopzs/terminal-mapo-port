import { T } from "@/styles/tokens";

interface SignalBadgeProps {
  signal: string;
  confirmed: boolean;
}

export function SignalBadge({ signal, confirmed }: SignalBadgeProps) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: T.font.mono,
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 5px",
        borderRadius: 3,
        background: confirmed ? T.green : "transparent",
        border: `1px solid ${confirmed ? T.green : T.muted}`,
        color: confirmed ? T.bg : T.muted,
      }}
    >
      {signal}{confirmed ? "+" : "-"}
    </span>
  );
}
