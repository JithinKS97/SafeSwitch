import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionRow } from './PositionRow'
import type { Position } from '../../shared/api'

const mockPause = vi.fn().mockResolvedValue({})
const mockResume = vi.fn().mockResolvedValue({})
const mockDelete = vi.fn().mockResolvedValue(undefined)

vi.mock('../../shared/api', () => ({
  api: {
    positions: {
      pause:  (...args: unknown[]) => mockPause(...args),
      resume: (...args: unknown[]) => mockResume(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

function renderRow(position: Position, pairJournal: { pair: string; confidence: number; entries: unknown[] } | null = null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <table><tbody>
        <PositionRow position={position} pairJournal={pairJournal} />
      </tbody></table>
    </QueryClientProvider>
  )
}

const base: Position = {
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

describe('PositionRow', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('INACTIVE position', () => {
    it('shows Pause and Instruction buttons', () => {
      renderRow(base)
      expect(screen.getByText('Pause')).toBeInTheDocument()
      expect(screen.getByText('Instruction')).toBeInTheDocument()
    })

    it('shows Delete button', () => {
      renderRow(base)
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('displays the pair name', () => {
      renderRow(base)
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    })

    it('displays LONG direction', () => {
      renderRow(base)
      expect(screen.getByText('LONG')).toBeInTheDocument()
    })
  })

  describe('ACTIVE PAPER position', () => {
    const active: Position = { ...base, status: 'ACTIVE', mode: 'PAPER', confidence: 55 }

    it('shows Pause and Delete buttons', () => {
      renderRow(active)
      expect(screen.getByText('Pause')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('STOPPED position', () => {
    const stopped: Position = { ...base, status: 'STOPPED' }

    it('shows Resume and Delete buttons', () => {
      renderRow(stopped)
      expect(screen.getByText('Resume')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls api.positions.delete after confirm', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderRow(stopped)
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('pos-1'))
    })

    it('does not call delete when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderRow(stopped)
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => expect(mockDelete).not.toHaveBeenCalled())
    })
  })

  describe('COMPLETED position', () => {
    const completed: Position = { ...base, status: 'COMPLETED' }

    it('shows Delete button', () => {
      renderRow(completed)
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })
})
