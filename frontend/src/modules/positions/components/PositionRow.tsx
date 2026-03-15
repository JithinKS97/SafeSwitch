import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import type { Position, TradingMode } from '../../shared/api'
import { ConfidenceBar } from './ConfidenceBar'

const STATUS_DOT: Record<string, string> = {
  INACTIVE:  'bg-zinc-400',
  ACTIVE:    'bg-emerald-500 animate-pulse',
  COMPLETED: 'bg-blue-400',
  STOPPED:   'bg-red-400',
}

const STATUS_LABEL: Record<string, string> = {
  INACTIVE:  'text-zinc-400',
  ACTIVE:    'text-emerald-500',
  COMPLETED: 'text-blue-400',
  STOPPED:   'text-red-400',
}

function Btn({ children, onClick, disabled, variant = 'ghost' }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'ghost' | 'primary' | 'danger'
}) {
  const base = 'inline-flex items-center rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 cursor-pointer'
  const styles = {
    ghost:   'border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
    primary: 'bg-zinc-900 text-white hover:bg-zinc-700',
    danger:  'border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950',
  }
  return <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>{children}</button>
}

export function PositionRow({ position }: { position: Position }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const activate   = useMutation({ mutationFn: () => api.positions.activate(position.id), onSuccess: invalidate })
  const stop       = useMutation({ mutationFn: () => api.positions.stop(position.id), onSuccess: invalidate })
  const switchMode = useMutation({ mutationFn: (m: TradingMode) => api.positions.switchMode(position.id, m), onSuccess: invalidate })
  const remove     = useMutation({
    mutationFn: () => api.positions.delete(position.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['positions'] })
      const prev = qc.getQueryData<Position[]>(['positions'])
      qc.setQueryData<Position[]>(['positions'], (old) => old?.filter((p) => p.id !== position.id) ?? [])
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['positions'], ctx.prev)
    },
    onSettled: invalidate,
  })

  const isActive   = position.status === 'ACTIVE'
  const isInactive = position.status === 'INACTIVE'
  const isDone     = position.status === 'STOPPED' || position.status === 'COMPLETED'

  return (
    <tr className="group border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[position.status]}`} />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{position.pair}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs font-medium ${position.direction === 'LONG' ? 'text-emerald-600' : 'text-red-500'}`}>
          {position.direction}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs ${STATUS_LABEL[position.status]}`}>{position.status}</span>
        {isActive && (
          <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
            {position.mode}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        {isActive ? <ConfidenceBar value={position.confidence} /> : <span className="text-xs text-zinc-300">—</span>}
      </td>
      <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
        <span className={position.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
          {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}
        </span>
      </td>
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center justify-end gap-1.5">
          {isInactive && (
            <Btn variant="primary" onClick={() => activate.mutate()} disabled={activate.isPending}>
              {activate.isPending ? 'Starting…' : 'Activate'}
            </Btn>
          )}
          {isActive && position.mode === 'PAPER' && (
            <Btn variant="primary" onClick={() => switchMode.mutate('LIVE')} disabled={switchMode.isPending}>
              → Live
            </Btn>
          )}
          {isActive && position.mode === 'LIVE' && (
            <Btn variant="ghost" onClick={() => switchMode.mutate('PAPER')} disabled={switchMode.isPending}>
              ← Paper
            </Btn>
          )}
          {isActive && (
            <Btn variant="danger" onClick={() => stop.mutate()} disabled={stop.isPending}>
              {stop.isPending ? '…' : 'Stop'}
            </Btn>
          )}
          {isDone && (
            <Btn
              variant="danger"
              onClick={() => window.confirm(`Delete ${position.pair}?`) && remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Btn>
          )}
        </div>
      </td>
    </tr>
  )
}
