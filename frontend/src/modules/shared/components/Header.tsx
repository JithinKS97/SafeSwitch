import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authClient, setStoredToken } from '../../../lib/auth-client'
import { api } from '../api'
import { ConfigModal } from '../../positions/components/ConfigModal'

export default function Header() {
  const { data: session, isPending } = authClient.useSession()
  const qc = useQueryClient()
  const [configOpen, setConfigOpen] = useState(false)

  const { data: aiKeysStatus } = useQuery({
    queryKey: ['aiKeys'],
    queryFn: api.aiKeys.getStatus,
    enabled: !!session?.user,
  })

  const { data: binanceKeysStatus } = useQuery({
    queryKey: ['binanceKeys'],
    queryFn: api.binanceKeys.getStatus,
    enabled: !!session?.user,
  })

  const addAiKeys = useMutation({
    mutationFn: ({ apiKey, model }: { apiKey: string; model: string }) =>
      api.aiKeys.addOrUpdate(apiKey, model),
    onSuccess: (data) => {
      qc.setQueryData(['aiKeys'], data)
      setConfigOpen(false)
      toast.success('OpenRouter API key saved')
    },
    onError: (e) => toast.error(e.message),
  })

  const removeAiKeys = useMutation({
    mutationFn: () => api.aiKeys.remove(),
    onSuccess: () => {
      qc.setQueryData(['aiKeys'], { hasKeys: false })
      setConfigOpen(false)
      toast.success('OpenRouter API key removed')
    },
    onError: (e) => toast.error(e.message),
  })

  const addBinanceKeys = useMutation({
    mutationFn: ({ apiKey, apiSecret }: { apiKey: string; apiSecret: string }) =>
      api.binanceKeys.addOrUpdate(apiKey, apiSecret),
    onSuccess: (data) => {
      qc.setQueryData(['binanceKeys'], data)
      setConfigOpen(false)
      toast.success('Binance API keys saved')
    },
    onError: (e) => toast.error(e.message),
  })

  const removeBinanceKeys = useMutation({
    mutationFn: () => api.binanceKeys.remove(),
    onSuccess: () => {
      qc.setQueryData(['binanceKeys'], { hasKeys: false })
      setConfigOpen(false)
      toast.success('Binance API keys removed')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <nav className="page-wrap flex items-center justify-between px-2 py-3 sm:px-4">
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/"
              className="text-zinc-500 dark:text-zinc-400 no-underline hover:text-zinc-900 dark:hover:text-zinc-100 transition [&.active]:text-zinc-900 dark:[&.active]:text-zinc-100 [&.active]:font-medium"
            >
              Positions
            </Link>
            <Link
              to="/suggest"
              className="text-zinc-500 dark:text-zinc-400 no-underline hover:text-zinc-900 dark:hover:text-zinc-100 transition [&.active]:text-zinc-900 dark:[&.active]:text-zinc-100 [&.active]:font-medium"
            >
              Suggest
            </Link>
          </div>
          {!isPending && session?.user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfigOpen(true)}
                className={`rounded border px-2.5 py-1 text-xs font-medium transition ${
                  !aiKeysStatus?.hasKeys
                    ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
                title={!aiKeysStatus?.hasKeys ? 'OpenRouter API key required' : 'Settings'}
              >
                {!aiKeysStatus?.hasKeys ? '⚙ Setup required' : '⚙ Config'}
              </button>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                {session.user.email}
              </span>
              <button
                onClick={() => {
                  setStoredToken(null)
                  window.location.href = '/sign-in'
                }}
                className="rounded border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="h-8 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          )}
        </nav>
      </header>

      {configOpen && (
        <ConfigModal
          hasAiKeys={aiKeysStatus?.hasKeys ?? false}
          aiKeyMasked={aiKeysStatus?.apiKeyMasked}
          currentModel={aiKeysStatus?.model}
          onAddAiKeys={(apiKey, model) => addAiKeys.mutate({ apiKey, model })}
          onRemoveAiKeys={() => removeAiKeys.mutate()}
          isAddingAiKeys={addAiKeys.isPending}
          isRemovingAiKeys={removeAiKeys.isPending}
          hasBinanceKeys={binanceKeysStatus?.hasKeys ?? false}
          binanceKeyMasked={binanceKeysStatus?.apiKeyMasked}
          onAddBinanceKeys={(apiKey, apiSecret) => addBinanceKeys.mutate({ apiKey, apiSecret })}
          onRemoveBinanceKeys={() => removeBinanceKeys.mutate()}
          isAddingBinanceKeys={addBinanceKeys.isPending}
          isRemovingBinanceKeys={removeBinanceKeys.isPending}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </>
  )
}
