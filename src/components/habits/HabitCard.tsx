import { useState } from 'react'
import { BarChart3, Check, Flame, MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import type { HabitWithState } from '@/hooks/useHabits'
import { ActionSheet } from '@/components/ui/ActionSheet'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { progressPercent } from '@/lib/logic/quantity'
import { usePressHandlers } from '@/hooks/useLongPress'

interface HabitCardProps {
  habit: HabitWithState
  onToggle: (habit: HabitWithState) => void
  onIncrement: (habit: HabitWithState) => void
  onDecrement: (habit: HabitWithState) => void
  onEdit: (habit: HabitWithState) => void
  onDelete: (habit: HabitWithState) => void
  onPause: (habit: HabitWithState) => void
  onResume: (habit: HabitWithState) => void
  onAnalysis: (habit: HabitWithState) => void
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function frequencyLabel(habit: HabitWithState): string {
  if (habit.frequency === 'weekly') return 'Weekly'
  if (habit.weekdays && habit.weekdays.length > 0) return habit.weekdays.map((d) => WEEKDAY_SHORT[d]).join('/')
  return 'Daily'
}

export function HabitCard({
  habit,
  onToggle,
  onIncrement,
  onDecrement,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onAnalysis,
}: HabitCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPaused = habit.status === 'paused'
  const canToggle = !isPaused && habit.dueToday
  const isCounter = habit.progressTarget > 1
  const showRing = isCounter && canToggle && !habit.completedThisPeriod

  const pressHandlers = usePressHandlers({
    onTap: () => onIncrement(habit),
    onHold: () => onDecrement(habit),
  })

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3.5 shadow-soft transition ${
        habit.completedThisPeriod || isPaused ? 'opacity-60' : ''
      }`}
    >
      {showRing ? (
        <button
          type="button"
          aria-label={`${habit.name}: ${habit.progressCount} of ${habit.progressTarget}. Tap to add one, hold to undo one.`}
          className="flex shrink-0 touch-none select-none items-center justify-center active:scale-90"
          onPointerDown={pressHandlers.onPointerDown}
          onPointerUp={pressHandlers.onPointerUp}
          onPointerLeave={pressHandlers.onPointerLeave}
          onContextMenu={pressHandlers.onContextMenu}
        >
          <ProgressRing
            percent={progressPercent(habit.progressCount, habit.progressTarget)}
            size={28}
            strokeWidth={3}
            label={String(habit.progressCount)}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => canToggle && onToggle(habit)}
          disabled={!canToggle}
          aria-pressed={habit.completedThisPeriod}
          aria-label={habit.completedThisPeriod ? 'Mark not done' : 'Mark done'}
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 disabled:active:scale-100 ${
            habit.completedThisPeriod
              ? 'border-accent bg-accent text-white animate-check-pop'
              : 'border-border-strong text-transparent'
          } ${!canToggle ? 'opacity-40' : ''}`}
        >
          <Check size={14} strokeWidth={3} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-ink ${habit.completedThisPeriod ? 'line-through' : ''}`}>{habit.name}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium">{frequencyLabel(habit)}</span>
          {showRing && (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium tabular-nums">
              {habit.progressCount}/{habit.progressTarget}
            </span>
          )}
          {isPaused ? (
            <span className="font-medium text-ink-faint">Paused</span>
          ) : !habit.dueToday ? (
            <span className="text-ink-faint">Not scheduled today</span>
          ) : (
            habit.currentStreak > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-warning">
                <Flame size={12} aria-hidden="true" />
                {habit.currentStreak} {habit.frequency === 'daily' ? 'day' : 'week'} streak
              </span>
            )
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Habit options"
        className="-mr-1.5 rounded-full p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
      >
        <MoreHorizontal size={18} />
      </button>

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={habit.name}
        items={[
          { label: 'Edit', icon: Pencil, onSelect: () => onEdit(habit) },
          isPaused
            ? { label: 'Resume', icon: Play, onSelect: () => onResume(habit) }
            : { label: 'Pause', icon: Pause, onSelect: () => onPause(habit) },
          { label: 'Analysis', icon: BarChart3, onSelect: () => onAnalysis(habit) },
          { label: 'Delete', icon: Trash2, onSelect: () => onDelete(habit), destructive: true },
        ]}
      />
    </div>
  )
}
