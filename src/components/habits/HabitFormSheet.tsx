import { useEffect, useState } from 'react'
import {
  Activity,
  BookOpen,
  Brain,
  Droplet,
  Dumbbell,
  Moon,
  PenLine,
  Salad,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import type { Habit, HabitFrequency } from '@/types/models'

export interface HabitFormValues {
  name: string
  description: string
  frequency: HabitFrequency
  icon: string
}

interface HabitFormSheetProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: HabitFormValues) => void
  initialHabit?: Habit | null
}

export const HABIT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  activity: Activity,
  book: BookOpen,
  brain: Brain,
  droplet: Droplet,
  dumbbell: Dumbbell,
  moon: Moon,
  pen: PenLine,
  salad: Salad,
  sun: Sun,
}

function emptyValues(): HabitFormValues {
  return { name: '', description: '', frequency: 'daily', icon: 'sparkles' }
}

function valuesFromHabit(habit: Habit): HabitFormValues {
  return { name: habit.name, description: habit.description ?? '', frequency: habit.frequency, icon: habit.icon ?? 'sparkles' }
}

export function HabitFormSheet({ open, onClose, onSubmit, initialHabit }: HabitFormSheetProps) {
  const [values, setValues] = useState<HabitFormValues>(emptyValues())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues(initialHabit ? valuesFromHabit(initialHabit) : emptyValues())
      setError(null)
    }
  }, [open, initialHabit])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.name.trim()) {
      setError('Give your habit a name.')
      return
    }
    onSubmit(values)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={initialHabit ? 'Edit habit' : 'New habit'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="habit-name" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Name
          </label>
          <input
            id="habit-name"
            type="text"
            autoFocus
            value={values.name}
            onChange={(e) => {
              setValues((v) => ({ ...v, name: e.target.value }))
              if (error) setError(null)
            }}
            placeholder="e.g. Drink water"
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        <div>
          <label htmlFor="habit-description" className="mb-1.5 block text-xs font-medium text-ink-muted">
            Notes (optional)
          </label>
          <textarea
            id="habit-description"
            rows={2}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-ink-muted">Frequency</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['daily', 'weekly'] as HabitFrequency[]).map((frequency) => (
              <button
                key={frequency}
                type="button"
                onClick={() => setValues((v) => ({ ...v, frequency }))}
                aria-pressed={values.frequency === frequency}
                className={`rounded-md border px-3 py-2.5 text-sm font-medium capitalize transition ${
                  values.frequency === frequency
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {frequency}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium text-ink-muted">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(HABIT_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setValues((v) => ({ ...v, icon: key }))}
                aria-pressed={values.icon === key}
                aria-label={key}
                className={`flex size-10 items-center justify-center rounded-full border transition ${
                  values.icon === key
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </fieldset>

        <Button type="submit" size="lg" className="mt-2 w-full">
          {initialHabit ? 'Save changes' : 'Add habit'}
        </Button>
      </form>
    </BottomSheet>
  )
}
