import { useQuery } from "@tanstack/react-query";

export interface RebalancePosition {
  ticker: string;
  name: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  diffPct: number;       // currentPct - targetPct
  action: "BUY" | "SELL" | "HOLD";
  actionAmount: number;  // dollar amount to buy or sell
  shares: number;        // estimated shares to buy/sell
  currentPrice: number;
}

export interface ValidationCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
}

export interface MacroResult {
  regime: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  keyEvents: string[];
  sectorRanking?: Array<{ sector: string; change: number }>;
  agiThesisPulse?: string;
  timestamp?: string;
}

export interface AgiResult {
  status: "ACCELERATING" | "STABLE" | "DECELERATING";
  confidenceLevel: number;
  keyDevelopments?: string[];
  capexTracker?: string;
  implicationsForPortfolio?: string;
  timestamp?: string;
}

export interface RebalanceContext {
  validationStatus?: ValidationResult;
  macroRegime?: string;
  agiThesisStatus?: string;
  portfolioValue?: number;
  cash?: number;
  cashPct?: number;
  constraints?: Record<string, number>;
}

export interface RebalanceData {
  positions: RebalancePosition[];
  totalValue: number;
  cashValue: number;
  cashPct: number;
  targetCashPct: number;
  cashAction: "DEPLOY" | "RAISE" | "OK";
  cashActionAmount: number;
  maxDrawdownAlert: string | null;
  concentrationAlerts: string[];
  memo?: string;
  macro?: MacroResult | null;
  agi?: AgiResult | null;
  context?: RebalanceContext | null;
}

export function useRebalance(portfolioId: string) {
  return useQuery<RebalanceData>({
    queryKey: ["/api/rebalance", portfolioId],
    queryFn: async () => {
      const res = await fetch(`./api/rebalance?portfolioId=${portfolioId}`);
      if (!res.ok) throw new Error("Failed to fetch rebalance data");
      return res.json();
    },
    enabled: !!portfolioId,
    staleTime: 30_000,
  });
}
