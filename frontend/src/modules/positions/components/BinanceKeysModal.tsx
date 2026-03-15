import { useState } from 'react'

type Props = {
  hasKeys: boolean
  apiKeyMasked?: string
  onAdd: (apiKey: string, apiSecret: string) => void
  onRemove: () => void
  onClose: () => void
  isAdding: boolean
  isRemoving: boolean
}

export function BinanceKeysModal({
  hasKeys,
  apiKeyMasked,
  onAdd,
  onRemove,
  onClose,
  isAdding,
  isRemoving,
}: Props) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showForm, setShowForm] = useState(!hasKeys)

  const handleAdd = () => {
    const k = apiKey.trim()
    const s = apiSecret.trim()
    if (k && s) onAdd(k, s)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Binance API keys
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Add your Binance API key and secret to enable live trading. Keys are encrypted and never
          shared. Create keys at Binance → API Management (enable Spot trading).
        </p>

        {hasKeys ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Keys configured: <span className="font-mono">{apiKeyMasked ?? '…'}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Update keys
              </button>
              <button
                onClick={onRemove}
                disabled={isRemoving}
                className="rounded border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
              >
                {isRemoving ? 'Removing…' : 'Remove keys'}
              </button>
            </div>
          </div>
        ) : null}

        {(!hasKeys || showForm) && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAdd()
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">API Key</span>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your Binance API key"
                className="mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                API Secret
              </span>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Your Binance API secret"
                className="mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
                autoComplete="new-password"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding || !apiKey.trim() || !apiSecret.trim()}
                className="rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
              >
                {isAdding ? 'Saving…' : 'Save keys'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
