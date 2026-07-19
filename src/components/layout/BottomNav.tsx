import { BarChart3, History, Home, Settings } from 'lucide-react'
import type { Screen } from '@/App'

interface BottomNavProps {
  active: Screen
  onChange: (screen: Screen) => void
}

const ITEMS: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised/95 backdrop-blur safe-bottom"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-xs"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.4 : 1.8}
                className={isActive ? 'text-accent' : 'text-ink-faint'}
                aria-hidden="true"
              />
              <span className={isActive ? 'font-medium text-accent' : 'text-ink-muted'}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
