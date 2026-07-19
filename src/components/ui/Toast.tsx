import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'

interface ToastAction {
  label: string
  onAction: () => void
}

interface ToastItem {
  id: string
  message: string
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (message: string, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    (message: string, action?: ToastAction) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, action }])
      const timer = setTimeout(() => dismiss(id), DURATION_MS)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg bg-ink px-4 py-3 text-surface shadow-raised animate-slide-up dark:bg-surface-raised dark:text-ink dark:border dark:border-border"
          >
            <Check size={16} className="shrink-0 text-success" aria-hidden="true" />
            <span className="flex-1 text-sm">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onAction()
                  dismiss(t.id)
                }}
                className="shrink-0 text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded-full p-1 text-surface/70 hover:text-surface dark:text-ink-muted dark:hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
