import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { api } from '../shared/api'
import type { Suggestion, SuggestionsResponse } from '../shared/api'
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
  const [pct, setPct] = useState(50)
  const [result, setResult] = useState<SuggestionsResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: api.positions.list })
  const activePairs = new Set(
    positions.filter((p) => p.status === 'INACTIVE' || p.status === 'ACTIVE').map((p) => p.pair)
  )

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['suggestions', 'history'],
    queryFn: api.suggestions.history,
  })

  useEffect(() => setMounted(true), [])

  // Load latest snapshot on first history fetch
  useEffect(() => {
    if (history.length > 0 && !result) {
      const latest = history[0]
      setSelectedId(latest.id)
      void api.suggestions.getById(latest.id).then((r) => {
        setResult(r)
        setPct(r.riskPct ?? 50)
      })
    }
  }, [history])

  const { label, color } = getRiskLabel(pct)

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
    mutationFn: (s: Suggestion) => api.positions.create(s.pair, s.direction, s.riskLevel),
    onSuccess: (_, s) => {
      setAdded((prev) => new Set([...prev, s.pair]))
      qc.invalidateQueries({ queryKey: ['positions'] })
    },
  })

  function selectSnapshot(id: string) {
    if (id === selectedId) return
    setSelectedId(id)
    setAdded(new Set())
    void api.suggestions.getById(id).then((r) => {
      setResult(r)
      setPct(r.riskPct ?? 50)
    })
  }

  return (
    <main className="page-wrap px-4 pt-10 pb-16">
      <h1 className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Suggest pairs</h1>

      <div className="flex gap-8 items-start">
        {/* ── Left panel: controls + result ── */}
        <div className="flex-1 min-w-0">
          <div className="mb-8 w-72 space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
              <span className="text-sm font-medium" style={{ color }}>{label}</span>
            </div>

            {mounted && (
              <Slider
                value={[pct]}
                max={100}
                step={1}
                onValueChange={([v]) => setPct(v)}
              />
            )}

            <div className="flex justify-between text-xs text-zinc-400">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>

          <button
            onClick={() => getSuggestions.mutate(pct)}
            disabled={getSuggestions.isPending}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {getSuggestions.isPending ? 'Analysing…' : 'Analyse market'}
          </button>

          {getSuggestions.isPending && (
            <div className="mt-8 space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Thinking…</p>
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {result && (
            <section className="mt-10 space-y-8">
              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
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
                                onClick={() => !isAdded && addPosition.mutate(s)}
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
        </div>

        {/* ── Right panel: history ── */}
        <div className="w-56 shrink-0">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-400">History</p>
          {historyLoading ? (
            <p className="text-xs text-zinc-400">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-zinc-400">No runs yet.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => {
                const { label: rl, color: rc } = getRiskLabel(h.riskPct)
                const isSelected = h.id === selectedId
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => selectSnapshot(h.id)}
                      className={`w-full rounded px-3 py-2.5 text-left transition ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums">{h.riskPct}%</span>
                        <span className="text-xs font-medium" style={{ color: isSelected ? 'inherit' : rc }}>{rl}</span>
                      </div>
                      <div className="mt-0.5 text-xs opacity-50">{formatDate(h.createdAt)}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
