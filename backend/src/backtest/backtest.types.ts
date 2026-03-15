export type BacktestConfig = {
  /** Pairs to test, e.g. ['BTC/USDT', 'ETH/USDT'] */
  pairs: string[]
  /** How many days of history to test over (max 90) */
  daysBack: number
  /** Risk appetite determines entry score threshold */
  riskAppetite: 'LOW' | 'MEDIUM' | 'HIGH'
  /** Which direction to test. Defaults to 'BOTH' */
  direction?: 'LONG' | 'SHORT' | 'BOTH'
}

export type BacktestTrade = {
  pair: string
  direction: 'LONG' | 'SHORT'
  entryTime: string       // ISO
  exitTime: string | null // null = still open at end of data
  entryPrice: number
  exitPrice: number | null
  pnlPct: number | null
  closeReason: 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT' | 'END_OF_DATA'
  entrySignalScore: number
  entrySignalLabel: string
  entryRegime: 'trending' | 'ranging'
  entry4hTrend: string
}

export type LabelStats = {
  trades: number
  wins: number
  losses: number
  winRate: number
  avgPnl: number
}

export type BacktestPairResult = {
  pair: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number       // 0–1
  avgPnlPct: number
  totalPnlPct: number
  maxDrawdownPct: number
  /** Stats broken down by signal label at entry */
  byLabel: Record<string, LabelStats>
  /** Stats broken down by regime at entry */
  byRegime: Record<string, LabelStats>
  /** Stats broken down by score band: '58-65', '65-72', '72-80', '80+' */
  byScoreBand: Record<string, LabelStats>
  /** Individual trades (capped at 200 per pair) */
  trades: BacktestTrade[]
}

export type BacktestResult = {
  config: BacktestConfig
  durationMs: number
  pairs: BacktestPairResult[]
  /** Aggregated across all pairs */
  summary: {
    totalTrades: number
    winRate: number
    avgPnlPct: number
    bestLabel: string
    bestRegime: string
    /** Recommended thresholds based on results */
    suggestedThresholds: {
      enter: number
      profitTargetExitScore: number
      drawdownExitScore: number
    }
  }
}
