import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, RiskAppetite, Suggestion } from '../lib/api'

export const Route = createFileRoute('/suggest')({ component: SuggestPage })

const RISK_OPTIONS: { value: RiskAppetite; label: string; desc: string; color: string }[] = [
  { value: 'LOW', label: 'Low', desc: 'Stable pairs, longer holds, minimal drawdown.', color: 'border-[var(--palm)] bg-[rgba(47,106,74,0.06)]' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Balanced pairs, moderate duration and volatility.', color: 'border-[var(--lagoon-deep)] bg-[rgba(79,184,178,0.06)]' },
  { value: 'HIGH', label: 'High', desc: 'Volatile pairs, short windows, high reward potential.', color: 'border-red-400 bg-[rgba(220,60,60,0.05)]' },
]

const DIRECTION_COLOR: Record<string, string> = {
  LONG: 'text-[var(--palm)]',
  SHORT: 'text-red-500',
}

function SuggestPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [risk, setRisk] = useState<RiskAppetite | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [added, setAdded] = useState<Set<string>>(new Set())

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
    <main className="page-wrap px-4 pb-12 pt-10">
      <p className="island-kicker mb-1">Discovery</p>
      <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">Get Suggestions</h1>
      <p className="mb-8 text-sm text-[var(--sea-ink-soft)]">
        Choose a risk appetite — the agent will suggest trading pairs to watch.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {RISK_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRisk(opt.value)}
            className={`island-shell rounded-2xl p-5 text-left transition hover:-translate-y-0.5 ${
              risk === opt.value ? `border-2 ${opt.color}` : ''
            }`}
          >
            <p className="mb-1 font-bold text-[var(--sea-ink)]">{opt.label}</p>
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{opt.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => risk && getSuggestions.mutate(risk)}
          disabled={!risk || getSuggestions.isPending}
          className="rounded-full bg-[var(--lagoon-deep)] px-6 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-40"
        >
          {getSuggestions.isPending ? 'Analysing…' : 'Analyse Market'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-[var(--sea-ink)]">Suggested Pairs</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s) => {
              const isAdded = added.has(s.pair)
              return (
                <article key={s.pair} className="island-shell rounded-2xl p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--sea-ink)]">{s.pair}</span>
                      <span className={`text-xs font-semibold ${DIRECTION_COLOR[s.direction]}`}>
                        {s.direction}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--sea-ink-soft)]">{s.duration}</span>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-[var(--sea-ink-soft)]">{s.reason}</p>
                  <button
                    onClick={() => !isAdded && addPosition.mutate(s)}
                    disabled={isAdded || addPosition.isPending}
                    className={`w-full rounded-full py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 ${
                      isAdded
                        ? 'bg-[rgba(47,106,74,0.12)] text-[var(--palm)]'
                        : 'bg-[var(--lagoon)] text-white'
                    }`}
                  >
                    {isAdded ? '✓ Added to Positions' : 'Add to Positions'}
                  </button>
                </article>
              )
            })}
          </div>

          {added.size > 0 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate({ to: '/' })}
                className="text-sm font-semibold text-[var(--lagoon-deep)] underline"
              >
                Go to Positions →
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
