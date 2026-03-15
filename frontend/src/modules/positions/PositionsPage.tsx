import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../shared/api'
import { PositionRow } from './components/PositionRow'
import { BinanceKeysModal } from './components/BinanceKeysModal'
import { EditDisplaySaveModal } from '@/components/ui/edit-display-save-modal'
import type { SchedulerStatus } from '../shared/api'

function formatTimeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'in a moment'
  if (mins === 1) return 'in 1 min'
  return `in ${mins} min`
}

export function PositionsPage() {
  const qc = useQueryClient()

  const { data: positions = [], isLoading, isError } = useQuery({
    queryKey: ['positions'],
    queryFn: api.positions.list,
    refetchInterval: 5000,
  })

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['agent', 'status'],
    queryFn: api.agent.status,
    refetchInterval: 30_000,
  })

  const { data: pairJournals = [] } = useQuery({
    queryKey: ['pairJournals'],
    queryFn: api.pairJournals.list,
    refetchInterval: status?.intervalMinutes
      ? status.intervalMinutes * 60 * 1000
      : 60_000,
  })

  const { data: instructionData } = useQuery({
    queryKey: ['agent', 'instruction'],
    queryFn: api.agent.instruction,
  })

  const { data: binanceKeysStatus } = useQuery({
    queryKey: ['binanceKeys'],
    queryFn: api.binanceKeys.getStatus,
  })

  const [instructionModalOpen, setInstructionModalOpen] = useState(false)
  const [binanceKeysModalOpen, setBinanceKeysModalOpen] = useState(false)

  const setInstruction = useMutation({
    mutationFn: (instruction: string) => api.agent.setInstruction(instruction),
  })

  const addBinanceKeys = useMutation({
    mutationFn: ({ apiKey, apiSecret }: { apiKey: string; apiSecret: string }) =>
      api.binanceKeys.addOrUpdate(apiKey, apiSecret),
    onSuccess: (data) => {
      qc.setQueryData(['binanceKeys'], data)
      setBinanceKeysModalOpen(false)
      toast.success('Binance API keys saved')
    },
    onError: (e) => toast.error(e.message),
  })

  const removeBinanceKeys = useMutation({
    mutationFn: () => api.binanceKeys.remove(),
    onSuccess: () => {
      qc.setQueryData(['binanceKeys'], { hasKeys: false })
      setBinanceKeysModalOpen(false)
      toast.success('Binance API keys removed')
    },
    onError: (e) => toast.error(e.message),
  })

  const setScheduler = useMutation({
    mutationFn: (enabled: boolean) => api.agent.setScheduler(enabled),
    onSuccess: (data: SchedulerStatus) => {
      qc.setQueryData(['agent', 'status'], data)
    },
  })

  const runAgent = useMutation({
    mutationFn: api.agent.run,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['pairJournals'] })
      toast.success('Agent cycle complete')
    },
    onError: () => {
      toast.error('Agent cycle failed')
    },
  })

  const pairJournalByPair = Object.fromEntries(
    pairJournals.map((pj) => [pj.pair, pj])
  )

  return (
    <main className="page-wrap px-2 pb-16 pt-10 sm:px-4">
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Positions</h1>
          <Link
            to="/suggest"
            className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white no-underline hover:bg-zinc-700 transition"
          >
            + Suggest pairs
          </Link>
        </div>

        {/* Scheduler bar */}
        <div className="flex flex-wrap items-center gap-4 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-sm">
          {statusLoading && (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
              Loading…
            </span>
          )}
          {!statusLoading && status && (
            <>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${status.schedulerActive ? 'bg-emerald-500' : 'bg-zinc-400'}`}
                />
                <span className="text-zinc-600 dark:text-zinc-400">
                  Scheduler: {status.schedulerActive ? 'Active' : 'Paused'}
                </span>
              </span>
              <button
                onClick={() => setScheduler.mutate(!status.schedulerActive)}
                disabled={setScheduler.isPending}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline underline-offset-2 disabled:opacity-50"
              >
                {setScheduler.isPending ? '…' : status.schedulerActive ? 'Pause' : 'Resume'}
              </button>
              {status.schedulerActive && (
                <span className="text-zinc-500">
                  Next run: {formatTimeUntil(status.nextRunAt)}
                </span>
              )}
              <button
                onClick={() => runAgent.mutate()}
                disabled={runAgent.isPending}
                className="ml-auto rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40"
              >
                {runAgent.isPending ? 'Running…' : 'Run now'}
              </button>
            </>
          )}
          {!statusLoading && !status && (
            <span className="text-zinc-400">Scheduler unavailable</span>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setInstructionModalOpen(true)}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
          >
            {instructionData?.instruction
              ? `Goal: ${instructionData.instruction.slice(0, 50)}${instructionData.instruction.length > 50 ? '…' : ''}`
              : 'Set your goal / instruction'}
          </button>
          <button
            onClick={() => setBinanceKeysModalOpen(true)}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
          >
            {binanceKeysStatus?.hasKeys
              ? `Binance API: ${binanceKeysStatus.apiKeyMasked ?? 'configured'}`
              : 'Add Binance API keys'}
          </button>
        </div>
      </div>

      {/* Binance API keys modal */}
      {binanceKeysModalOpen && (
        <BinanceKeysModal
          hasKeys={binanceKeysStatus?.hasKeys ?? false}
          apiKeyMasked={binanceKeysStatus?.apiKeyMasked}
          onAdd={(apiKey, apiSecret) => addBinanceKeys.mutate({ apiKey, apiSecret })}
          onRemove={() => removeBinanceKeys.mutate()}
          onClose={() => setBinanceKeysModalOpen(false)}
          isAdding={addBinanceKeys.isPending}
          isRemoving={removeBinanceKeys.isPending}
        />
      )}

      {/* Goal / instruction modal */}
      {instructionModalOpen && (
        <EditDisplaySaveModal
          title="Your goal / instruction"
          description="Tell the agent your goal for the day. It will factor this into its decisions."
          value={instructionData?.instruction ?? ''}
          placeholder="e.g. Today my goal is to make just $5 profit"
          onSave={async (v) => {
            try {
              const data = await setInstruction.mutateAsync(v)
              qc.setQueryData(['agent', 'instruction'], data)
              setInstructionModalOpen(false)
              toast.success('Goal saved')
            } catch {
              toast.error('Failed to save goal')
            }
          }}
          onClose={() => setInstructionModalOpen(false)}
          isPending={setInstruction.isPending}
        />
      )}

      {isLoading && (
        <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="w-8 py-2.5" />
                {['Pair', 'Direction', 'Status', 'Amount', 'PnL', ''].map((h) => (
                  <th
                    key={h}
                    className={`py-2.5 text-xs font-medium text-zinc-400 ${['', 'PnL', 'Amount'].includes(h) ? 'pr-4 text-right' : 'pl-4 text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-950">
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50">
                  <td className="py-3 pl-4">
                    <span className="inline-block h-2 w-2 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  </td>
                  <td className="py-3 pl-4">
                    <span className="inline-block h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  </td>
                  <td className="py-3 pl-4">
                    <span className="inline-block h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  </td>
                  <td className="py-3 pl-4">
                    <span className="inline-block h-4 w-14 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="ml-auto inline-block h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="ml-auto inline-block h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                  </td>
                  <td className="py-3 pr-4" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isError && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Cannot reach backend on port 3001. Is the server running?
        </p>
      )}

      {!isLoading && !isError && positions.length === 0 && (
        <div className="rounded border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-400">No positions yet.</p>
          <Link to="/suggest" className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-2">
            Get suggestions →
          </Link>
        </div>
      )}

      {positions.length > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="w-8 py-2.5" />
                {['Pair', 'Direction', 'Status', 'Amount', 'PnL', ''].map((h) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap py-2.5 text-xs font-medium text-zinc-400 ${h === '' ? 'min-w-[280px]' : ''} ${['', 'PnL', 'Amount'].includes(h) ? 'pr-4 text-right' : 'pl-4 text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-950">
              {positions.map((p) => (
                <PositionRow
                  key={p.id}
                  position={p}
                  pairJournal={pairJournalByPair[p.pair] ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
