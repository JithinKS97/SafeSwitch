import { useState } from 'react'

const POPULAR_MODELS = [
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (fast, cheap)' },
  { value: 'openai/gpt-4o', label: 'GPT-4o (smarter)' },
  { value: 'anthropic/claude-3-5-haiku', label: 'Claude 3.5 Haiku (fast)' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (best)' },
  { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5 (fast, cheap)' },
]

type Tab = 'ai' | 'binance'

export function ConfigModal({
  // AI keys
  hasAiKeys,
  aiKeyMasked,
  currentModel,
  onAddAiKeys,
  onRemoveAiKeys,
  isAddingAiKeys,
  isRemovingAiKeys,
  // Binance keys
  hasBinanceKeys,
  binanceKeyMasked,
  onAddBinanceKeys,
  onRemoveBinanceKeys,
  isAddingBinanceKeys,
  isRemovingBinanceKeys,
  // modal
  onClose,
  initialTab,
}: {
  hasAiKeys: boolean
  aiKeyMasked?: string
  currentModel?: string
  onAddAiKeys: (apiKey: string, model: string) => void
  onRemoveAiKeys: () => void
  isAddingAiKeys: boolean
  isRemovingAiKeys: boolean
  hasBinanceKeys: boolean
  binanceKeyMasked?: string
  onAddBinanceKeys: (apiKey: string, apiSecret: string) => void
  onRemoveBinanceKeys: () => void
  isAddingBinanceKeys: boolean
  isRemovingBinanceKeys: boolean
  onClose: () => void
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'ai')

  // AI keys state
  const [aiApiKey, setAiApiKey] = useState('')
  const [model, setModel] = useState(currentModel ?? 'openai/gpt-4o-mini')

  // Binance keys state
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceApiSecret, setBinanceApiSecret] = useState('')
  const [showBinanceForm, setShowBinanceForm] = useState(!hasBinanceKeys)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Settings</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6">
          <button
            onClick={() => setTab('ai')}
            className={`-mb-px mr-4 py-3 text-xs font-medium border-b-2 transition ${
              tab === 'ai'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            AI Model
            {!hasAiKeys && (
              <span className="ml-1.5 rounded-full bg-red-500 w-1.5 h-1.5 inline-block" />
            )}
          </button>
          <button
            onClick={() => setTab('binance')}
            className={`-mb-px py-3 text-xs font-medium border-b-2 transition ${
              tab === 'binance'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Binance API
            <span className="ml-1.5 text-[10px] text-zinc-400">(optional)</span>
          </button>
        </div>

        {/* AI keys tab */}
        {tab === 'ai' && (
          <div className="p-6 space-y-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Required to run market analysis and the trading agent. Get your key at{' '}
              <span className="font-mono">openrouter.ai/keys</span>.
            </p>

            {hasAiKeys && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
                <p className="text-xs text-zinc-500">
                  Current key: <span className="font-mono">{aiKeyMasked}</span>
                </p>
                {currentModel && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Model: <span className="font-mono">{currentModel}</span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={hasAiKeys ? 'Enter new key to replace…' : 'sk-or-…'}
                className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full appearance-none rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-3 pr-8 py-2 text-sm bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.625rem_center]"
              >
                {POPULAR_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-between pt-1">
              {hasAiKeys && (
                <button
                  onClick={onRemoveAiKeys}
                  disabled={isRemovingAiKeys}
                  className="rounded px-3 py-1.5 text-xs font-medium border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                  {isRemovingAiKeys ? 'Removing…' : 'Remove key'}
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={onClose}
                  className="rounded px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { if (aiApiKey.trim()) onAddAiKeys(aiApiKey.trim(), model) }}
                  disabled={!aiApiKey.trim() || isAddingAiKeys}
                  className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                >
                  {isAddingAiKeys ? 'Saving…' : hasAiKeys ? 'Update key' : 'Save key'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Binance tab */}
        {tab === 'binance' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Optional. Required only for live trading. Keys are encrypted and never shared. Create
              keys at Binance → API Management (enable Spot trading).
            </p>

            {hasBinanceKeys && !showBinanceForm && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Keys configured: <span className="font-mono">{binanceKeyMasked ?? '…'}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBinanceForm(true)}
                    className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Update keys
                  </button>
                  <button
                    onClick={onRemoveBinanceKeys}
                    disabled={isRemovingBinanceKeys}
                    className="rounded border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    {isRemovingBinanceKeys ? 'Removing…' : 'Remove keys'}
                  </button>
                </div>
              </div>
            )}

            {(!hasBinanceKeys || showBinanceForm) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const k = binanceApiKey.trim()
                  const s = binanceApiSecret.trim()
                  if (k && s) onAddBinanceKeys(k, s)
                }}
                className="space-y-4"
              >
                <label className="block">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">API Key</span>
                  <input
                    type="text"
                    value={binanceApiKey}
                    onChange={(e) => setBinanceApiKey(e.target.value)}
                    placeholder="Your Binance API key"
                    className="mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">API Secret</span>
                  <input
                    type="password"
                    value={binanceApiSecret}
                    onChange={(e) => setBinanceApiSecret(e.target.value)}
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
                    disabled={isAddingBinanceKeys || !binanceApiKey.trim() || !binanceApiSecret.trim()}
                    className="rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                  >
                    {isAddingBinanceKeys ? 'Saving…' : 'Save keys'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
