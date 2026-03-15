import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

export default function Footer() {
  const qc = useQueryClient()
  const clearAll = useMutation({
    mutationFn: () => api.user.clearAllData(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['suggestions', 'history'] })
      qc.invalidateQueries({ queryKey: ['agent', 'journal'] })
      qc.invalidateQueries({ queryKey: ['agent', 'status'] })
    },
  })

  function handleClear() {
    if (window.confirm('Delete all your positions, suggestions, and agent journal? This cannot be undone.')) {
      clearAll.mutate()
    }
  }

  return (
    <footer className="mt-20 px-4 py-6 border-t border-zinc-200 dark:border-zinc-800">
      <div className="page-wrap flex items-center justify-center gap-4 text-xs text-zinc-400">
        <span>SafeSwitch — paper to live trading</span>
        <button
          onClick={handleClear}
          disabled={clearAll.isPending}
          className="text-zinc-400 hover:text-red-500 transition disabled:opacity-50"
        >
          {clearAll.isPending ? 'Clearing…' : 'Clear all data'}
        </button>
      </div>
    </footer>
  )
}
