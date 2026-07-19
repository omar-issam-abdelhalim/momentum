import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { getTodayISO } from '@/lib/date/week'
import type { Goal, GoalType } from '@/types/models'

export interface GoalFormValues {
  title: string
  description: string
  type: GoalType
  dateISO: string
  deadlineISO: string
}

interface GoalFormSheetProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: GoalFormValues) => void
  initialGoal?: Goal | null
}

function emptyValues(): GoalFormValues {
  return { title: '', description: '', type: 'weekly', dateISO: getTodayISO(), deadlineISO: '' }
}

function valuesFromGoal(goal: Goal): GoalFormValues {
  return {
    title: goal.title,
    description: goal.description ?? '',
    type: goal.type,
    dateISO: goal.dateISO ?? getTodayISO(),
    deadlineISO: goal.deadlineISO ?? '',
  }
}

export function GoalFormSheet({ open, onClose, onSubmit, initialGoal }: GoalFormSheetProps) {
  const [values, setValues] = useState<GoalFormValues>(emptyValues())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(initialGoal ? valuesFromGoal(initialGoal) : emptyValues())
      setError(null)
    }
  }, [open, initialGoal])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.title.trim()) {
      setError('Give your goal a title.')
      return
    }
    onSubmit(values)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={initialGoal ? 'Edit goal' : 'New goal'}>
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
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
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

        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-ink-muted">Type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['weekly', 'daily'] as GoalType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setValues((v) => ({ ...v, type }))}
                aria-pressed={values.type === type}
                className={`rounded-md border px-3 py-2.5 text-sm font-medium capitalize transition ${
                  values.type === type
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </fieldset>

        {values.type === 'daily' && (
          <div>
            <label htmlFor="goal-date" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Date
            </label>
            <input
              id="goal-date"
              type="date"
              value={values.dateISO}
              onChange={(e) => setValues((v) => ({ ...v, dateISO: e.target.value }))}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent"
            />
          </div>
        )}

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
              <Button type="button" variant="secondary" size="md" onClick={() => setValues((v) => ({ ...v, deadlineISO: '' }))}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <Button type="submit" size="lg" className="mt-2 w-full">
          {initialGoal ? 'Save changes' : 'Add goal'}
        </Button>
      </form>
    </BottomSheet>
  )
}
