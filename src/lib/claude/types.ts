export interface ScoringFactorDetail {
  base: number;
  adjusted: number;
  notes: string;
}

export interface ScoringResult {
  ticker: string;
  factors: Record<string, ScoringFactorDetail>;
  compositeScore: number;
  rating: string;
  rejected: boolean;
  rejectReason?: string;
  bullCase: string;
  bearCase: string;
  recommendation: string;
  agiAlignment: number;
}

export type MacroRegime = "RISK_ON" | "RISK_OFF" | "NEUTRAL";

export interface BriefingOutput {
  regime: MacroRegime;
  keyEvents: string[];
  holdingsStatus: string;
  alerts: string[];
  agiThesisPulse: string;
  actionRequired: string;
}

export interface RebalanceOutput {
  macroAssessment: string;
  sectorPositioning: Record<string, string>;
  recommendedPortfolio: Array<{
    ticker: string;
    targetWeight: number;
    rationale: string;
  }>;
  changes: Array<{
    ticker: string;
    action: "BUY" | "SELL" | "TRIM" | "HOLD";
    notes: string;
  }>;
  validationChecklist: string[];
  riskAssessment: string;
}

export type ThesisStatus = "ACCELERATING" | "STABLE" | "DECELERATING";

export interface SituationalAwarenessOutput {
  status: ThesisStatus;
  confidenceLevel: number;
  keyDevelopments: string[];
  capexTracker: string;
  implicationsForPortfolio: string;
}
