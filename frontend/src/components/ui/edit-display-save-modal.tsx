import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type EditDisplaySaveModalProps = {
  title: string
  description?: string
  value: string
  placeholder?: string
  onSave: (value: string) => void | Promise<void>
  onClose: () => void
  isPending?: boolean
}

export function EditDisplaySaveModal({
  title,
  description,
  value,
  placeholder,
  onSave,
  onClose,
  isPending = false,
}: EditDisplaySaveModalProps) {
  const [editMode, setEditMode] = useState(false)
  const [input, setInput] = useState(value)

  useEffect(() => {
    setInput(value)
  }, [value])

  const handleSave = async () => {
    await onSave(input.trim())
    setEditMode(false)
  }

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button
            onClick={() => !isPending && onClose()}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-4">
          {description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
          {editMode ? (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-400 resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditMode(false)}
                  disabled={isPending}
                  className="rounded px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="min-h-[4rem] rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                {value.trim() || (
                  <span className="text-zinc-400 dark:text-zinc-500 italic">
                    {placeholder ?? 'No content yet'}
                  </span>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setEditMode(true)}
                  className="rounded px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}
