import { T } from "@/styles/tokens";

interface EmptyStateProps {
  message: string;
  icon?: string;
}

export function EmptyState({ message, icon = "—" }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 32,
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.dim }}>{message}</span>
    </div>
  );
}
