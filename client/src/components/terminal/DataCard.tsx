import { T } from "@/styles/tokens";
import { ReactNode } from "react";

interface DataCardProps {
  children: ReactNode;
  accent?: string;
  className?: string;
}

export function DataCard({ children, accent, className = "" }: DataCardProps) {
  return (
    <div
      className={`group transition-all duration-200 ${className}`}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        borderTop: accent ? `2px solid ${accent}` : undefined,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.borderHi;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        if (accent) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${accent}15`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
      }}
    >
      {children}
    </div>
  );
}
