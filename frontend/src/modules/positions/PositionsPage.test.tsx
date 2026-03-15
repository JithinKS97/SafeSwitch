import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionsPage } from './PositionsPage'
import type { Position } from '../shared/api'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) =>
    <a href={to} {...props}>{children}</a>,
}))

const mockList = vi.fn()

vi.mock('../shared/api', () => ({
  api: {
    positions: { list: (...args: unknown[]) => mockList(...args) },
    pairJournals: { list: () => Promise.resolve([]) },
    agent: {
      status: () => Promise.resolve({ schedulerActive: false, nextRunAt: new Date().toISOString(), intervalMinutes: 15 }),
      instruction: () => Promise.resolve({ instruction: '' }),
    },
  },
}))

const basePosition: Position = {
  id: 'pos-1',
  pair: 'BTC/USDT',
  direction: 'LONG',
  riskAppetite: 'LOW',
  status: 'INACTIVE',
  mode: 'PAPER',
  confidence: 0,
  pnl: 0,
  entryPrice: null,
  currentPrice: null,
  createdAt: new Date().toISOString(),
  activatedAt: null,
  closedAt: null,
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PositionsPage />
    </QueryClientProvider>
  )
}

describe('PositionsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading state initially', () => {
    mockList.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows empty state when there are no positions', async () => {
    mockList.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No positions yet.')).toBeInTheDocument()
  })

  it('shows a position row when positions exist', async () => {
    mockList.mockResolvedValue([basePosition])
    renderPage()
    expect(await screen.findByText('BTC/USDT')).toBeInTheDocument()
  })

  it('shows the Positions heading', async () => {
    mockList.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Positions')).toBeInTheDocument()
  })

  it('shows the Suggest pairs link', async () => {
    mockList.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('+ Suggest pairs')).toBeInTheDocument()
  })
})
