export const AGI_SECTORS = {
  COMPUTE_INFRA: {
    signal: "STRONG_OW",
    alignmentRange: [85, 100] as [number, number],
    keywords: ["data center", "cooling", "networking", "fiber optics", "server rack", "colocation"],
    description: "Data center builders, cooling, networking, fiber optics",
  },
  POWER_GRID: {
    signal: "STRONG_OW",
    alignmentRange: [85, 100] as [number, number],
    keywords: ["utility", "transformer", "power management", "grid", "electrical infrastructure"],
    description: "Utilities + grid upgrades serving AI clusters",
  },
  SEMICONDUCTORS_NON_MEGA: {
    signal: "OW",
    alignmentRange: [70, 95] as [number, number],
    keywords: ["semiconductor", "memory", "interface chip", "optical", "power semi"],
    description: "$5B-$50B range, AI-exposed, NOT NVDA/AMD",
  },
  DEFENSE_AI: {
    signal: "MOD_OW",
    alignmentRange: [75, 90] as [number, number],
    keywords: ["defense", "cybersecurity", "government", "national security"],
    description: "US-China AI competition, gov contracts",
  },
  ENTERPRISE_AI: {
    signal: "SELECTIVE",
    alignmentRange: [60, 85] as [number, number],
    keywords: ["enterprise software", "AI SaaS", "analytics", "automation"],
    description: "Real AI revenue, proven monetization",
  },
  CONSUMER_DISC: {
    signal: "UW",
    alignmentRange: [20, 49] as [number, number],
    keywords: [],
    description: "Trade-down risk, AI disruption exposure",
  },
  COMMERCIAL_RE: {
    signal: "UW",
    alignmentRange: [20, 49] as [number, number],
    keywords: [],
    description: "Office vacancy, refinancing stress",
  },
  SUPER_MEGA_CAP: {
    signal: "AVOID",
    alignmentRange: [0, 30] as [number, number],
    keywords: [],
    description: ">$500B, efficiently priced, low alpha",
  },
} as const;

export type AgiSector = keyof typeof AGI_SECTORS;

export function getAgiAlignment(sector: string, industry: string, description: string): number {
  const text = `${sector} ${industry} ${description}`.toLowerCase();

  for (const [key, def] of Object.entries(AGI_SECTORS)) {
    if (key === "SUPER_MEGA_CAP" || key === "CONSUMER_DISC" || key === "COMMERCIAL_RE") continue;
    const matched = def.keywords.some(kw => text.includes(kw));
    if (matched) {
      const [lo, hi] = def.alignmentRange;
      return Math.round((lo + hi) / 2);
    }
  }

  return 50;
}
