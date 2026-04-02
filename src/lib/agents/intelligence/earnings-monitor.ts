import { getEarnings } from "../../../../server/lib/fmp.js";

export interface EarningsMonitorResult {
  upcomingEarnings: Array<{
    ticker: string;
    date: string;
    daysUntil: number;
    epsEst: number | null;
  }>;
  recentResults: Array<{
    ticker: string;
    date: string;
    epsActual: number;
    epsEstimated: number;
    surprisePct: number;
    sueScore: number;
    flag: "MANDATORY_RESCORE" | "POTENTIAL_ADD" | "NORMAL";
  }>;
  alerts: string[];
}

function daysBetween(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isWithinLast48Hours(dateStr: string): boolean {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diffMs = now - target;
  return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
}

function calcSue(actual: number, estimated: number): number {
  if (estimated === 0) return 0;
  return (actual - estimated) / Math.abs(estimated);
}

export async function runEarningsMonitor(
  holdings: Array<{ ticker: string; entryPrice: number }>
): Promise<EarningsMonitorResult> {
  const upcoming: EarningsMonitorResult["upcomingEarnings"] = [];
  const recentResults: EarningsMonitorResult["recentResults"] = [];
  const alerts: string[] = [];

  const results = await Promise.allSettled(
    holdings.map(async h => {
      const data = await getEarnings(h.ticker);
      return { ticker: h.ticker, data };
    })
  );

  for (const result of results) {
    if (result.status === "rejected" || !result.value?.data) continue;
    const { ticker, data } = result.value;
    if (!Array.isArray(data)) continue;

    for (const entry of data) {
      const date: string = entry.date ?? "";
      if (!date) continue;

      const epsActual: number | null = entry.epsActual ?? null;
      const epsEstimated: number | null = entry.epsEstimated ?? null;
      const daysUntil = daysBetween(date);

      // Upcoming: future date AND no actual reported yet
      if (daysUntil > 0 && epsActual == null) {
        upcoming.push({
          ticker,
          date,
          daysUntil,
          epsEst: epsEstimated,
        });
        break; // Only take the next upcoming earnings per ticker
      }

      // Recent: within last 48 hours AND actual reported
      if (isWithinLast48Hours(date) && epsActual != null) {
        const estimated = epsEstimated ?? 0;
        const surprisePct = estimated !== 0 ? calcSue(epsActual, estimated) : 0;
        const sueScore = surprisePct;

        let flag: "MANDATORY_RESCORE" | "POTENTIAL_ADD" | "NORMAL" = "NORMAL";
        if (surprisePct < -0.10) {
          flag = "MANDATORY_RESCORE";
          alerts.push(
            `MANDATORY RESCORE: ${ticker} missed EPS by ${(surprisePct * 100).toFixed(1)}% (actual: ${epsActual}, est: ${estimated})`
          );
        } else if (surprisePct > 0.10) {
          flag = "POTENTIAL_ADD";
          alerts.push(
            `POTENTIAL ADD: ${ticker} beat EPS by ${(surprisePct * 100).toFixed(1)}% (actual: ${epsActual}, est: ${estimated})`
          );
        }

        recentResults.push({
          ticker,
          date,
          epsActual,
          epsEstimated: estimated,
          surprisePct,
          sueScore,
          flag,
        });
        break;
      }
    }
  }

  // Sort upcoming by daysUntil ascending
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  return { upcomingEarnings: upcoming, recentResults, alerts };
}
