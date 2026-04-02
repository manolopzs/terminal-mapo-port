import { getProfile } from "../../../../server/lib/fmp.js";
import type { CandidateTicker } from "../../fmp/types.js";

const BATCH_SIZE = 5;

const CHINA_KEYWORDS = ["china", "chinese", "asia pacific"];
const US_GOV_KEYWORDS = ["government", "federal", "defense contract", "department of defense"];
const RARE_EARTH_KEYWORDS = ["rare earth", "lithium", "cobalt"];

function descriptionContains(description: string, keywords: string[]): boolean {
  const lower = description.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
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

export async function applyGeopoliticalOverlay(
  candidates: CandidateTicker[]
): Promise<CandidateTicker[]> {
  const adjusted: CandidateTicker[] = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const profileResults = await Promise.allSettled(
      batch.map(c => fetchProfileSafe(c.ticker))
    );

    for (let j = 0; j < batch.length; j++) {
      const candidate = { ...batch[j] };
      const profileResult = profileResults[j];
      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;

      if (!profile) {
        adjusted.push(candidate);
        continue;
      }

      const description: string = profile.description ?? "";
      const notes: string[] = [candidate.screeningNotes];

      // China revenue risk
      if (descriptionContains(description, CHINA_KEYWORDS)) {
        candidate.agiAlignmentScore -= 7;
        notes.push("China revenue risk");
      }

      // US gov revenue boost
      if (descriptionContains(description, US_GOV_KEYWORDS)) {
        candidate.agiAlignmentScore += 5;
        notes.push("US gov revenue");
      }

      // Rare earth / supply chain risk
      if (descriptionContains(description, RARE_EARTH_KEYWORDS)) {
        notes.push("Supply chain risk: rare earth dependency");
      }

      // Clamp score
      candidate.agiAlignmentScore = Math.max(0, Math.min(100, candidate.agiAlignmentScore));
      candidate.screeningNotes = notes.join("; ");

      adjusted.push(candidate);
    }
  }

  return adjusted;
}
