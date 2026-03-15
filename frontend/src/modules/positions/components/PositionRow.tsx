import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../shared/api'
import { ConfidenceBar } from './ConfidenceBar'
import { EditDisplaySaveModal } from '@/components/ui/edit-display-save-modal'
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
    'inline-flex shrink-0 items-center whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 cursor-pointer'
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
              Key takeaways
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {pairJournal.summarisedKnowledge ||
                'The agent needs more trades to form a view.'}
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-400">
              Journal entries (price check every interval)
            </p>
            <ul className="space-y-3">
              {pairJournal.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        entry.action === 'ENTER'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : entry.action === 'OBSERVE'
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {entry.action}
                    </span>
                    <span className="text-xs text-zinc-400">Cycle #{entry.cycleNum}</span>
                    <span className="text-xs text-zinc-400">{formatDate(entry.createdAt)}</span>
                    {entry.outcome?.pnl != null && entry.outcome?.closeReason != null && (
                      <span
                        className={`text-xs font-medium ${entry.outcome.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {entry.outcome.pnl >= 0 ? '+' : ''}
                        {entry.outcome.pnl.toFixed(2)}% ({entry.outcome.closeReason})
                      </span>
                    )}
                    {entry.outcome?.price != null && (
                      <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
                        Price: {entry.outcome.price.toLocaleString()}
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
  const [instructionModalOpen, setInstructionModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const pause = useMutation({ mutationFn: () => api.positions.pause(position.id), onSuccess: invalidate })
  const resume = useMutation({ mutationFn: () => api.positions.resume(position.id), onSuccess: invalidate })
  const switchMode = useMutation({
    mutationFn: (mode: 'PAPER' | 'LIVE') => api.positions.switchMode(position.id, mode),
    onSuccess: invalidate,
  })
  const updateInstruction = useMutation({
    mutationFn: (instruction: string) => api.positions.updateInstruction(position.id, instruction),
    onSuccess: (data) => {
      qc.setQueryData<Position[]>(['positions'], (old) =>
        old?.map((p) => (p.id === position.id ? { ...p, instruction: data.instruction } : p)) ?? []
      )
    },
  })
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
  const exitOutcomes = pairJournal?.entries.filter((e) => e.action === 'EXIT' && e.outcome) ?? []
  const totalRealizedPnl = exitOutcomes.reduce((sum, e) => sum + (e.outcome!.pnl ?? 0), 0)
  const hasCompletedTrade = exitOutcomes.length > 0
  const showPnl =
    isOpen ||
    isClosed ||
    (isPaused && (position.entryPrice != null || hasCompletedTrade)) ||
    (isWatching && hasCompletedTrade)
  const displayPnl = isOpen ? totalRealizedPnl + position.pnl : totalRealizedPnl || position.pnl || 0
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
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[position.status]}`} />
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
            {pairJournal != null && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                  pairJournal.confidence >= 70
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                    : pairJournal.confidence >= 40
                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}
                title="Agent confidence"
              >
                {pairJournal.confidence.toFixed(0)}%
              </span>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <span
            className={`text-xs font-medium ${position.direction === 'LONG' ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {position.direction}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${statusStyle}`}>{statusText}</span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                position.mode === 'LIVE'
                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {position.mode === 'LIVE' ? 'Live' : 'Paper'}
            </span>
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          {(position.amount ?? 0) > 0 ? (
            <>
              {(() => {
                // When agent closed (PROFIT_TARGET/DRAWDOWN_LIMIT), backend stores amount as final value; derive original to show "invested ± gained/lost"
                const amt = position.amount ?? 0
                const pct = displayPnl
                const amountWasUpdated =
                  (isClosed || isPaused) && !!position.closeReason
                const invested =
                  showPnl && pct !== 0 && amountWasUpdated ? amt / (1 + pct / 100) : amt
                const gainedLost = showPnl ? (invested * pct) / 100 : 0
                return (
                  <>
                    ${invested.toFixed(0)}
                    {showPnl && (
                      <span className={`ml-1.5 ${gainedLost >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {gainedLost >= 0 ? '+' : '-'}${Math.abs(gainedLost).toFixed(2)}
                      </span>
                    )}
                  </>
                )
              })()}
            </>
          ) : (
            '—'
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums">
          {showPnl ? (
            <span className={displayPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
              {displayPnl >= 0 ? '+' : ''}
              {displayPnl.toFixed(2)}%
            </span>
          ) : (
            <span className="text-zinc-300 dark:text-zinc-600">—</span>
          )}
        </td>
        <td className="whitespace-nowrap py-3 pl-3 pr-4">
          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5">
            {hasJournal && (
              <Btn onClick={() => setModalOpen(true)} variant="ghost">
                Journal
              </Btn>
            )}
            {(isWatching || isOpen) && (
              <Btn onClick={() => setInstructionModalOpen(true)} variant="ghost">
                {(position.instruction ?? '').trim() ? 'Edit instruction' : 'Instruction'}
              </Btn>
            )}
            {(isWatching || isOpen) && (
              <>
                {position.mode === 'PAPER' ? (
                  <button
                    onClick={() => window.confirm(`Switch ${position.pair} to LIVE trading? Real funds will be used.`) && switchMode.mutate('LIVE')}
                    disabled={switchMode.isPending}
                    title={
                      pairJournal && pairJournal.confidence >= 70
                        ? `Agent confidence is ${pairJournal.confidence.toFixed(0)}% — ready for live trading`
                        : 'Switch to live trading'
                    }
                    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 cursor-pointer ${
                      pairJournal && pairJournal.confidence >= 70
                        ? 'border border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 shadow-[0_0_6px_1px_rgba(251,191,36,0.35)]'
                        : 'border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {switchMode.isPending ? '…' : pairJournal && pairJournal.confidence >= 70 ? '★ Go live' : 'Go live'}
                  </button>
                ) : (
                  <Btn
                    onClick={() => switchMode.mutate('PAPER')}
                    disabled={switchMode.isPending}
                    variant="ghost"
                  >
                    {switchMode.isPending ? '…' : 'Paper'}
                  </Btn>
                )}
                <Btn onClick={() => pause.mutate()} disabled={pause.isPending}>
                  {pause.isPending ? '…' : 'Pause'}
                </Btn>
              </>
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
      {mounted &&
        instructionModalOpen && (
          <EditDisplaySaveModal
            title={`Instruction for ${position.pair}`}
            description="Tell the agent how to trade this pair (e.g. “prefer longer holds”, “exit quickly on any profit”)."
            value={position.instruction ?? ''}
            placeholder="e.g. Be conservative, only enter on strong momentum"
            onSave={async (v) => {
              try {
                await updateInstruction.mutateAsync(v)
                setInstructionModalOpen(false)
              } catch {
                // stay open on error
              }
            }}
            onClose={() => setInstructionModalOpen(false)}
            isPending={updateInstruction.isPending}
          />
        )}
    </>
  )
}
