import { createClient } from "@supabase/supabase-js";
import type { Holding, Trade, PortfolioSnapshot } from "./types.js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Maps a Supabase holdings row to a Holding.
 * Supports both old schema (quantity/cost_basis/name) and new schema (shares/entry_price/company_name).
 */
function mapHolding(row: any): Holding {
  const shares = row.shares != null ? Number(row.shares)
    : row.quantity != null ? Number(row.quantity) : 0;
  const entryPrice = row.entry_price != null ? Number(row.entry_price)
    : row.cost_basis != null ? Number(row.cost_basis) : 0;
  const companyName = row.company_name ?? row.name ?? "";
  return {
    id: row.id,
    ticker: row.ticker,
    companyName,
    shares,
    entryPrice,
    entryDate: row.entry_date ?? row.created_at?.split("T")[0] ?? "",
    entryScore: Number(row.entry_score ?? 65),
    sector: row.sector ?? "Unknown",
    marketCapAtEntry: Number(row.market_cap_at_entry ?? 0),
    trancheNumber: Number(row.tranche_number ?? 1),
    notes: row.notes ?? undefined,
  };
}

/** Get the first available portfolio ID (needed for old schema inserts). */
async function getDefaultPortfolioId(): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("portfolios")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getHoldings(): Promise<Holding[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("holdings").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapHolding);
}

export async function addHolding(holding: Omit<Holding, "id">): Promise<Holding> {
  const sb = getSupabase();
  const portfolioId = await getDefaultPortfolioId();
  const today = holding.entryDate || new Date().toISOString().split("T")[0];
  const row: any = {
    ticker: holding.ticker,
    name: holding.companyName,
    quantity: holding.shares,
    cost_basis: holding.entryPrice,
    price: holding.entryPrice,
    value: holding.shares * holding.entryPrice,
    sector: holding.sector,
    type: "Stock",
    source: "mapo",
  };
  if (portfolioId) row.portfolio_id = portfolioId;

  const { data, error } = await sb.from("holdings").insert(row).select().single();
  if (error) throw new Error(error.message);
  return { ...holding, id: data.id };
}

export async function removeHolding(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("holdings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getCash(): Promise<number> {
  const sb = getSupabase();
  const { data } = await sb
    .from("portfolio_snapshots")
    .select("cash")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.cash ?? 0);
}

export async function logTrade(trade: Omit<Trade, "id">): Promise<void> {
  const sb = getSupabase();
  const portfolioId = await getDefaultPortfolioId();
  const row: any = {
    ticker: trade.ticker,
    action: trade.action,
    shares: trade.shares,
    price: trade.price,
    total: trade.totalValue,
    name: trade.ticker,
    rationale: trade.rationale,
    date: trade.tradeDate,
    // Extended MAPO fields (stored if columns exist)
    total_value: trade.totalValue,
    score_at_trade: trade.scoreAtTrade ?? null,
    trade_date: trade.tradeDate,
  };
  if (portfolioId) row.portfolio_id = portfolioId;
  // Try new trade_log table first, fallback to trades
  const { error: logError } = await sb.from("trade_log").insert(row);
  if (logError) {
    // Fallback: write to trades table (old schema)
    const tradeRow: any = {
      ticker: trade.ticker,
      action: trade.action,
      shares: trade.shares,
      price: trade.price,
      total: trade.totalValue,
      name: trade.ticker,
      rationale: trade.rationale ?? "",
      date: trade.tradeDate,
    };
    if (portfolioId) tradeRow.portfolio_id = portfolioId;
    await sb.from("trades").insert(tradeRow).then(() => {}); // non-fatal
  }
}

export async function saveSnapshot(snapshot: Omit<PortfolioSnapshot, "id">): Promise<void> {
  const sb = getSupabase();
  await sb.from("portfolio_snapshots").upsert({
    snapshot_date: snapshot.snapshotDate,
    total_value: snapshot.totalValue,
    cash: snapshot.cash,
    holdings_json: snapshot.holdingsJson,
    sp500_value: snapshot.sp500Value,
    total_return: snapshot.totalReturn,
    sp500_return: snapshot.sp500Return,
    alpha: snapshot.alpha,
  });
}

export async function getSnapshotHistory(days: number = 30): Promise<PortfolioSnapshot[]> {
  const sb = getSupabase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
  const { data } = await sb
    .from("portfolio_snapshots")
    .select("*")
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });
  return (data ?? []).map(row => ({
    snapshotDate: row.snapshot_date,
    totalValue: Number(row.total_value),
    cash: Number(row.cash),
    holdingsJson: row.holdings_json,
    sp500Value: row.sp500_value ? Number(row.sp500_value) : undefined,
    totalReturn: row.total_return ? Number(row.total_return) : undefined,
    sp500Return: row.sp500_return ? Number(row.sp500_return) : undefined,
    alpha: row.alpha ? Number(row.alpha) : undefined,
  }));
}
