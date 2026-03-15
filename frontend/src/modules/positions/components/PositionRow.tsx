import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { ConfidenceBar } from './ConfidenceBar'
import type { Position, PairJournal } from '../../shared/api'

// Human-readable status labels and styles
const STATUS_DOT: Record<string, string> = {
  INACTIVE: 'bg-amber-400',
  ACTIVE: 'bg-emerald-500 animate-pulse',
  COMPLETED: 'bg-blue-400',
  STOPPED: 'bg-zinc-400',
}

const STATUS_LABEL: Record<string, { text: string; style: string }> = {
  INACTIVE: { text: 'Watching', style: 'text-amber-500' },
  ACTIVE: { text: 'Open', style: 'text-emerald-500' },
  COMPLETED: { text: 'Closed', style: 'text-blue-400' },
  STOPPED: { text: 'Paused', style: 'text-zinc-400' },
}

function Btn({
  children,
  onClick,
  disabled,
  variant = 'ghost',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'ghost' | 'danger'
}) {
  const base =
    'inline-flex items-center rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 cursor-pointer'
  const styles = {
    ghost:
      'border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800',
    danger: 'border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PairJournalModal({
  pair,
  pairJournal,
  onClose,
}: {
  pair: string
  pairJournal: PairJournal
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Journal — {pair}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-500">Agent confidence</span>
            <ConfidenceBar value={pairJournal.confidence} />
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-amber-600 dark:text-amber-400">
              What the agent thinks it knows
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {pairJournal.summarisedKnowledge ||
                'The agent needs more trades to form a view.'}
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-400">
              Position changes
            </p>
            <ul className="space-y-3">
              {pairJournal.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${entry.action === 'ENTER' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                    >
                      {entry.action}
                    </span>
                    <span className="text-xs text-zinc-400">Cycle #{entry.cycleNum}</span>
                    <span className="text-xs text-zinc-400">{formatDate(entry.createdAt)}</span>
                    {entry.outcome && (
                      <span
                        className={`text-xs font-medium ${entry.outcome.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {entry.outcome.pnl >= 0 ? '+' : ''}
                        {entry.outcome.pnl.toFixed(2)}% ({entry.outcome.closeReason})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {entry.reasoning}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PositionRow({
  position,
  pairJournal,
}: {
  position: Position
  pairJournal: PairJournal | null
}) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const pause = useMutation({ mutationFn: () => api.positions.pause(position.id), onSuccess: invalidate })
  const resume = useMutation({ mutationFn: () => api.positions.resume(position.id), onSuccess: invalidate })
  const remove = useMutation({
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

  const isWatching = position.status === 'INACTIVE'
  const isOpen = position.status === 'ACTIVE'
  const isPaused = position.status === 'STOPPED'
  const isClosed = position.status === 'COMPLETED'
  const { text: statusText, style: statusStyle } = STATUS_LABEL[position.status] ?? {
    text: position.status,
    style: '',
  }

  const hasJournal = pairJournal && pairJournal.entries.length > 0

  return (
    <>
      <tr className="group border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
        <td className="w-8 py-3 pl-4" />
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[position.status]}`} />
            {hasJournal ? (
              <button
                onClick={() => setModalOpen(true)}
                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline underline-offset-2 text-left"
              >
                {position.pair}
              </button>
            ) : (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{position.pair}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          <span
            className={`text-xs font-medium ${position.direction === 'LONG' ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {position.direction}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className={`text-xs font-medium ${statusStyle}`}>{statusText}</span>
        </td>
        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          {(position.amount ?? 0) > 0 ? `$${position.amount.toFixed(0)}` : '—'}
        </td>
        <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
          {isOpen || isClosed ? (
            <span className={position.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
              {position.pnl >= 0 ? '+' : ''}
              {position.pnl.toFixed(2)}%
              {(position.amount ?? 0) > 0 && (
                <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                  ({position.pnl >= 0 ? '+' : ''}${((position.amount * position.pnl) / 100).toFixed(2)})
                </span>
              )}
            </span>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-600">—</span>
          )}
        </td>
        <td className="py-3 pl-3 pr-4">
          <div className="flex items-center justify-end gap-1.5">
            {hasJournal && (
              <Btn onClick={() => setModalOpen(true)} variant="ghost">
                Journal
              </Btn>
            )}
            {(isWatching || isOpen) && (
              <Btn onClick={() => pause.mutate()} disabled={pause.isPending}>
                {pause.isPending ? '…' : 'Pause'}
              </Btn>
            )}
            {(isPaused || isClosed) && (
              <Btn onClick={() => resume.mutate()} disabled={resume.isPending}>
                {resume.isPending ? '…' : isPaused ? 'Resume' : 'Watch again'}
              </Btn>
            )}
            <Btn
              variant="danger"
              onClick={() => window.confirm(`Delete ${position.pair}?`) && remove.mutate()}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Btn>
          </div>
        </td>
      </tr>
      {mounted &&
        modalOpen &&
        pairJournal &&
        createPortal(
          <PairJournalModal
            pair={position.pair}
            pairJournal={pairJournal}
            onClose={() => setModalOpen(false)}
          />,
          document.body,
        )}
    </>
  )
}
