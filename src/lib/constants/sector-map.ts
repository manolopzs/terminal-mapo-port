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

/* ── Granular keyword categories for AGI alignment scoring ────────────── */

const AGI_KEYWORD_CATEGORIES: {
  name: string;
  range: [number, number];
  keywords: string[];
}[] = [
  {
    name: "AI Infrastructure",
    range: [90, 100],
    keywords: [
      "data center", "cloud computing", "gpu", "hpc", "ai chip",
      "colocation", "server rack", "cooling", "fiber optics",
      "networking equipment", "high performance computing",
    ],
  },
  {
    name: "Cybersecurity",
    range: [80, 90],
    keywords: [
      "cybersecurity", "zero trust", "identity management", "endpoint security",
      "threat detection", "network security", "information security",
      "encryption", "security software",
    ],
  },
  {
    name: "Power/Grid for AI",
    range: [80, 95],
    keywords: [
      "utility", "nuclear", "power management", "grid", "transformer",
      "natural gas", "electrical infrastructure", "power generation",
      "independent power", "electric utility", "gas utility",
      "nuclear energy", "power distribution",
    ],
  },
  {
    name: "Semiconductors",
    range: [75, 90],
    keywords: [
      "semiconductor", "memory", "chip", "wafer", "foundry",
      "interface chip", "optical", "power semi", "analog",
      "integrated circuit", "fabless", "eda", "lithography",
    ],
  },
  {
    name: "Defense/Gov AI",
    range: [75, 85],
    keywords: [
      "defense", "government", "military", "intelligence",
      "national security", "aerospace & defense", "gov contract",
      "defense electronics", "c4isr",
    ],
  },
  {
    name: "Enterprise Software",
    range: [70, 85],
    keywords: [
      "saas", "cloud software", "analytics", "automation",
      "ai platform", "enterprise software", "machine learning",
      "data analytics", "business intelligence", "erp",
      "crm", "devops", "infrastructure software",
    ],
  },
  {
    name: "Fintech",
    range: [60, 75],
    keywords: [
      "fintech", "payments", "digital banking", "trading platform",
      "financial technology", "payment processing", "digital payments",
      "blockchain", "insurtech",
    ],
  },
  {
    name: "Healthcare Tech",
    range: [55, 70],
    keywords: [
      "medtech", "biotech", "diagnostics", "digital health",
      "health information", "telemedicine", "medical device",
      "genomics", "precision medicine", "health technology",
    ],
  },
  {
    name: "Clean Energy",
    range: [50, 65],
    keywords: [
      "solar", "wind", "battery", "ev", "hydrogen",
      "renewable", "energy storage", "electric vehicle",
      "clean energy", "fuel cell",
    ],
  },
  {
    name: "Traditional",
    range: [30, 50],
    keywords: [
      "retail", "consumer", "media", "real estate",
      "restaurant", "apparel", "food", "beverage",
      "hospitality", "leisure", "entertainment",
    ],
  },
];

export function getAgiAlignment(sector: string, industry: string, description: string): number {
  const text = `${sector} ${industry} ${description}`.toLowerCase();

  // Find the best-matching category: score each by keyword hit count,
  // then pick the category with the highest resulting score.
  let bestScore = -1;

  for (const cat of AGI_KEYWORD_CATEGORIES) {
    const hits = cat.keywords.filter(kw => text.includes(kw)).length;
    if (hits === 0) continue;

    const [lo, hi] = cat.range;
    // More keyword matches push the score higher within the range
    const maxPossible = cat.keywords.length;
    const ratio = Math.min(hits / Math.max(maxPossible * 0.4, 1), 1); // 40% of keywords = top of range
    const score = Math.round(lo + ratio * (hi - lo));

    if (score > bestScore) {
      bestScore = score;
    }
  }

  // If no category matched, assign a low baseline
  return bestScore > 0 ? bestScore : 40;
}
