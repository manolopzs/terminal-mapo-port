/**
 * POST /api/screen/cached
 * Returns pre-scored screener results from Supabase cache.
 */
import type { Request, Response } from "express";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

export async function screenCachedRoute(_req: Request, res: Response): Promise<void> {
  if (!isSupabaseEnabled) {
    res.status(503).json({ error: "Supabase not configured" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("screener_cache" as any)
      .select("*")
      .order("score", { ascending: false });

    if (error) throw new Error(error.message);

    // Derive the most recent updated_at across all rows
    let latestUpdatedAt: string | null = null;
    for (const row of data ?? []) {
      if (row.updated_at && (!latestUpdatedAt || row.updated_at > latestUpdatedAt)) {
        latestUpdatedAt = row.updated_at;
      }
    }

    const results = (data ?? []).map((row: any) => ({
      ticker: row.ticker,
      name: row.ticker,
      sector: row.sector,
      industry: row.industry,
      marketCap: row.market_cap,
      marketCapB: row.market_cap ? `$${(row.market_cap / 1e9).toFixed(1)}B` : "?",
      agiAlignmentScore: 0,
      screenType: "cached",
      screeningNotes: row.screening_notes,
      signalCount: 1,
      price: null,
      changePct: 0,
      score: row.score,
      rating: row.rating,
      rejected: false,
      rejectReason: null,
      quantSignals: null,
      factors: row.factors ?? null,
    }));

    res.json({ results, cached: true, updated_at: latestUpdatedAt });
  } catch (err: any) {
    console.error("[screen/cached]", err);
    res.status(500).json({ error: err.message });
  }
}
