const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  // window.Clerk is injected by ClerkProvider
  return (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } })
    .Clerk?.session?.getToken() ?? null
}

export type RiskAppetite = 'LOW' | 'MEDIUM' | 'HIGH'
export type TradeDirection = 'LONG' | 'SHORT'
export type TradingMode = 'PAPER' | 'LIVE'
export type PositionStatus = 'INACTIVE' | 'ACTIVE' | 'COMPLETED' | 'STOPPED'

export type Position = {
  id: string
  pair: string
  direction: TradeDirection
  riskAppetite: RiskAppetite
  status: PositionStatus
  mode: TradingMode
  confidence: number
  pnl: number
  entryPrice: number | null
  currentPrice: number | null
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
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  positions: {
    list: () => request<Position[]>('/positions'),
    create: (pair: string, direction: TradeDirection, riskAppetite: RiskAppetite) =>
      request<Position>('/positions', {
        method: 'POST',
        body: JSON.stringify({ pair, direction, riskAppetite }),
      }),
    activate: (id: string) =>
      request<Position>(`/positions/${id}/activate`, { method: 'POST' }),
    switchMode: (id: string, mode: TradingMode) =>
      request<Position>(`/positions/${id}/mode`, {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      }),
    stop: (id: string) =>
      request<Position>(`/positions/${id}/stop`, { method: 'POST' }),
    delete: (id: string) =>
      request<void>(`/positions/${id}`, { method: 'DELETE' }),
  },
  suggestions: {
    generate: (riskPct: number) =>
      request<SuggestionsResponse>('/suggestions', {
        method: 'POST',
        body: JSON.stringify({ riskPct }),
      }),
    history: () => request<SnapshotSummary[]>('/suggestions'),
    getById: (id: string) => request<SuggestionsResponse>(`/suggestions/${id}`),
  },
}
