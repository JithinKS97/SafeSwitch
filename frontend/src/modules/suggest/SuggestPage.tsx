import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { api } from '../shared/api'
import type { RiskAppetite, Suggestion } from '../shared/api'
import { pctToRisk, getRiskLabel } from './utils'

export function SuggestPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [mounted, setMounted] = useState(false)
  const [pct, setPct] = useState(50)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [added, setAdded] = useState<Set<string>>(new Set())

  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: api.positions.list })
  const activePairs = new Set(
    positions.filter((p) => p.status === 'INACTIVE' || p.status === 'ACTIVE').map((p) => p.pair)
  )

  useEffect(() => setMounted(true), [])

  const { label, color } = getRiskLabel(pct)
  const risk = pctToRisk(pct)

  const getSuggestions = useMutation({
    mutationFn: (r: RiskAppetite) => api.suggestions.get(r),
    onSuccess: (data) => { setSuggestions(data); setAdded(new Set()) },
  })

  const addPosition = useMutation({
    mutationFn: (s: Suggestion) => api.positions.create(s.pair, s.direction, s.riskLevel),
    onSuccess: (_, s) => {
      setAdded((prev) => new Set([...prev, s.pair]))
      qc.invalidateQueries({ queryKey: ['positions'] })
    },
  })

  return (
    <main className="page-wrap px-4 pt-10 pb-16">
      <h1 className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Suggest pairs</h1>

      <div className="mb-8 w-72 space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
          <span className="text-sm font-medium" style={{ color }}>{label}</span>
        </div>

        {mounted && (
          <Slider
            defaultValue={[50]}
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
        onClick={() => getSuggestions.mutate(risk)}
        disabled={getSuggestions.isPending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
      >
        {getSuggestions.isPending ? 'Analysing…' : 'Analyse market'}
      </button>

      {suggestions.length > 0 && (
        <section className="mt-10">
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
                {suggestions.map((s) => {
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
                          className={`rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                            isAdded
                              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                              : 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
        </section>
      )}
    </main>
  )
}
