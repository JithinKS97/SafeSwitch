import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionRow } from './PositionRow'
import type { Position } from '../../shared/api'

vi.mock('../../shared/api', () => ({
  api: {
    positions: {
      activate:   vi.fn().mockResolvedValue({}),
      stop:       vi.fn().mockResolvedValue({}),
      switchMode: vi.fn().mockResolvedValue({}),
      delete:     vi.fn().mockResolvedValue(undefined),
    },
  },
}))

function renderRow(position: Position) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <table><tbody>
        <PositionRow position={position} />
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
    it('shows Activate button', () => {
      renderRow(base)
      expect(screen.getByText('Activate')).toBeInTheDocument()
    })

    it('does not show Stop or Delete', () => {
      renderRow(base)
      expect(screen.queryByText('Stop')).toBeNull()
      expect(screen.queryByText('Delete')).toBeNull()
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

    it('shows → Live and Stop buttons', () => {
      renderRow(active)
      expect(screen.getByText('→ Live')).toBeInTheDocument()
      expect(screen.getByText('Stop')).toBeInTheDocument()
    })

    it('does not show Activate or Delete', () => {
      renderRow(active)
      expect(screen.queryByText('Activate')).toBeNull()
      expect(screen.queryByText('Delete')).toBeNull()
    })
  })

  describe('ACTIVE LIVE position', () => {
    const live: Position = { ...base, status: 'ACTIVE', mode: 'LIVE', confidence: 80 }

    it('shows ← Paper and Stop buttons', () => {
      renderRow(live)
      expect(screen.getByText('← Paper')).toBeInTheDocument()
      expect(screen.getByText('Stop')).toBeInTheDocument()
    })

    it('does not show → Live', () => {
      renderRow(live)
      expect(screen.queryByText('→ Live')).toBeNull()
    })
  })

  describe('STOPPED position', () => {
    const stopped: Position = { ...base, status: 'STOPPED' }

    it('shows Delete button', () => {
      renderRow(stopped)
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('does not show Activate or Stop', () => {
      renderRow(stopped)
      expect(screen.queryByText('Activate')).toBeNull()
      expect(screen.queryByText('Stop')).toBeNull()
    })

    it('calls api.positions.delete after confirm', async () => {
      const { api } = await import('../../shared/api')
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderRow(stopped)
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => expect(api.positions.delete).toHaveBeenCalledWith('pos-1'))
    })

    it('does not call delete when confirm is cancelled', async () => {
      const { api } = await import('../../shared/api')
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderRow(stopped)
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => expect(api.positions.delete).not.toHaveBeenCalled())
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
