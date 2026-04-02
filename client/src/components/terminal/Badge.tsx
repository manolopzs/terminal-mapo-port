import { ReactNode } from "react";
import { T } from "@/styles/tokens";

interface BadgeProps {
  color: string;
  filled?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ color, filled = false, children, className = "" }: BadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        background: filled ? color : `${color}26`,
        border: `1px solid ${filled ? color : `${color}66`}`,
        color: filled ? T.bg : color,
        fontFamily: T.font.mono,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 600,
        borderRadius: 4,
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
