import { useEffect, useState } from 'react'
import { CalendarClock, CalendarDays, Repeat, Sun } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { getTodayISO } from '@/lib/date/week'
import type { Goal, GoalKind, RecurrenceType } from '@/types/models'

export interface GoalFormValues {
  title: string
  description: string
  kind: GoalKind
  scheduledDateISO: string
  deadlineISO: string
  recurrenceType: RecurrenceType
  weekdays: number[]
}

interface GoalFormSheetProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: GoalFormValues) => void
  /** Present when editing an existing Goal item (not a recurring definition). */
  initialGoal?: Goal | null
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const KIND_OPTIONS: { value: GoalKind; label: string; hint: string; icon: typeof CalendarDays }[] = [
  { value: 'scheduled', label: 'Scheduled Task', hint: 'A day you intend to start it', icon: CalendarDays },
  { value: 'weekly', label: 'Weekly Goal', hint: 'Relevant all custom week', icon: Repeat },
  { value: 'today', label: 'Today Only', hint: 'Just for one specific day', icon: Sun },
  { value: 'recurring', label: 'Recurring Task', hint: 'Repeats on a schedule', icon: CalendarClock },
]

function emptyValues(): GoalFormValues {
  return {
    title: '',
    description: '',
    kind: 'scheduled',
    scheduledDateISO: getTodayISO(),
    deadlineISO: '',
    recurrenceType: 'daily',
    weekdays: [],
  }
}

function valuesFromGoal(goal: Goal): GoalFormValues {
  return {
    title: goal.title,
    description: goal.description ?? '',
    kind: goal.kind,
    scheduledDateISO: goal.scheduledDateISO ?? getTodayISO(),
    deadlineISO: goal.deadlineISO ?? '',
    recurrenceType: 'daily',
    weekdays: [],
  }
}

export function GoalFormSheet({ open, onClose, onSubmit, initialGoal }: GoalFormSheetProps) {
  const [values, setValues] = useState<GoalFormValues>(emptyValues())
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!initialGoal

  useEffect(() => {
    if (open) {
      setValues(initialGoal ? valuesFromGoal(initialGoal) : emptyValues())
      setError(null)
    }
  }, [open, initialGoal])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.title.trim()) {
      setError('Give it a title.')
      return
    }
    if ((values.kind === 'scheduled' || values.kind === 'today') && !values.scheduledDateISO) {
      setError('Choose a date.')
      return
    }
    if (values.kind === 'recurring' && values.recurrenceType === 'weekly' && values.weekdays.length === 0) {
      setError('Pick at least one day of the week.')
      return
    }
    onSubmit(values)
  }

  const toggleWeekday = (day: number) => {
    setValues((v) => ({
      ...v,
      weekdays: v.weekdays.includes(day) ? v.weekdays.filter((d) => d !== day) : [...v.weekdays, day].sort(),
    }))
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isEditing ? 'Edit' : 'New goal or task'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="goal-title" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Title
          </label>
          <input
            id="goal-title"
            type="text"
            autoFocus
            value={values.title}
            onChange={(e) => {
              setValues((v) => ({ ...v, title: e.target.value }))
              if (error) setError(null)
            }}
            placeholder="e.g. Finish the quarterly report"
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="goal-description" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Notes (optional)
          </label>
          <textarea
            id="goal-description"
            rows={2}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            placeholder="Any extra detail"
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
          />
        </div>

        {!isEditing && (
          <fieldset>
            <legend className="mb-1.5 block text-xs font-medium text-ink-muted">Type</legend>
            <div className="grid grid-cols-2 gap-2">
              {KIND_OPTIONS.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, kind: value }))}
                  aria-pressed={values.kind === value}
                  className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition ${
                    values.kind === value
                      ? 'border-accent bg-accent-muted text-accent'
                      : 'border-border text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </span>
                  <span className="text-[11px] leading-tight opacity-80">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {isEditing && (
          <p className="-mt-1 text-xs text-ink-faint">
            {KIND_OPTIONS.find((k) => k.value === values.kind)?.label}
            {values.kind === 'recurring' ? ' occurrence — editing affects only this one day.' : ''}
          </p>
        )}

        {(values.kind === 'scheduled' || values.kind === 'today') && (
          <div>
            <label htmlFor="goal-scheduled" className="mb-1.5 block text-xs font-medium text-ink-muted">
              {values.kind === 'today' ? 'Day' : 'Scheduled date'}
            </label>
            <input
              id="goal-scheduled"
              type="date"
              value={values.scheduledDateISO}
              onChange={(e) => setValues((v) => ({ ...v, scheduledDateISO: e.target.value }))}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              {values.kind === 'today'
                ? "Only relevant on this day — won't roll forward or become Late if missed."
                : 'When you intend to start. Stays active and marked Late if missed.'}
            </p>
          </div>
        )}

        {values.kind === 'weekly' && (
          <p className="rounded-md bg-surface-sunken px-3 py-2.5 text-xs text-ink-muted">
            Relevant for the current custom week (Saturday–Friday). Rolls into next week automatically if incomplete.
          </p>
        )}

        {!isEditing && values.kind === 'recurring' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-0.5 block text-xs font-medium text-ink-muted">Repeats</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['daily', 'weekly'] as RecurrenceType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, recurrenceType: type }))}
                  aria-pressed={values.recurrenceType === type}
                  className={`rounded-md border px-3 py-2.5 text-sm font-medium capitalize transition ${
                    values.recurrenceType === type
                      ? 'border-accent bg-accent-muted text-accent'
                      : 'border-border text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  {type === 'daily' ? 'Every day' : 'Specific day(s)'}
                </button>
              ))}
            </div>

            {values.recurrenceType === 'weekly' && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    aria-pressed={values.weekdays.includes(day)}
                    className={`flex size-10 items-center justify-center rounded-full border text-xs font-medium transition ${
                      values.weekdays.includes(day)
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-border text-ink-muted hover:bg-surface-sunken'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {values.kind !== 'today' && (
          <div>
            <label htmlFor="goal-deadline" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Deadline (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="goal-deadline"
                type="date"
                value={values.deadlineISO}
                onChange={(e) => setValues((v) => ({ ...v, deadlineISO: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent"
              />
              {values.deadlineISO && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setValues((v) => ({ ...v, deadlineISO: '' }))}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" size="lg" className="mt-2 w-full">
          {isEditing ? 'Save changes' : 'Add'}
        </Button>
      </form>
    </BottomSheet>
  )
}
