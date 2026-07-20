import { useState } from 'react'
import { Check, Clock, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { Goal } from '@/types/models'
import { getDeadlineUrgency, URGENCY_LABEL } from '@/lib/logic/deadline'
import { isLate, lateDays } from '@/lib/logic/goalKind'
import { formatShortDate } from '@/lib/date/format'
import { getTodayISO } from '@/lib/date/week'
import { ActionSheet } from '@/components/ui/ActionSheet'

interface GoalCardProps {
  goal: Goal
  onToggleComplete: (goal: Goal) => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

const urgencyStyles: Record<string, string> = {
  overdue: 'bg-danger/10 text-danger',
  today: 'bg-warning/10 text-warning',
  tomorrow: 'bg-accent-muted text-accent',
  upcoming: 'bg-surface-sunken text-ink-muted',
}

const KIND_LABEL: Record<Goal['kind'], string> = {
  scheduled: 'Scheduled',
  weekly: 'Weekly',
  today: 'Today only',
  recurring: 'Recurring',
}

export function GoalCard({ goal, onToggleComplete, onEdit, onDelete }: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const todayISO = getTodayISO()
  const urgency = getDeadlineUrgency(goal.deadlineISO, todayISO)
  const late = isLate(goal, todayISO)
  const daysLate = late ? lateDays(goal, todayISO) : 0

  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-3.5 shadow-soft transition ${
        goal.completed ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleComplete(goal)}
        aria-pressed={goal.completed}
        aria-label={goal.completed ? 'Mark incomplete' : 'Mark complete'}
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
          goal.completed ? 'border-accent bg-accent text-white animate-check-pop' : 'border-border-strong text-transparent'
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-ink ${goal.completed ? 'line-through' : ''}`}>{goal.title}</p>
        {goal.description && <p className="mt-0.5 truncate text-xs text-ink-muted">{goal.description}</p>}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">
            {KIND_LABEL[goal.kind]}
          </span>

          {late && !goal.completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
              <Clock size={10} aria-hidden="true" />
              Late{daysLate > 0 ? ` · ${daysLate}d` : ''}
            </span>
          )}

          {urgency !== 'none' && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${urgencyStyles[urgency]}`}>
              {URGENCY_LABEL[urgency]}
              {(urgency === 'upcoming' || urgency === 'overdue') && goal.deadlineISO
                ? ` · ${formatShortDate(goal.deadlineISO)}`
                : ''}
            </span>
          )}

          {goal.kind === 'weekly' && goal.rolledOver && !goal.completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              <RotateCcw size={10} aria-hidden="true" />
              Rolled over{goal.rolloverCount > 1 ? ` ×${goal.rolloverCount}` : ''}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Goal options"
        className="-mr-1.5 -mt-1 rounded-full p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
      >
        <MoreHorizontal size={18} />
      </button>

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={goal.title}
        items={[
          { label: 'Edit', icon: Pencil, onSelect: () => onEdit(goal) },
          { label: 'Delete', icon: Trash2, onSelect: () => onDelete(goal), destructive: true },
        ]}
      />
    </div>
  )
}
