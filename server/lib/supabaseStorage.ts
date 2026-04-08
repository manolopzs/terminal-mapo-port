import { randomUUID } from "crypto";
import { supabase } from "./supabase.js";
import type {
  Portfolio, InsertPortfolio,
  Holding, InsertHolding,
  Trade, InsertTrade,
  ChatMessage, InsertChatMessage,
} from "../../shared/schema.js";

export class SupabaseStorage {
  // ── PORTFOLIOS ──────────────────────────────────────────────────────────────
  async getPortfolios(): Promise<Portfolio[]> {
    const { data, error } = await supabase.from("portfolios").select("*").order("created_at");
    if (error) { console.error("[supabase] getPortfolios:", error.message); return []; }
    return (data ?? []).map(this.mapPortfolio);
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const { data, error } = await supabase.from("portfolios").select("*").eq("id", id).single();
    if (error || !data) return undefined;
    return this.mapPortfolio(data);
  }

  async createPortfolio(p: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const { data, error } = await supabase
      .from("portfolios")
      .insert({ id, name: p.name, type: p.type ?? "custom" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Create default meta
    await supabase.from("portfolio_meta").insert({ portfolio_id: id, cash: 0, starting_capital: 0 });
    return this.mapPortfolio(data);
  }

  async deletePortfolio(id: string): Promise<boolean> {
    const { error } = await supabase.from("portfolios").delete().eq("id", id);
    return !error;
  }

  // ── HOLDINGS ─────────────────────────────────────────────────────────────────
  async getHoldings(portfolioId?: string): Promise<Holding[]> {
    let query = supabase.from("holdings").select("*").order("value", { ascending: false });
    if (portfolioId) query = query.eq("portfolio_id", portfolioId);
    const { data, error } = await query;
    if (error) { console.error("[supabase] getHoldings:", error.message); return []; }
    return (data ?? []).map(this.mapHolding);
  }

  async getHolding(id: string): Promise<Holding | undefined> {
    const { data, error } = await supabase.from("holdings").select("*").eq("id", id).single();
    if (error || !data) return undefined;
    return this.mapHolding(data);
  }

  async createHolding(h: InsertHolding): Promise<Holding> {
    const id = randomUUID();
    const row = {
      id,
      portfolio_id: h.portfolioId,
      ticker: h.ticker,
      name: h.name ?? "",
      quantity: h.quantity,
      cost_basis: h.costBasis,
      price: h.price ?? 0,
      value: h.value ?? 0,
      day_change: h.dayChange ?? null,
      day_change_pct: h.dayChangePct ?? null,
      gain_loss: h.gainLoss ?? null,
      gain_loss_pct: h.gainLossPct ?? null,
      type: h.type ?? "Stock",
      sector: h.sector ?? "Other",
      source: h.source ?? "manual",
    };
    const { data, error } = await supabase.from("holdings").insert(row).select().single();
    if (error) throw new Error(error.message);
    return this.mapHolding(data);
  }

  async updateHolding(id: string, updates: Partial<InsertHolding>): Promise<Holding | undefined> {
    const row: any = {};
    if (updates.quantity !== undefined) row.quantity = updates.quantity;
    if (updates.costBasis !== undefined) row.cost_basis = updates.costBasis;
    if (updates.price !== undefined) row.price = updates.price;
    if (updates.value !== undefined) row.value = updates.value;
    if (updates.dayChange !== undefined) row.day_change = updates.dayChange;
    if (updates.dayChangePct !== undefined) row.day_change_pct = updates.dayChangePct;
    if (updates.gainLoss !== undefined) row.gain_loss = updates.gainLoss;
    if (updates.gainLossPct !== undefined) row.gain_loss_pct = updates.gainLossPct;
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.type !== undefined) row.type = updates.type;
    if (updates.sector !== undefined) row.sector = updates.sector;
    if (updates.source !== undefined) row.source = updates.source;
    const { data, error } = await supabase.from("holdings").update(row).eq("id", id).select().single();
    if (error) return undefined;
    return this.mapHolding(data);
  }

  async deleteHolding(id: string): Promise<boolean> {
    const { error } = await supabase.from("holdings").delete().eq("id", id);
    return !error;
  }

  // ── TRADES ───────────────────────────────────────────────────────────────────
  async getTrades(portfolioId?: string): Promise<Trade[]> {
    let query = supabase.from("trades").select("*").order("date", { ascending: false });
    if (portfolioId) query = query.eq("portfolio_id", portfolioId);
    const { data, error } = await query;
    if (error) { console.error("[supabase] getTrades:", error.message); return []; }
    return (data ?? []).map(this.mapTrade);
  }

  async createTrade(t: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const row = {
      id,
      portfolio_id: t.portfolioId,
      date: t.date,
      action: t.action,
      ticker: t.ticker,
      name: t.name ?? "",
      shares: t.shares,
      price: t.price,
      total: t.total,
      pnl: t.pnl ?? null,
      rationale: t.rationale ?? null,
    };
    const { data, error } = await supabase.from("trades").insert(row).select().single();
    if (error) throw new Error(error.message);

    // Update portfolio cash balance
    if (t.portfolioId) {
      const { data: meta } = await supabase
        .from("portfolio_meta")
        .select("cash")
        .eq("portfolio_id", t.portfolioId)
        .single();
      if (meta) {
        const total = t.total ?? (t.shares * t.price);
        const newCash = t.action === "SELL"
          ? Number(meta.cash) + total
          : Math.max(0, Number(meta.cash) - total);
        await supabase
          .from("portfolio_meta")
          .update({ cash: newCash })
          .eq("portfolio_id", t.portfolioId);
      }
    }

    return this.mapTrade(data);
  }

  // ── CHAT MESSAGES ─────────────────────────────────────────────────────────────
  async getChatMessages(portfolioId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .order("timestamp");
    if (error) return [];
    return (data ?? []).map(this.mapChat);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        id,
        portfolio_id: msg.portfolioId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return this.mapChat(data);
  }

  async clearChatMessages(portfolioId: string): Promise<void> {
    await supabase.from("chat_messages").delete().eq("portfolio_id", portfolioId);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────────
  async getPortfolioSummary(portfolioId?: string) {
    const allHoldings = await this.getHoldings(portfolioId);

    // Fetch live quotes so summary reflects real-time prices
    let liveQuotes: any[] = [];
    if (allHoldings.length > 0) {
      try {
        const { getFMPQuote } = await import("./fmp.js");
        const tickers = allHoldings.map(h => h.ticker).join(",");
        const raw = await getFMPQuote(tickers);
        liveQuotes = Array.isArray(raw) ? raw : [];
      } catch { /* FMP unavailable — use stored values */ }
    }

    // Update holdings with live data
    let holdingsValue = 0;
    let dayChange = 0;
    for (const h of allHoldings) {
      const q = liveQuotes.find((lq: any) => lq.symbol === h.ticker);
      if (q) {
        h.price = q.price ?? h.price;
        h.value = h.quantity * h.price;
        h.dayChange = (q.change ?? 0) * h.quantity;
        h.dayChangePct = q.changesPercentage ?? 0;
        h.gainLoss = h.value - h.costBasis;
        h.gainLossPct = h.costBasis > 0 ? (h.gainLoss / h.costBasis) * 100 : 0;
      }
      holdingsValue += h.value;
      dayChange += h.dayChange ?? 0;
    }

    const totalCostBasis = allHoldings.reduce((s, h) => s + h.costBasis, 0);

    let cash = 0;
    let startingCapital = 0;
    if (portfolioId) {
      const { data: meta } = await supabase
        .from("portfolio_meta")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .single();
      cash = meta ? Number(meta.cash) : 0;
      startingCapital = meta ? Number(meta.starting_capital) : 0;
    }

    const totalValue = holdingsValue + cash;
    let totalGainLoss: number;
    let totalGainLossPct: number;

    if (startingCapital > 0) {
      totalGainLoss = totalValue - startingCapital;
      totalGainLossPct = (totalGainLoss / startingCapital) * 100;
    } else {
      totalGainLoss = holdingsValue - totalCostBasis;
      totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
    }

    const dayChangePct = totalValue > 0 ? (dayChange / totalValue) * 100 : 0;

    let bestPerformer: { ticker: string; gainLossPct: number } | null = null;
    let worstPerformer: { ticker: string; gainLossPct: number } | null = null;

    for (const h of allHoldings) {
      const pct = h.gainLossPct ?? 0;
      if (!bestPerformer || pct > bestPerformer.gainLossPct) {
        bestPerformer = { ticker: h.ticker, gainLossPct: pct };
      }
      if (!worstPerformer || pct < worstPerformer.gainLossPct) {
        worstPerformer = { ticker: h.ticker, gainLossPct: pct };
      }
    }

    return {
      totalValue,
      dayChange,
      dayChangePct,
      totalGainLoss,
      totalGainLossPct,
      holdingsCount: allHoldings.length,
      totalCostBasis,
      cash,
      bestPerformer,
      worstPerformer,
    };
  }

  // ── MAPPERS ────────────────────────────────────────────────────────────────────
  private mapPortfolio(r: any): Portfolio {
    return { id: r.id, name: r.name, type: r.type };
  }

  private mapHolding(r: any): Holding {
    return {
      id: r.id,
      portfolioId: r.portfolio_id,
      ticker: r.ticker,
      name: r.name,
      quantity: Number(r.quantity),
      costBasis: Number(r.cost_basis),
      price: Number(r.price),
      value: Number(r.value),
      dayChange: r.day_change !== null ? Number(r.day_change) : null,
      dayChangePct: r.day_change_pct !== null ? Number(r.day_change_pct) : null,
      gainLoss: r.gain_loss !== null ? Number(r.gain_loss) : null,
      gainLossPct: r.gain_loss_pct !== null ? Number(r.gain_loss_pct) : null,
      type: r.type,
      sector: r.sector ?? "Other",
      source: r.source ?? "manual",
    };
  }

  private mapTrade(r: any): Trade {
    return {
      id: r.id,
      portfolioId: r.portfolio_id,
      date: r.date,
      action: r.action,
      ticker: r.ticker,
      name: r.name,
      shares: Number(r.shares),
      price: Number(r.price),
      total: Number(r.total),
      pnl: r.pnl !== null ? Number(r.pnl) : null,
      rationale: r.rationale ?? null,
    };
  }

  private mapChat(r: any): ChatMessage {
    return {
      id: r.id,
      portfolioId: r.portfolio_id,
      role: r.role,
      content: r.content,
      timestamp: r.timestamp,
    };
  }

  // ── SCORE HISTORY ─────────────────────────────────────────────────────────────
  async saveScore(score: {
    ticker: string;
    compositeScore: number;
    financialHealth?: number;
    valuation?: number;
    growth?: number;
    technical?: number;
    sentiment?: number;
    macroFit?: number;
    quantSignals?: any;
    rating?: string;
    thesis?: string;
    risks?: string[];
    catalysts?: string[];
    factorNotes?: any;
    agiAlignment?: string;
    dataSource?: string;
  }) {
    const { error } = await supabase.from("score_history").insert({
      ticker: score.ticker,
      score_date: new Date().toISOString().split("T")[0],
      composite_score: score.compositeScore,
      financial_health: score.financialHealth,
      valuation: score.valuation,
      growth: score.growth,
      technical: score.technical,
      sentiment: score.sentiment,
      macro_fit: score.macroFit,
      quant_signals: score.quantSignals,
      rating: score.rating,
      thesis: score.thesis,
      risks: score.risks,
      catalysts: score.catalysts,
      factor_notes: score.factorNotes,
      agi_alignment: score.agiAlignment,
      data_source: score.dataSource,
    });
    if (error) console.error("[supabase] saveScore:", error.message);
  }

  async getScoreHistory(ticker?: string): Promise<any[]> {
    let query = supabase
      .from("score_history")
      .select("*")
      .order("score_date", { ascending: false });
    if (ticker) query = query.eq("ticker", ticker.toUpperCase());
    const { data } = await query.limit(50);
    return data ?? [];
  }
}
