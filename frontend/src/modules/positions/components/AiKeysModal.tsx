import { useState } from 'react'

const POPULAR_MODELS = [
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (fast, cheap)' },
  { value: 'openai/gpt-4o', label: 'GPT-4o (smarter)' },
  { value: 'anthropic/claude-3-5-haiku', label: 'Claude 3.5 Haiku (fast)' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (best)' },
  { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5 (fast, cheap)' },
]

export function AiKeysModal({
  hasKeys,
  apiKeyMasked,
  currentModel,
  onAdd,
  onRemove,
  onClose,
  isAdding,
  isRemoving,
}: {
  hasKeys: boolean
  apiKeyMasked?: string
  currentModel?: string
  onAdd: (apiKey: string, model: string) => void
  onRemove: () => void
  onClose: () => void
  isAdding: boolean
  isRemoving: boolean
}) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(currentModel ?? 'openai/gpt-4o-mini')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">OpenRouter API key</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1">×</button>
        </div>

        {hasKeys && (
          <div className="mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500">Current key: <span className="font-mono">{apiKeyMasked}</span></p>
            {currentModel && <p className="text-xs text-zinc-500 mt-0.5">Model: <span className="font-mono">{currentModel}</span></p>}
          </div>
        )}

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Get your key at <span className="font-mono">openrouter.ai/keys</span>. Used for AI suggestions and journal writing.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            >
              {POPULAR_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-between mt-5">
          {hasKeys && (
            <button
              onClick={onRemove}
              disabled={isRemoving}
              className="rounded px-3 py-1.5 text-xs font-medium border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              {isRemoving ? 'Removing…' : 'Remove key'}
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
              onClick={() => { if (apiKey.trim()) onAdd(apiKey.trim(), model) }}
              disabled={!apiKey.trim() || isAdding}
              className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
            >
              {isAdding ? 'Saving…' : hasKeys ? 'Update key' : 'Save key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
