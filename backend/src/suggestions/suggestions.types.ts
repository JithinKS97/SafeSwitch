import type { RiskAppetite, TradeDirection } from '../common/types/enums';

export type Suggestion = {
  pair: string;
  direction: TradeDirection;
  duration: string;
  reason: string;
  riskLevel: RiskAppetite;
};
