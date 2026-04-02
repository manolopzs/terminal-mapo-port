export interface QuantSignalDetail {
  confirmed: boolean;
  [key: string]: any;
}

export interface QuantSignals {
  momentum: QuantSignalDetail & { return12m: number };
  goldenCross: QuantSignalDetail & { sma50: number; sma200: number };
  sue: QuantSignalDetail & { score: number; latestSurprisePct: number };
  revisions: QuantSignalDetail & { revisionPct: number };
  beta: { value: number; lowVol: boolean; highVol: boolean };
  valueFactor: QuantSignalDetail & { currentEvEbitda: number; avgEvEbitda: number };
  donchian: { position: number; valid: boolean; reject: boolean; high52w: number; low52w: number };
  compositeCount: number;
  signalSummary: string;
}

export interface FactorScore {
  base: number;
  adjusted: number;
  notes: string;
}

export interface AnalysisResult {
  ticker: string;
  profile: any;
  quantSignals: QuantSignals;
  scoring: {
    factors: Record<string, FactorScore>;
    compositeScore: number;
    rating: string;
    rejected: boolean;
    rejectReason?: string;
    bullCase: string;
    bearCase: string;
    recommendation: string;
    agiAlignment: number;
  };
  rejected: boolean;
  rejectReason?: string;
  timestamp: string;
}
