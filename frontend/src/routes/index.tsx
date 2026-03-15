import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Position, TradingMode } from '../lib/api'

export const Route = createFileRoute('/')({ component: PositionsPage })

const STATUS_STYLE: Record<string, string> = {
  INACTIVE: 'bg-[var(--line)] text-[var(--sea-ink-soft)]',
  ACTIVE: 'bg-[rgba(79,184,178,0.18)] text-[var(--lagoon-deep)]',
  COMPLETED: 'bg-[rgba(47,106,74,0.14)] text-[var(--palm)]',
  STOPPED: 'bg-[rgba(200,80,80,0.12)] text-red-600',
}

const DIRECTION_STYLE: Record<string, string> = {
  LONG: 'text-[var(--palm)]',
  SHORT: 'text-red-500',
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-[var(--lagoon)]' : value >= 40 ? 'bg-yellow-400' : 'bg-[var(--line)]'
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

function PositionCard({ position }: { position: Position }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const activate = useMutation({ mutationFn: () => api.positions.activate(position.id), onSuccess: invalidate })
  const stop = useMutation({ mutationFn: () => api.positions.stop(position.id), onSuccess: invalidate })
  const switchMode = useMutation({
    mutationFn: (mode: TradingMode) => api.positions.switchMode(position.id, mode),
    onSuccess: invalidate,
  })

  const isActive = position.status === 'ACTIVE'
  const isInactive = position.status === 'INACTIVE'

  return (
    <article className="island-shell rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--sea-ink)]">{position.pair}</span>
            <span className={`text-xs font-semibold ${DIRECTION_STYLE[position.direction]}`}>
              {position.direction}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--sea-ink-soft)]">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[position.status]}`}>
              {position.status}
            </span>
            {isActive && (
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs">
                {position.mode}
              </span>
            )}
            <span className="opacity-60">{position.riskAppetite} risk</span>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-semibold ${position.pnl >= 0 ? 'text-[var(--palm)]' : 'text-red-500'}`}>
            {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)} USDT
          </div>
          {isActive && (
            <div className="text-xs text-[var(--sea-ink-soft)]">
              {position.confidence.toFixed(0)}% confidence
            </div>
          )}
        </div>
      </div>

      {isActive && <ConfidenceBar value={position.confidence} />}

      <div className="mt-4 flex flex-wrap gap-2">
        {isInactive && (
          <button
            onClick={() => activate.mutate()}
            disabled={activate.isPending}
            className="rounded-full bg-[var(--lagoon)] px-4 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {activate.isPending ? 'Activating…' : 'Activate'}
          </button>
        )}
        {isActive && position.mode === 'PAPER' && (
          <button
            onClick={() => switchMode.mutate('LIVE')}
            disabled={switchMode.isPending}
            className="rounded-full bg-[var(--palm)] px-4 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            Switch to Live
          </button>
        )}
        {isActive && position.mode === 'LIVE' && (
          <button
            onClick={() => switchMode.mutate('PAPER')}
            disabled={switchMode.isPending}
            className="rounded-full border border-[var(--line)] px-4 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            Back to Paper
          </button>
        )}
        {isActive && (
          <button
            onClick={() => stop.mutate()}
            disabled={stop.isPending}
            className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-500 transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {stop.isPending ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>
    </article>
  )
}

function PositionsPage() {
  const { data: positions = [], isLoading, isError } = useQuery({
    queryKey: ['positions'],
    queryFn: api.positions.list,
    refetchInterval: 5000,
  })

  return (
    <main className="page-wrap px-4 pb-12 pt-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="island-kicker mb-1">Dashboard</p>
          <h1 className="display-title text-3xl font-bold text-[var(--sea-ink)]">Positions</h1>
        </div>
        <Link
          to="/suggest"
          className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5"
        >
          + Get Suggestions
        </Link>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-sm text-[var(--sea-ink-soft)]">Loading…</div>
      )}

      {isError && (
        <div className="island-shell rounded-2xl p-6 text-center text-sm text-red-500">
          Could not connect to backend. Make sure the server is running on port 3001.
        </div>
      )}

      {!isLoading && !isError && positions.length === 0 && (
        <div className="island-shell rounded-2xl p-12 text-center">
          <p className="text-[var(--sea-ink-soft)]">No positions yet.</p>
          <Link to="/suggest" className="mt-3 inline-block text-sm font-semibold">
            Get suggestions to add pairs →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((p) => <PositionCard key={p.id} position={p} />)}
      </div>
    </main>
  )
}
