import type { Request, Response } from "express";
import { supabase } from "../../../lib/supabase.js";
import { getHoldings } from "../../../lib/portfolio/state.js";

interface UpdatePortfolioBody {
  action: "BUY" | "SELL" | "TRIM";
  ticker: string;
  shares: number;
  price: number;
  rationale: string;
  companyName?: string;
  sector?: string;
  entryScore?: number;
}

async function logToTradeLog(
  ticker: string,
  action: "BUY" | "SELL" | "TRIM",
  shares: number,
  price: number,
  rationale: string,
  entryScore?: number
): Promise<void> {
  const totalValue = shares * price;
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("trade_log").insert({
    ticker,
    action,
    shares,
    price,
    total_value: totalValue,
    score_at_trade: entryScore ?? null,
    rationale,
    trade_date: today,
  });
}

async function handleBuy(body: UpdatePortfolioBody): Promise<void> {
  const { ticker, shares, price, companyName, sector, entryScore, rationale } = body;
  const today = new Date().toISOString().split("T")[0];
  const scoreToUse = entryScore ?? 65;

  // Check if holding already exists
  const { data: existing, error: fetchError } = await supabase
    .from("holdings")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    // Update: weighted average entry price and add shares
    const existingShares = Number(existing.shares);
    const existingPrice = Number(existing.entry_price);
    const totalShares = existingShares + shares;
    const weightedAvgPrice =
      (existingShares * existingPrice + shares * price) / totalShares;

    const { error: updateError } = await supabase
      .from("holdings")
      .update({
        shares: totalShares,
        entry_price: Math.round(weightedAvgPrice * 10000) / 10000,
      })
      .eq("ticker", ticker.toUpperCase());

    if (updateError) throw updateError;
  } else {
    // Insert new holding
    const { error: insertError } = await supabase.from("holdings").insert({
      ticker: ticker.toUpperCase(),
      company_name: companyName ?? ticker.toUpperCase(),
      shares,
      entry_price: price,
      entry_date: today,
      entry_score: scoreToUse,
      sector: sector ?? "Unknown",
      market_cap_at_entry: 0,
      tranche_number: 1,
    });

    if (insertError) throw insertError;
  }

  await logToTradeLog(ticker, "BUY", shares, price, rationale, scoreToUse);
}

async function handleSell(body: UpdatePortfolioBody): Promise<void> {
  const { ticker, shares, price, rationale, entryScore } = body;

  const { error: deleteError } = await supabase
    .from("holdings")
    .delete()
    .eq("ticker", ticker.toUpperCase());

  if (deleteError) throw deleteError;

  await logToTradeLog(ticker, "SELL", shares, price, rationale, entryScore);
}

async function handleTrim(body: UpdatePortfolioBody): Promise<void> {
  const { ticker, shares: trimShares, price, rationale, entryScore } = body;

  const { data: existing, error: fetchError } = await supabase
    .from("holdings")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) throw new Error(`No holding found for ticker ${ticker}`);

  const remainingShares = Number(existing.shares) - trimShares;

  if (remainingShares <= 0) {
    // Delete the position entirely
    const { error: deleteError } = await supabase
      .from("holdings")
      .delete()
      .eq("ticker", ticker.toUpperCase());

    if (deleteError) throw deleteError;
  } else {
    const { error: updateError } = await supabase
      .from("holdings")
      .update({ shares: remainingShares })
      .eq("ticker", ticker.toUpperCase());

    if (updateError) throw updateError;
  }

  await logToTradeLog(ticker, "TRIM", trimShares, price, rationale, entryScore);
}

export async function portfolioUpdateRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdatePortfolioBody;

  // Validate required fields
  if (!body.action || !body.ticker || body.shares == null || body.price == null || !body.rationale) {
    res.status(400).json({
      error: "Missing required fields: action, ticker, shares, price, rationale",
    });
    return;
  }

  if (!["BUY", "SELL", "TRIM"].includes(body.action)) {
    res.status(400).json({ error: "Invalid action. Must be BUY, SELL, or TRIM." });
    return;
  }

  if (body.shares <= 0 || body.price <= 0) {
    res.status(400).json({ error: "shares and price must be positive numbers." });
    return;
  }

  try {
    switch (body.action) {
      case "BUY":
        await handleBuy(body);
        break;
      case "SELL":
        await handleSell(body);
        break;
      case "TRIM":
        await handleTrim(body);
        break;
    }

    // Return updated portfolio state
    const holdings = await getHoldings();
    res.status(200).json({
      success: true,
      action: body.action,
      ticker: body.ticker.toUpperCase(),
      holdings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[portfolioUpdateRoute] Error processing ${body.action} for ${body.ticker}:`, message);
    res.status(500).json({ error: message });
  }
}
