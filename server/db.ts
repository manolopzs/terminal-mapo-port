import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import { portfolios, holdings, trades, chatMessages } from "@shared/schema";
import type { IStorage } from "./storage";
import type {
  Portfolio, InsertPortfolio,
  Holding, InsertHolding,
  Trade, InsertTrade,
  ChatMessage, InsertChatMessage,
} from "@shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export class DatabaseStorage implements IStorage {
  async getPortfolios(): Promise<Portfolio[]> {
    return db.select().from(portfolios);
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const rows = await db.select().from(portfolios).where(eq(portfolios.id, id));
    return rows[0];
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const rows = await db.insert(portfolios).values(portfolio).returning();
    return rows[0];
  }

  async deletePortfolio(id: string): Promise<boolean> {
    // cascade-delete related records first
    await db.delete(chatMessages).where(eq(chatMessages.portfolioId, id));
    await db.delete(trades).where(eq(trades.portfolioId, id));
    await db.delete(holdings).where(eq(holdings.portfolioId, id));
    const rows = await db.delete(portfolios).where(eq(portfolios.id, id)).returning();
    return rows.length > 0;
  }

  async getHoldings(portfolioId?: string): Promise<Holding[]> {
    if (portfolioId) {
      return db.select().from(holdings).where(eq(holdings.portfolioId, portfolioId));
    }
    return db.select().from(holdings);
  }

  async getHolding(id: string): Promise<Holding | undefined> {
    const rows = await db.select().from(holdings).where(eq(holdings.id, id));
    return rows[0];
  }

  async createHolding(holding: InsertHolding): Promise<Holding> {
    const rows = await db.insert(holdings).values(holding).returning();
    return rows[0];
  }

  async updateHolding(id: string, updates: Partial<InsertHolding>): Promise<Holding | undefined> {
    const rows = await db.update(holdings).set(updates).where(eq(holdings.id, id)).returning();
    return rows[0];
  }

  async deleteHolding(id: string): Promise<boolean> {
    const rows = await db.delete(holdings).where(eq(holdings.id, id)).returning();
    return rows.length > 0;
  }

  async getTrades(portfolioId?: string): Promise<Trade[]> {
    if (portfolioId) {
      return db.select().from(trades).where(eq(trades.portfolioId, portfolioId)).orderBy(desc(trades.date));
    }
    return db.select().from(trades).orderBy(desc(trades.date));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const rows = await db.insert(trades).values(trade).returning();
    return rows[0];
  }

  async getChatMessages(portfolioId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.portfolioId, portfolioId)).orderBy(chatMessages.timestamp);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const rows = await db.insert(chatMessages).values(msg).returning();
    return rows[0];
  }

  async clearChatMessages(portfolioId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.portfolioId, portfolioId));
  }

  async getPortfolioSummary(portfolioId?: string) {
    const allHoldings = await this.getHoldings(portfolioId);
    const holdingsValue = allHoldings.reduce((sum, h) => sum + h.value, 0);
    const totalCostBasis = allHoldings.reduce((sum, h) => sum + h.costBasis, 0);
    const dayChange = allHoldings.reduce((sum, h) => sum + (h.dayChange ?? 0), 0);
    const totalValue = holdingsValue;

    const totalGainLoss = allHoldings.reduce((sum, h) => sum + (h.gainLoss ?? 0), 0);
    const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
    const dayChangePct = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

    let bestPerformer: { ticker: string; gainLossPct: number } | null = null;
    let worstPerformer: { ticker: string; gainLossPct: number } | null = null;

    for (const h of allHoldings) {
      const pct = h.gainLossPct ?? 0;
      if (!bestPerformer || pct > bestPerformer.gainLossPct) bestPerformer = { ticker: h.ticker, gainLossPct: pct };
      if (!worstPerformer || pct < worstPerformer.gainLossPct) worstPerformer = { ticker: h.ticker, gainLossPct: pct };
    }

    return {
      totalValue,
      dayChange,
      dayChangePct,
      totalGainLoss,
      totalGainLossPct,
      holdingsCount: allHoldings.length,
      totalCostBasis,
      cash: 0,
      bestPerformer,
      worstPerformer,
    };
  }
}
