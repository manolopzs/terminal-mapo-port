import { createClient } from "@supabase/supabase-js";
import type { Holding, Trade, PortfolioSnapshot } from "./types.js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getHoldings(): Promise<Holding[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("holdings").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name ?? "",
    shares: Number(row.shares),
    entryPrice: Number(row.entry_price),
    entryDate: row.entry_date,
    entryScore: Number(row.entry_score),
    sector: row.sector ?? "Unknown",
    marketCapAtEntry: Number(row.market_cap_at_entry ?? 0),
    trancheNumber: Number(row.tranche_number ?? 1),
    notes: row.notes ?? undefined,
  }));
}

export async function addHolding(holding: Omit<Holding, "id">): Promise<Holding> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("holdings")
    .insert({
      ticker: holding.ticker,
      company_name: holding.companyName,
      shares: holding.shares,
      entry_price: holding.entryPrice,
      entry_date: holding.entryDate,
      entry_score: holding.entryScore,
      sector: holding.sector,
      market_cap_at_entry: holding.marketCapAtEntry,
      tranche_number: holding.trancheNumber,
      notes: holding.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...holding, id: data.id };
}

export async function removeHolding(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("holdings").delete().eq("id", id);
  if (error) throw error;
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
  await sb.from("trade_log").insert({
    ticker: trade.ticker,
    action: trade.action,
    shares: trade.shares,
    price: trade.price,
    total_value: trade.totalValue,
    score_at_trade: trade.scoreAtTrade,
    rationale: trade.rationale,
    trade_date: trade.tradeDate,
  });
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
