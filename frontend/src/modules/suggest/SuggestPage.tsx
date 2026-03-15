import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { api } from '../shared/api'
import type { Suggestion, SuggestionsResponse, SnapshotSummary } from '../shared/api'
import { getRiskLabel } from './utils'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SuggestPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [mounted, setMounted] = useState(false)
  const [triggerRisk, setTriggerRisk] = useState(5)
  const [result, setResult] = useState<SuggestionsResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [addModal, setAddModal] = useState<Suggestion | null>(null)
  const [modalAmount, setModalAmount] = useState(100)

  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: api.positions.list })
  const activePairs = new Set(
    positions.filter((p) => p.status === 'INACTIVE' || p.status === 'ACTIVE').map((p) => p.pair)
  )

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['suggestions', 'history'],
    queryFn: api.suggestions.history,
  })

  useEffect(() => setMounted(true), [])

  // Clear result when history is emptied (e.g. after "Clear all data")
  useEffect(() => {
    if (history.length === 0) {
      setResult(null)
      setSelectedId(null)
    }
  }, [history.length])

  // Load latest snapshot on first history fetch
  useEffect(() => {
    if (history.length > 0 && !result) {
      const latest = history[0]
      setSelectedId(latest.id)
      void api.suggestions.getById(latest.id).then((r) => {
        setResult(r)
      })
    }
  }, [history])

  const selectedHistory = history.find((h) => h.id === selectedId)
  const triggerLabel = getRiskLabel(triggerRisk)
  const displayRisk = result?.riskPct ?? selectedHistory?.riskPct ?? triggerRisk
  const selectedLabel = result ? getRiskLabel(displayRisk) : null

  const getSuggestions = useMutation({
    mutationFn: (p: number) => api.suggestions.generate(p),
    onSuccess: (data) => {
      setResult(data)
      setSelectedId(data.id ?? null)
      setAdded(new Set())
      qc.invalidateQueries({ queryKey: ['suggestions', 'history'] })
    },
  })

  const addPosition = useMutation({
    mutationFn: ({ suggestion, amount }: { suggestion: Suggestion; amount: number }) =>
      api.positions.create(suggestion.pair, suggestion.direction, suggestion.riskLevel, amount),
    onSuccess: (_, { suggestion }) => {
      setAdded((prev) => new Set([...prev, suggestion.pair]))
      setAddModal(null)
      qc.invalidateQueries({ queryKey: ['positions'] })
    },
  })

  const deleteSnapshot = useMutation({
    mutationFn: (id: string) => api.suggestions.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['suggestions', 'history'] })
      const prev = qc.getQueryData<SnapshotSummary[]>(['suggestions', 'history'])
      qc.setQueryData<SnapshotSummary[]>(['suggestions', 'history'], (old) =>
        old?.filter((h) => h.id !== id) ?? []
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['suggestions', 'history'], ctx.prev)
    },
    onSuccess: (_, id) => {
      if (selectedId === id) {
        const remaining = qc.getQueryData<typeof history>(['suggestions', 'history']) ?? []
        const next = remaining[0]
        if (next) {
          setSelectedId(next.id)
          void api.suggestions.getById(next.id).then((r) => setResult(r))
        } else {
          setResult(null)
          setSelectedId(null)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['suggestions', 'history'] })
    },
  })

  function selectSnapshot(id: string) {
    if (id === selectedId) return
    setSelectedId(id)
    setAdded(new Set())
    void api.suggestions.getById(id).then((r) => setResult(r))
  }

  return (
    <main className="page-wrap px-2 pt-10 pb-16 sm:px-4">
      <h1 className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Suggest pairs</h1>

      <div className="flex gap-8 items-start">
        {/* ── Left sidebar: Trigger + History ── */}
        <div className="w-56 shrink-0 space-y-6">
          {/* New analysis trigger */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">New analysis</p>
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Risk: <span style={{ color: triggerLabel.color }}>{triggerRisk}/10 {triggerLabel.label}</span>
            </p>
            {mounted && (
              <Slider
                value={[triggerRisk]}
                max={10}
                step={1}
                onValueChange={([v]) => setTriggerRisk(v)}
                className="mb-2"
              />
            )}
            <div className="flex justify-between text-xs text-zinc-400 mb-3">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
            <button
              onClick={() => getSuggestions.mutate(triggerRisk)}
              disabled={getSuggestions.isPending}
              className="w-full rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-xs font-medium text-white dark:text-zinc-900 transition hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40"
            >
              {getSuggestions.isPending ? 'Analysing…' : 'Analyse market'}
            </button>
          </section>

          {/* Past runs */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Past runs</p>
            {historyLoading ? (
              <p className="text-xs text-zinc-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-zinc-400">No runs yet</p>
            ) : (
              <ul className="space-y-1">
                {history.map((h) => {
                  const { label: rl, color: rc } = getRiskLabel(h.riskPct)
                  const isSelected = h.id === selectedId
                  const isDeleting = deleteSnapshot.isPending && deleteSnapshot.variables === h.id
                  return (
                    <li key={h.id} className="group relative">
                      <button
                        onClick={() => selectSnapshot(h.id)}
                        className={`w-full rounded px-3 py-2.5 text-left transition ${
                          isSelected
                            ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-700 dark:text-zinc-200'
                            : 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 pr-4">
                          <span className="text-sm font-semibold tabular-nums">{h.riskPct}/10</span>
                          <span className="text-xs font-medium" style={{ color: isSelected ? 'inherit' : rc }}>{rl}</span>
                        </div>
                        <div className="mt-0.5 text-xs opacity-50">{formatDate(h.createdAt)}</div>
                      </button>
                      <button
                        onClick={() => deleteSnapshot.mutate(h.id)}
                        disabled={isDeleting}
                        title="Delete"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition p-1 rounded text-zinc-400 hover:text-red-500 disabled:opacity-30"
                      >
                        {isDeleting ? '…' : '×'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ── Main: Current selection (analysis + suggestions) ── */}
        <div className="flex-1 min-w-0">
          {getSuggestions.isPending && (
            <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Thinking…</p>
              <div className="mt-2 flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {getSuggestions.isError && !getSuggestions.isPending && (
            <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-4">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Analysis failed</p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                {getSuggestions.error?.message ?? 'Something went wrong'}
              </p>
              <button
                onClick={() => getSuggestions.mutate(triggerRisk)}
                className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!result && !getSuggestions.isPending && (
            <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
              <p className="text-sm text-zinc-500">
                {history.length === 0 ? 'Run a new analysis to get started.' : 'Select a past run or run a new analysis.'}
              </p>
            </div>
          )}

          {result && !getSuggestions.isPending && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Viewing</p>
                <span className="text-sm font-medium" style={{ color: selectedLabel?.color }}>
                  {displayRisk}/10 {selectedLabel?.label}
                </span>
                {selectedHistory && (
                  <span className="text-xs text-zinc-400">· {formatDate(selectedHistory.createdAt)}</span>
                )}
              </div>

              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-zinc-400">Analysis</p>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{result.analysis}</p>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-400">Suggested pairs</p>
                <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        {['Pair', 'Direction', 'Duration', 'Reason', ''].map((h) => (
                          <th key={h} className={`py-2.5 text-xs font-medium text-zinc-400 ${h === '' ? 'pr-4 text-right' : 'pl-4 text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {result.suggestions.map((s) => {
                        const isAdded = added.has(s.pair) || activePairs.has(s.pair)
                        return (
                          <tr key={s.pair} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                            <td className="py-3 pl-4 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{s.pair}</td>
                            <td className="px-3 py-3">
                              <span className={`text-xs font-medium ${s.direction === 'LONG' ? 'text-emerald-600' : 'text-red-500'}`}>
                                {s.direction}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-zinc-500">{s.duration}</td>
                            <td className="px-3 py-3 max-w-xs text-xs text-zinc-500 leading-relaxed">{s.reason}</td>
                            <td className="py-3 pl-3 pr-4 text-right">
                              <button
                                onClick={() => {
                                if (!isAdded) {
                                  setAddModal(s)
                                  setModalAmount(100)
                                }
                              }}
                                disabled={isAdded || addPosition.isPending}
                                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                                  isAdded
                                    ? 'text-white bg-emerald-600 dark:bg-emerald-500'
                                    : 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50'
                                }`}
                              >
                                {isAdded ? '✓ Added' : 'Add'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {added.size > 0 && (
                  <button
                    onClick={() => navigate({ to: '/' })}
                    className="mt-4 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
                  >
                    View positions →
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Add pair modal */}
          {addModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => !addPosition.isPending && setAddModal(null)}
            >
              <div
                className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Add {addModal.pair}
                </h3>
                <p className="text-xs text-zinc-500 mb-4">
                  {addModal.direction} · {addModal.riskLevel} risk
                </p>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Amount (USDT)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={modalAmount}
                  onChange={(e) => setModalAmount(Number(e.target.value) || 0)}
                  className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 font-mono tabular-nums text-sm mb-4"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setAddModal(null)}
                    disabled={addPosition.isPending}
                    className="rounded px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addPosition.mutate({ suggestion: addModal, amount: modalAmount })}
                    disabled={addPosition.isPending || modalAmount < 1}
                    className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                  >
                    {addPosition.isPending ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
