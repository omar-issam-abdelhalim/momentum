import { useState } from 'react'
import { Check, Flame, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { HabitWithState } from '@/hooks/useHabits'
import { ActionSheet } from '@/components/ui/ActionSheet'

interface HabitCardProps {
  habit: HabitWithState
  onToggle: (habit: HabitWithState) => void
  onEdit: (habit: HabitWithState) => void
  onDelete: (habit: HabitWithState) => void
}

export function HabitCard({ habit, onToggle, onEdit, onDelete }: HabitCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3.5 shadow-soft transition ${
        habit.completedThisPeriod ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(habit)}
        aria-pressed={habit.completedThisPeriod}
        aria-label={habit.completedThisPeriod ? 'Mark not done' : 'Mark done'}
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
          habit.completedThisPeriod
            ? 'border-accent bg-accent text-white animate-check-pop'
            : 'border-border-strong text-transparent'
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-ink ${habit.completedThisPeriod ? 'line-through' : ''}`}>{habit.name}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium">
            {habit.frequency === 'daily' ? 'Daily' : 'Weekly'}
          </span>
          {habit.currentStreak > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-warning">
              <Flame size={12} aria-hidden="true" />
              {habit.currentStreak} {habit.frequency === 'daily' ? 'day' : 'week'} streak
            </span>
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
          { label: 'Delete', icon: Trash2, onSelect: () => onDelete(habit), destructive: true },
        ]}
      />
    </div>
  )
}
