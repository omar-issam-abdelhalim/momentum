import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { APP_CONFIG } from '@/config/app.config'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'momentum-install-dismissed'

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!deferredEvent || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  const install = async () => {
    await deferredEvent.prompt()
    await deferredEvent.userChoice
    setDeferredEvent(null)
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 pb-2">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-surface-raised p-3.5 shadow-raised animate-slide-up">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
          <Download size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Install {APP_CONFIG.name}</p>
          <p className="text-xs text-ink-muted">Add to your home screen for the full app experience.</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white active:scale-95"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
