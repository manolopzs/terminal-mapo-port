import { T } from "@/styles/tokens";

interface StatusDotProps {
  color: string;
  size?: number;
}

export function StatusDot({ color, size = 6 }: StatusDotProps) {
  return (
    <span
      className="inline-block rounded-full animate-pulse"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 ${size}px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}
