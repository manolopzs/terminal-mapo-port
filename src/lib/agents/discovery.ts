/**
 * MAPO Unified Discovery Agent
 * Replaces 7 separate agents (4 AGI + 3 broad) + 2 overlays with a single pass.
 * Fetches FMP profiles for the master universe, applies filters, returns top candidates.
 */
import { getProfile, getFinancialGrowth, getKeyMetrics, getKeyRatios } from "../../../server/lib/fmp.js";
import { isExcluded } from "../constants/exclusion-list.js";
import { getAgiAlignment } from "../constants/sector-map.js";
import type { CandidateTicker } from "../fmp/types.js";

/* ── Master ticker universe ─────────────────────────────────────────────── */

const AGI_COMPUTE = [
  "VRT", "CIEN", "SMCI", "CRDO", "ANET", "COHR", "PSTG", "NTAP", "EME", "PWR",
  "DELL", "HPE", "JNPR", "LITE", "FORM", "DY", "MYRG",
];

const AGI_POWER = [
  "VST", "CEG", "ETR", "NRG", "AES", "GNRC", "OTTR", "ATO", "NI",
  "GEV", "POWL", "ETN",
];

const AGI_SEMI = [
  "MRVL", "ON", "MPWR", "PI", "POWI", "DIOD", "ONTO", "MKSI",
  "LRCX", "KLIC", "MTSI", "AMBA",
];

const AGI_DEFENSE = [
  "PLTR", "LDOS", "SAIC", "CACI", "BAH", "DRS", "KTOS", "AVAV",
  "AXON", "CRWD",
];

const GROWTH = [
  "DDOG", "ZS", "NET", "SNOW", "MDB", "HUBS", "BILL", "CFLT", "GTLB", "TOST",
  "S", "PANW", "SQ", "SOFI", "HOOD", "NU", "AFRM",
  "HIMS", "ELF", "STRL", "MKTX", "LPLA",
];

const VALUE = [
  "GXO", "RXO", "SITE", "MLM", "BAH", "LDOS",
];

// Deduplicated master universe
const UNIVERSE = Array.from(new Set([
  ...AGI_COMPUTE, ...AGI_POWER, ...AGI_SEMI, ...AGI_DEFENSE,
  ...GROWTH, ...VALUE,
]));

// Category lookup for screening notes
const CATEGORY_MAP = new Map<string, string>();
AGI_COMPUTE.forEach(t => CATEGORY_MAP.set(t, "AGI_COMPUTE"));
AGI_POWER.forEach(t => CATEGORY_MAP.set(t, "AGI_POWER"));
AGI_SEMI.forEach(t => CATEGORY_MAP.set(t, "AGI_SEMI"));
AGI_DEFENSE.forEach(t => CATEGORY_MAP.set(t, "AGI_DEFENSE"));
GROWTH.forEach(t => {
  const existing = CATEGORY_MAP.get(t);
  CATEGORY_MAP.set(t, existing ? `${existing}+GROWTH` : "GROWTH");
});
VALUE.forEach(t => {
  const existing = CATEGORY_MAP.get(t);
  CATEGORY_MAP.set(t, existing ? `${existing}+VALUE` : "VALUE");
});

/* ── Config ──────────────────────────────────────────────────────────────── */

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const MIN_LIQUIDITY = 5_000_000;
const BATCH_SIZE = 10;
const TOP_N = 30;

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function fetchSafe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    const data = await fn();
    if (!data) return null;
    return Array.isArray(data) ? (data[0] ?? null) as T : data;
  } catch {
    return null;
  }
}

/* ── Main discovery function ─────────────────────────────────────────────── */

export interface DiscoveryResult {
  candidates: CandidateTicker[];
  stats: { total: number; excluded: number; filtered: number; passed: number };
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  const candidates: CandidateTicker[] = [];
  let excluded = 0;
  let filtered = 0;

  for (let i = 0; i < UNIVERSE.length; i += BATCH_SIZE) {
    const batch = UNIVERSE.slice(i, i + BATCH_SIZE);

    // Fetch profiles for the batch in parallel
    const profiles = await Promise.allSettled(
      batch.map(t => fetchSafe(() => getProfile(t)))
    );

    for (let j = 0; j < batch.length; j++) {
      const ticker = batch[j];
      const profileResult = profiles[j];
      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      if (!profile) { filtered++; continue; }

      // Exclusion check
      const exclusion = isExcluded(ticker);
      if (exclusion.excluded) { excluded++; continue; }

      const price: number = (profile as any).price ?? 0;
      const marketCap: number = (profile as any).marketCap ?? (profile as any).mktCap ?? 0;
      const volAvg: number = (profile as any).averageVolume ?? (profile as any).volAvg ?? 0;

      // Market cap filter
      if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) { filtered++; continue; }

      // Liquidity filter
      if (price > 0 && volAvg > 0 && volAvg * price < MIN_LIQUIDITY) { filtered++; continue; }

      // AGI alignment score
      const agiScore = getAgiAlignment(
        (profile as any).sector ?? "",
        (profile as any).industry ?? "",
        (profile as any).description ?? ""
      );

      const category = CATEGORY_MAP.get(ticker) ?? "BROAD";

      candidates.push({
        ticker,
        companyName: (profile as any).companyName ?? ticker,
        marketCap,
        sector: (profile as any).sector ?? "Unknown",
        industry: (profile as any).industry ?? "Unknown",
        agiAlignmentScore: agiScore,
        screeningNotes: category,
        screenType: category,
      });
    }
  }

  // Sort by AGI alignment descending, then market cap descending
  candidates.sort((a, b) => {
    if (b.agiAlignmentScore !== a.agiAlignmentScore) {
      return b.agiAlignmentScore - a.agiAlignmentScore;
    }
    return b.marketCap - a.marketCap;
  });

  const topCandidates = candidates.slice(0, TOP_N);

  return {
    candidates: topCandidates,
    stats: {
      total: UNIVERSE.length,
      excluded,
      filtered,
      passed: topCandidates.length,
    },
  };
}
