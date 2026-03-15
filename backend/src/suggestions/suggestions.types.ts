import type { RiskAppetite, TradeDirection } from '../common/types/enums';

export type Suggestion = {
  pair: string;
  direction: TradeDirection;
  duration: string;
  reason: string;
  riskLevel: RiskAppetite;
};

export type SuggestionsResponse = {
  id?: string;
  riskPct?: number;
  analysis: string;
  suggestions: Suggestion[];
  createdAt?: string;
};

export type SnapshotSummary = {
  id: string;
  riskPct: number;
  analysis: string;
  createdAt: string;
};
