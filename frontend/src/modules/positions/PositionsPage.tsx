import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../shared/api'
import { PositionRow } from './components/PositionRow'

export function PositionsPage() {
  const { data: positions = [], isLoading, isError } = useQuery({
    queryKey: ['positions'],
    queryFn: api.positions.list,
    refetchInterval: 5000,
  })

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Positions</h1>
        <Link
          to="/suggest"
          className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white no-underline hover:bg-zinc-700 transition"
        >
          + Suggest pairs
        </Link>
      </div>

      {isLoading && <p className="text-sm text-zinc-400">Loading…</p>}

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
        <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                {['Pair', 'Direction', 'Status', 'Confidence', 'PnL (USDT)', ''].map((h) => (
                  <th key={h} className={`py-2.5 text-xs font-medium text-zinc-400 ${h === '' || h === 'PnL (USDT)' ? 'pr-4 text-right' : 'pl-4 text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-950">
              {positions.map((p) => <PositionRow key={p.id} position={p} />)}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
