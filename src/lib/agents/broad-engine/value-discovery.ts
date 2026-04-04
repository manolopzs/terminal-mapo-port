import { getKeyMetrics, getKeyRatios, getProfile } from "../../../../server/lib/fmp.js";
import { isExcluded } from "../../constants/exclusion-list.js";
import { getAgiAlignment } from "../../constants/sector-map.js";
import type { CandidateTicker } from "../../fmp/types.js";

const VALUE_UNIVERSE = [
  "VRT", "CIEN", "COHR", "NTAP", "EME", "VST", "ETR", "AES", "MRVL", "ON",
  "LPLA", "MKTX", "STRL", "HIMS", "ELF", "CRDO", "PSTG", "NRG", "GNRC", "DRS",
  "KTOS", "BAH", "LDOS", "GXO", "RXO", "SITE", "MLM", "OTTR", "ATO", "NI",
];

const MIN_MARKET_CAP = 500_000_000;
const MAX_MARKET_CAP = 50_000_000_000;
const BATCH_SIZE = 5;
const TOP_N = 15;

interface ValueCandidate extends CandidateTicker {
  evEbitda: number;
}

async function fetchKeyMetricsSafe(ticker: string): Promise<any | null> {
  try {
    const data = await getKeyMetrics(ticker);
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

async function fetchRatiosSafe(ticker: string): Promise<any | null> {
  try {
    const data = await getKeyRatios(ticker);
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

async function fetchProfileSafe(ticker: string): Promise<any | null> {
  try {
    const data = await getProfile(ticker);
    if (!data) return null;
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
}

export async function runValueDiscovery(): Promise<CandidateTicker[]> {
  const valueCandidates: ValueCandidate[] = [];

  for (let i = 0; i < VALUE_UNIVERSE.length; i += BATCH_SIZE) {
    const batch = VALUE_UNIVERSE.slice(i, i + BATCH_SIZE);

    const [metricsResults, ratiosResults, profileResults] = await Promise.all([
      Promise.allSettled(batch.map(t => fetchKeyMetricsSafe(t))),
      Promise.allSettled(batch.map(t => fetchRatiosSafe(t))),
      Promise.allSettled(batch.map(t => fetchProfileSafe(t))),
    ]);

    for (let j = 0; j < batch.length; j++) {
      const ticker = batch[j];
      const metricsResult = metricsResults[j];
      const ratiosResult = ratiosResults[j];
      const profileResult = profileResults[j];

      if (metricsResult.status === "rejected" || !metricsResult.value) continue;
      if (profileResult.status === "rejected" || !profileResult.value) continue;

      const metrics = metricsResult.value;
      // ratios may be null if fetch failed — fall back gracefully
      const ratios = ratiosResult.status === "fulfilled" ? ratiosResult.value : null;
      const profile = profileResult.value;

      // Exclusion check
      const exclusion = isExcluded(ticker);
      if (exclusion.excluded) continue;

      const marketCap: number = profile.marketCap ?? profile.mktCap ?? 0;
      if (marketCap < MIN_MARKET_CAP || marketCap > MAX_MARKET_CAP) continue;

      // Value filter: EV/EBITDA between 0 and 20, P/B between 0 and 5
      // FMP stable /key-metrics uses 'evToEBITDA'; /ratios uses 'priceToBookRatio'
      const evEbitda: number = metrics.evToEBITDA ?? metrics.enterpriseValueOverEBITDA ?? 0;
      const pbRatio: number = ratios?.priceToBookRatio ?? ratios?.pbRatio ?? metrics.pbRatio ?? 0;

      const evEbitdaValid = evEbitda > 0 && evEbitda < 20;
      const pbValid = pbRatio > 0 && pbRatio < 5;

      if (!evEbitdaValid || !pbValid) continue;

      const baseScore = getAgiAlignment(
        profile.sector ?? "",
        profile.industry ?? "",
        profile.description ?? ""
      );
      // +3 bonus for passing value filter
      const agiAlignmentScore = Math.min(100, baseScore + 3);

      valueCandidates.push({
        ticker,
        companyName: profile.companyName ?? ticker,
        marketCap,
        sector: profile.sector ?? "Unknown",
        industry: profile.industry ?? "Unknown",
        agiAlignmentScore,
        screeningNotes: "Value Factor confirmed: EV/EBITDA + P/B filter",
        screenType: "VALUE_DISCOVERY",
        evEbitda,
      });
    }
  }

  // Sort by EV/EBITDA ascending (cheapest first)
  valueCandidates.sort((a, b) => a.evEbitda - b.evEbitda);

  // Strip internal field before returning
  return valueCandidates.slice(0, TOP_N).map(({ evEbitda: _ev, ...rest }) => rest);
}
