/**
 * POST /api/screen { sector?, maxMarketCap?, minMarketCap? }
 * Screens MAPO curated universe using FMP profile data
 */
import type { Request, Response } from "express";
import * as fmp from "../../../server/lib/fmp.js";
import { isExcluded } from "../../lib/constants/exclusion-list.js";
import { RULES } from "../../lib/constants/rules.js";

// MAPO curated universe by thesis category
const MAPO_UNIVERSE: Record<string, string[]> = {
  "AI Infrastructure": ["VRT", "CIEN", "SMCI", "CRDO", "ANET", "COHR", "PSTG", "NTAP", "EME", "PWR"],
  "Power Grid": ["VST", "CEG", "ETR", "NRG", "AES", "WTRG", "MGEE", "OTTR", "ATO", "NI"],
  "Semiconductors": ["MRVL", "ON", "MPWR", "WOLF", "SILN", "PI", "FORM", "ACLS", "POWI", "DIOD"],
  "Defense AI": ["PLTR", "LDOS", "SAIC", "CACI", "BAH", "DRS", "KTOS", "RCAT", "AVAV", "HII"],
  "Enterprise AI": ["DDOG", "ZS", "SNOW", "MDB", "HUBS", "BILL", "CFLT", "GTLB", "NET", "TOST"],
  "Healthcare": ["HIMS", "RXRX", "NVCR", "PRAX", "INSM", "FOLD", "PTGX", "ROIV", "RARE", "BEAM"],
  "Financials": ["LPLA", "MKTX", "IBKR", "HOOD", "SOFI", "AFRM", "SQ", "NU", "DAVE", "OPEN"],
  "Industrials": ["STRL", "VELO", "AWK", "GXO", "RXO", "GNRC", "HAYW", "ASTE", "SITE", "MLM"],
};

export async function screenRoute(req: Request, res: Response): Promise<void> {
  try {
    const {
      sector,
      maxMarketCap = RULES.MID_CAP_MAX,
      minMarketCap = 500_000_000,
    } = req.body as { sector?: string; maxMarketCap?: number; minMarketCap?: number };

    // Pick candidates from universe
    let candidates: string[] = sector
      ? (MAPO_UNIVERSE[sector] ?? [])
      : Object.values(MAPO_UNIVERSE).flat();

    // Remove exclusion list
    candidates = candidates.filter(t => !isExcluded(t).excluded);

    // Batch fetch profiles (10 at a time to avoid rate limits)
    const batchSize = 10;
    const profiles: any[] = [];
    for (let i = 0; i < candidates.length && i < 80; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(t => fmp.getProfile(t)));
      results.forEach(r => {
        if (r.status === "fulfilled" && Array.isArray(r.value) && r.value[0]) {
          profiles.push(r.value[0]);
        }
      });
    }

    // Filter by market cap
    const filtered = profiles
      .filter(p => {
        const cap = p.marketCap ?? p.mktCap ?? 0;
        return cap >= minMarketCap && cap <= maxMarketCap;
      })
      .sort((a, b) => ((b.marketCap ?? b.mktCap ?? 0) - (a.marketCap ?? a.mktCap ?? 0)))
      .slice(0, 40)
      .map(p => {
        const cap = p.marketCap ?? p.mktCap ?? 0;
        return {
          ticker: p.symbol,
          name: p.companyName,
          sector: p.sector,
          industry: p.industry,
          marketCapB: cap ? `$${(cap / 1e9).toFixed(1)}B` : "?",
          price: p.price,
          change: p.changes,
          changePct: p.changesPercentage ?? (p.price > 0 ? (p.changes / (p.price - p.changes)) * 100 : 0),
          beta: p.beta,
          volume: p.volAvg,
          high52w: p.range?.split("-")?.[1] ?? null,
          low52w: p.range?.split("-")?.[0] ?? null,
          exchange: p.exchangeShortName,
          description: (p.description ?? "").slice(0, 120),
        };
      });

    res.json(filtered);
  } catch (err: any) {
    console.error("[/api/screen]", err);
    res.status(500).json({ error: err.message });
  }
}
