export const T = {
  bg: "#07080c",
  surface: "#0e1017",
  surfaceAlt: "#131620",
  border: "#1a1d2a",
  borderHi: "#252940",
  green: "#00e59a",
  blue: "#3b82f6",
  purple: "#a855f7",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
  rose: "#f43f5e",
  white: "#e8eaf0",
  dim: "#6b7094",
  muted: "#353a52",
  gold: "#fbbf24",
  font: {
    mono: "'IBM Plex Mono', monospace",
    sans: "'DM Sans', sans-serif",
    display: "'Space Grotesk', sans-serif",
  },
} as const;

export type TokenColor = keyof Omit<typeof T, "font">;
