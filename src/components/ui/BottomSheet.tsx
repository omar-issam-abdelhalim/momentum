import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 animate-fade-in dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="relative z-10 flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-surface-raised shadow-sheet animate-slide-up sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 id="sheet-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 rounded-full p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
