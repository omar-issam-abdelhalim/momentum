import { lazy, Suspense, useState } from 'react'
import { BottomNav } from '@/components/layout/BottomNav'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { HomeScreen } from '@/screens/HomeScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { useAppInit } from '@/hooks/useAppInit'
import { useTheme } from '@/hooks/useTheme'
import { AlertTriangle } from 'lucide-react'

// Recharts pulls in a large chunk of its own — only load it once the user
// actually opens Analytics rather than bloating the initial app shell.
const AnalyticsScreen = lazy(() => import('@/screens/AnalyticsScreen').then((m) => ({ default: m.AnalyticsScreen })))

export type Screen = 'home' | 'analytics' | 'history' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const { ready, error } = useAppInit()
  useTheme()

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="text-danger" size={28} aria-hidden="true" />
        <p className="text-sm text-ink-muted">Couldn't start the app. Try reloading.</p>
      </div>
    )
  }

  if (!ready) {
    return <div className="min-h-dvh bg-surface" aria-busy="true" />
  }

  return (
    <div className="min-h-dvh bg-surface">
      {screen === 'home' && <HomeScreen />}
      {screen === 'analytics' && (
        <Suspense fallback={<div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top" aria-busy="true" />}>
          <AnalyticsScreen />
        </Suspense>
      )}
      {screen === 'history' && <HistoryScreen />}
      {screen === 'settings' && <SettingsScreen />}
      <InstallPrompt />
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  )
}
