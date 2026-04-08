import {
  type Portfolio, type InsertPortfolio,
  type Holding, type InsertHolding,
  type Trade, type InsertTrade,
  type ChatMessage, type InsertChatMessage,
} from "@shared/schema";
import { DatabaseStorage } from "./db";
import { randomUUID } from "crypto";

export interface IStorage {
  getPortfolios(): Promise<Portfolio[]>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  deletePortfolio(id: string): Promise<boolean>;
  getHoldings(portfolioId?: string): Promise<Holding[]>;
  getHolding(id: string): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: string, holding: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: string): Promise<boolean>;
  getTrades(portfolioId?: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getChatMessages(portfolioId: string): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(portfolioId: string): Promise<void>;
  getPortfolioSummary(portfolioId?: string): Promise<{
    totalValue: number;
    dayChange: number;
    dayChangePct: number;
    totalGainLoss: number;
    totalGainLossPct: number;
    holdingsCount: number;
    totalCostBasis: number;
    cash: number;
    bestPerformer: { ticker: string; gainLossPct: number } | null;
    worstPerformer: { ticker: string; gainLossPct: number } | null;
  }>;
}

export class MemStorage implements IStorage {
  private portfolios: Map<string, Portfolio>;
  private holdings: Map<string, Holding>;
  private trades: Map<string, Trade>;
  private chatMessages: Map<string, ChatMessage>;
  public portfolioMeta: Map<string, { cash: number; startingCapital: number }>;

  constructor() {
    this.portfolios = new Map();
    this.holdings = new Map();
    this.trades = new Map();
    this.chatMessages = new Map();
    this.portfolioMeta = new Map();
    this.seedData();
  }

  private seedData() {
    // Empty state — real data comes from Supabase
    const defaultId = randomUUID();
    this.portfolios.set(defaultId, { id: defaultId, name: "MAPO Portfolio", type: "custom" });
    this.portfolioMeta.set(defaultId, { cash: 0, startingCapital: 0 });
  }

  async getPortfolios(): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values());
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    return this.portfolios.get(id);
  }

  async createPortfolio(insertPortfolio: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const portfolio: Portfolio = { id, ...insertPortfolio };
    this.portfolios.set(id, portfolio);
    return portfolio;
  }

  async deletePortfolio(id: string): Promise<boolean> {
    const deleted = this.portfolios.delete(id);
    if (deleted) {
      const toDelete: string[] = [];
      this.holdings.forEach((h, hId) => {
        if (h.portfolioId === id) toDelete.push(hId);
      });
      toDelete.forEach((hId) => this.holdings.delete(hId));
      // Also delete trades
      const tradesToDelete: string[] = [];
      this.trades.forEach((t, tId) => {
        if (t.portfolioId === id) tradesToDelete.push(tId);
      });
      tradesToDelete.forEach((tId) => this.trades.delete(tId));
      // Also delete chat messages
      const chatToDelete: string[] = [];
      this.chatMessages.forEach((m, mId) => {
        if (m.portfolioId === id) chatToDelete.push(mId);
      });
      chatToDelete.forEach((mId) => this.chatMessages.delete(mId));
    }
    return deleted;
  }

  async getHoldings(portfolioId?: string): Promise<Holding[]> {
    const all = Array.from(this.holdings.values());
    if (portfolioId) return all.filter((h) => h.portfolioId === portfolioId);
    return all;
  }

  async getHolding(id: string): Promise<Holding | undefined> {
    return this.holdings.get(id);
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const id = randomUUID();
    const holding: Holding = {
      id,
      ...insertHolding,
      dayChange: insertHolding.dayChange ?? 0,
      dayChangePct: insertHolding.dayChangePct ?? 0,
      gainLoss: insertHolding.gainLoss ?? 0,
      gainLossPct: insertHolding.gainLossPct ?? 0,
      sector: insertHolding.sector ?? "Other",
      source: insertHolding.source ?? "manual",
    };
    this.holdings.set(id, holding);
    return holding;
  }

  async updateHolding(id: string, updates: Partial<InsertHolding>): Promise<Holding | undefined> {
    const existing = this.holdings.get(id);
    if (!existing) return undefined;
    const updated: Holding = { ...existing, ...updates, id };
    this.holdings.set(id, updated);
    return updated;
  }

  async deleteHolding(id: string): Promise<boolean> {
    return this.holdings.delete(id);
  }

  async getTrades(portfolioId?: string): Promise<Trade[]> {
    const all = Array.from(this.trades.values());
    if (portfolioId) return all.filter((t) => t.portfolioId === portfolioId);
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const trade: Trade = {
      id,
      ...insertTrade,
      pnl: insertTrade.pnl ?? null,
      rationale: insertTrade.rationale ?? null,
    };
    this.trades.set(id, trade);

    // Update portfolio cash balance when a trade is logged
    if (insertTrade.portfolioId) {
      const meta = this.portfolioMeta.get(insertTrade.portfolioId);
      if (meta) {
        const total = insertTrade.total ?? (insertTrade.shares * insertTrade.price);
        if (insertTrade.action === "SELL") {
          meta.cash += total;
        } else if (insertTrade.action === "BUY") {
          meta.cash = Math.max(0, meta.cash - total);
        }
        this.portfolioMeta.set(insertTrade.portfolioId, meta);
      }
    }

    return trade;
  }

  async getChatMessages(portfolioId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter((m) => m.portfolioId === portfolioId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { id, ...msg };
    this.chatMessages.set(id, message);
    return message;
  }

  async clearChatMessages(portfolioId: string): Promise<void> {
    const toDelete: string[] = [];
    this.chatMessages.forEach((m, mId) => {
      if (m.portfolioId === portfolioId) toDelete.push(mId);
    });
    toDelete.forEach((mId) => this.chatMessages.delete(mId));
  }

  async getPortfolioSummary(portfolioId?: string) {
    let allHoldings = Array.from(this.holdings.values());
    if (portfolioId) allHoldings = allHoldings.filter((h) => h.portfolioId === portfolioId);

    // Fetch live quotes so summary reflects real-time prices
    let liveQuotes: any[] = [];
    if (allHoldings.length > 0) {
      try {
        const { getFMPQuote } = await import("./lib/fmp.js");
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

    const totalCostBasis = allHoldings.reduce((sum, h) => sum + h.costBasis, 0);

    // Include cash for portfolios that have it
    const meta = portfolioId ? this.portfolioMeta.get(portfolioId) : null;
    const cash = meta?.cash ?? 0;
    const startingCapital = meta?.startingCapital ?? 0;
    const totalValue = holdingsValue + cash;

    // For portfolios with trades/starting capital, compute real total P/L
    let totalGainLoss: number;
    let totalGainLossPct: number;
    if (startingCapital > 0) {
      // Real P/L = current total (holdings + cash) - starting capital
      totalGainLoss = totalValue - startingCapital;
      totalGainLossPct = (totalGainLoss / startingCapital) * 100;
    } else {
      // Fallback for brokerage portfolios (no starting capital known)
      totalGainLoss = allHoldings.reduce((sum, h) => sum + (h.gainLoss ?? 0), 0);
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
}

import { SupabaseStorage } from "./lib/supabaseStorage.js";
import { isSupabaseEnabled } from "./lib/supabase.js";

function createStorage(): IStorage {
  if (isSupabaseEnabled) {
    console.log("[storage] Using Supabase persistent storage");
    return new SupabaseStorage() as unknown as IStorage;
  }
  if (process.env.DATABASE_URL) {
    console.log("[storage] Using PostgreSQL database storage");
    return new DatabaseStorage();
  }
  console.log("[storage] Using in-memory storage (no DATABASE_URL set)");
  return new MemStorage();
}

export const storage = createStorage();
