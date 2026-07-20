import { useEffect, useState } from 'react'
import { runWeeklyRollover } from '@/lib/db/rolloverRunner'
import { runRecurringGeneration } from '@/lib/db/recurringRunner'
import { runDataCleanup } from '@/lib/db/cleanupRunner'
import { initSettings } from '@/lib/db/db'

interface InitState {
  ready: boolean
  error: Error | null
}

/** Runs one-time startup work: ensure settings exist, roll over closed weeks, clean up stale detail records. */
export function useAppInit(): InitState {
  const [state, setState] = useState<InitState>({ ready: false, error: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await initSettings()
        await runWeeklyRollover()
        await runRecurringGeneration()
        await runDataCleanup()
        if (!cancelled) setState({ ready: true, error: null })
      } catch (err) {
        console.error('App initialization failed:', err)
        if (!cancelled) setState({ ready: false, error: err instanceof Error ? err : new Error(String(err)) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
