import { getStoredToken } from '#/lib/auth-client'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type RiskAppetite = 'LOW' | 'MEDIUM' | 'HIGH'
export type TradeDirection = 'LONG' | 'SHORT'
export type TradingMode = 'PAPER' | 'LIVE'
export type PositionStatus = 'INACTIVE' | 'ACTIVE' | 'COMPLETED' | 'STOPPED'

export type CloseReason = 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT' | 'MANUAL'

export type Position = {
  id: string
  pair: string
  direction: TradeDirection
  riskAppetite: RiskAppetite
  amount: number
  status: PositionStatus
  mode: TradingMode
  confidence: number
  pnl: number
  entryPrice: number | null
  currentPrice: number | null
  closeReason?: CloseReason | null
  instruction?: string
  createdAt: string
  activatedAt: string | null
  closedAt: string | null
}

export type Suggestion = {
  pair: string
  direction: TradeDirection
  duration: string
  reason: string
  riskLevel: RiskAppetite
}

export type SuggestionsResponse = {
  id?: string
  riskPct?: number
  analysis: string
  suggestions: Suggestion[]
  createdAt?: string
}

export type SnapshotSummary = {
  id: string
  riskPct: number
  analysis: string
  createdAt: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options?.headers as Record<string, string>),
    },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  positions: {
    list: () => request<Position[]>('/positions'),
    create: (pair: string, direction: TradeDirection, riskAppetite: RiskAppetite, amount: number) =>
      request<Position>('/positions', {
        method: 'POST',
        body: JSON.stringify({ pair, direction, riskAppetite, amount }),
      }),
    activate: (id: string) =>
      request<Position>(`/positions/${id}/activate`, { method: 'POST' }),
    switchMode: (id: string, mode: TradingMode) =>
      request<Position>(`/positions/${id}/mode`, {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      }),
    updateInstruction: (id: string, instruction: string) =>
      request<Position>(`/positions/${id}/instruction`, {
        method: 'PATCH',
        body: JSON.stringify({ instruction }),
      }),
    stop: (id: string) =>
      request<Position>(`/positions/${id}/stop`, { method: 'POST' }),
    pause: (id: string) =>
      request<Position>(`/positions/${id}/pause`, { method: 'POST' }),
    resume: (id: string) =>
      request<Position>(`/positions/${id}/resume`, { method: 'POST' }),
    reopen: (id: string) =>
      request<Position>(`/positions/${id}/resume`, { method: 'POST' }),
    delete: (id: string) =>
      request<void>(`/positions/${id}`, { method: 'DELETE' }),
  },
  suggestions: {
    generate: (riskPct: number) =>
      request<SuggestionsResponse>('/suggestions', {
        method: 'POST',
        body: JSON.stringify({ riskPct }),
      }),
    refresh: (id: string) =>
      request<SuggestionsResponse>(`/suggestions/${id}/refresh`, { method: 'POST' }),
    history: () => request<SnapshotSummary[]>('/suggestions'),
    getById: (id: string) => request<SuggestionsResponse>(`/suggestions/${id}`),
    delete: (id: string) => request<void>(`/suggestions/${id}`, { method: 'DELETE' }),
  },
  user: {
    clearAllData: () => request<void>('/user/data', { method: 'DELETE' }),
  },
  binanceKeys: {
    getStatus: () =>
      request<{ hasKeys: boolean; apiKeyMasked?: string }>('/binance-keys'),
    addOrUpdate: (apiKey: string, apiSecret: string) =>
      request<{ hasKeys: true; apiKeyMasked: string }>('/binance-keys', {
        method: 'PUT',
        body: JSON.stringify({ apiKey, apiSecret }),
      }),
    remove: () => request<void>('/binance-keys', { method: 'DELETE' }),
  },
  agent: {
    status: () => request<SchedulerStatus>('/agent/status'),
    instruction: () => request<{ instruction: string }>('/agent/instruction'),
    setInstruction: (instruction: string) =>
      request<{ instruction: string }>('/agent/instruction', {
        method: 'PATCH',
        body: JSON.stringify({ instruction }),
      }),
    setScheduler: (enabled: boolean) =>
      request<SchedulerStatus>('/agent/scheduler', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    run: () => request<CycleResult>('/agent/run', { method: 'POST' }),
  },
  pairJournals: {
    list: () => request<PairJournal[]>('/pair-journals'),
    byPair: (pair: string) =>
      request<PairJournal | null>(`/pair-journals/${encodeURIComponent(pair)}`),
  },
}

export type SchedulerStatus = {
  schedulerActive: boolean
  nextRunAt: string
  intervalMinutes: number
}

export type CycleResult = {
  cycleNum: number
  opened: string[]
  closed: string[]
  journal: string
}

export type PairJournalEntry = {
  id: string
  cycleNum: number
  action: string
  reasoning: string
  outcome: { pnl?: number; closeReason?: string; price?: number } | null
  createdAt: string
}

export type PairJournal = {
  id: string
  pair: string
  confidence: number
  summarisedKnowledge: string
  entries: PairJournalEntry[]
  updatedAt: string
}
