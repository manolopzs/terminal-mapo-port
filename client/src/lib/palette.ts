export interface Palette {
  id: string;
  name: string;
  description: string;
  vars: Record<string, string>;
}

export const PALETTES: Palette[] = [
  {
    id: "amber",
    name: "MAPO Amber",
    description: "Warm gold — FT editorial",
    vars: {
      "--color-primary":  "#D4A853",
      "--color-green":    "#00E6A8",
      "--color-red":      "#FF4458",
      "--color-orange":   "#F0883E",
      "--color-cyan":     "#D4A853",
    },
  },
  {
    id: "cyan",
    name: "Terminal Cyan",
    description: "Classic Bloomberg green-blue",
    vars: {
      "--color-primary":  "#00B4D8",
      "--color-green":    "#00E6A8",
      "--color-red":      "#FF4458",
      "--color-orange":   "#F0883E",
      "--color-cyan":     "#00B4D8",
    },
  },
  {
    id: "violet",
    name: "Deep Violet",
    description: "Crypto / dark editorial",
    vars: {
      "--color-primary":  "#A371F7",
      "--color-green":    "#3FB950",
      "--color-red":      "#F85149",
      "--color-orange":   "#FF9500",
      "--color-cyan":     "#A371F7",
    },
  },
  {
    id: "platinum",
    name: "Platinum",
    description: "Monochrome — ultra-minimal",
    vars: {
      "--color-primary":  "#C9D1D9",
      "--color-green":    "#58A6FF",
      "--color-red":      "#F85149",
      "--color-orange":   "#E3B341",
      "--color-cyan":     "#C9D1D9",
    },
  },
];

const STORAGE_KEY = "mapo-palette";

export function getSavedPaletteId(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "amber";
}

export function applyPalette(id: string) {
  const p = PALETTES.find(p => p.id === id) ?? PALETTES[0];
  const root = document.documentElement;
  for (const [key, val] of Object.entries(p.vars)) {
    root.style.setProperty(key, val);
  }
  localStorage.setItem(STORAGE_KEY, id);
}

export function initPalette() {
  applyPalette(getSavedPaletteId());
}
