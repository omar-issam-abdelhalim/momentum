import { useState } from 'react'
import { CalendarCheck, ChevronDown, Flag, ListChecks, Plus, Sparkles } from 'lucide-react'
import { useHomeGoals } from '@/hooks/useGoals'
import { useActiveHabits, type HabitWithState } from '@/hooks/useHabits'
import { useToast } from '@/components/ui/Toast'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormSheet, type GoalFormValues } from '@/components/goals/GoalFormSheet'
import { HabitCard } from '@/components/habits/HabitCard'
import { HabitFormSheet, type HabitFormValues } from '@/components/habits/HabitFormSheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionSheet } from '@/components/ui/ActionSheet'
import { formatWeekRangeLabel, getCurrentWeekId } from '@/lib/date/week'
import { formatLongDate } from '@/lib/date/format'
import {
  completeGoal,
  createGoal,
  deleteGoal as deleteGoalRepo,
  uncompleteGoal,
  updateGoal,
} from '@/lib/db/goals.repo'
import { createHabit, deleteHabit as deleteHabitRepo, toggleHabitCompletion, updateHabit } from '@/lib/db/habits.repo'
import type { Goal } from '@/types/models'

export function HomeScreen() {
  const { loading: goalsLoading, active: activeGoals, completed: completedGoals } = useHomeGoals()
  const { loading: habitsLoading, habits } = useActiveHabits()
  const { showToast } = useToast()

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [habitFormOpen, setHabitFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editingHabit, setEditingHabit] = useState<HabitWithState | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<HabitWithState | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const weeklyGoals = [...activeGoals, ...completedGoals].filter((g) => g.type === 'weekly')
  const weeklyCompleted = weeklyGoals.filter((g) => g.completed).length
  const weeklyProgress = weeklyGoals.length === 0 ? 0 : Math.round((weeklyCompleted / weeklyGoals.length) * 100)

  const handleToggleGoal = async (goal: Goal) => {
    if (goal.completed) {
      await uncompleteGoal(goal.id)
      return
    }
    await completeGoal(goal.id)
    showToast('Goal completed', { label: 'Undo', onAction: () => void uncompleteGoal(goal.id) })
  }

  const handleDeleteGoal = async () => {
    if (!deletingGoal) return
    await deleteGoalRepo(deletingGoal.id)
    setDeletingGoal(null)
    showToast('Goal deleted')
  }

  const handleGoalSubmit = async (values: GoalFormValues) => {
    if (editingGoal) {
      await updateGoal(editingGoal.id, {
        title: values.title,
        description: values.description,
        type: values.type,
        dateISO: values.type === 'daily' ? values.dateISO : undefined,
        deadlineISO: values.deadlineISO || null,
      })
      showToast('Goal updated')
    } else {
      await createGoal({
        title: values.title,
        description: values.description,
        type: values.type,
        dateISO: values.type === 'daily' ? values.dateISO : undefined,
        deadlineISO: values.deadlineISO || undefined,
      })
      showToast('Goal added')
    }
    setGoalFormOpen(false)
    setEditingGoal(null)
  }

  const handleToggleHabit = async (habit: HabitWithState) => {
    const result = await toggleHabitCompletion(habit)
    if (result === 'completed') showToast(`${habit.name} marked done`)
  }

  const handleDeleteHabit = async () => {
    if (!deletingHabit) return
    await deleteHabitRepo(deletingHabit.id)
    setDeletingHabit(null)
    showToast('Habit deleted')
  }

  const handleHabitSubmit = async (values: HabitFormValues) => {
    if (editingHabit) {
      await updateHabit(editingHabit.id, values)
      showToast('Habit updated')
    } else {
      await createHabit(values)
      showToast('Habit added')
    }
    setHabitFormOpen(false)
    setEditingHabit(null)
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 safe-top">
      <header className="mb-6">
        <p className="text-sm font-medium text-ink-muted">{formatLongDate(new Date())}</p>
        <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-raised p-4 shadow-soft">
          <div>
            <h1 className="text-lg font-semibold text-ink">This week</h1>
            <p className="text-sm text-ink-muted">{formatWeekRangeLabel(getCurrentWeekId())}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {weeklyCompleted} of {weeklyGoals.length} weekly goals complete
            </p>
          </div>
          <ProgressRing percent={weeklyProgress} />
        </div>
      </header>

      <section aria-labelledby="goals-heading" className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Flag size={16} className="text-ink-faint" aria-hidden="true" />
          <h2 id="goals-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Goals
          </h2>
        </div>

        {!goalsLoading && activeGoals.length === 0 && completedGoals.length === 0 && (
          <EmptyState icon={CalendarCheck} title="Your week is clear." description="Add a goal to get started." />
        )}

        <div className="flex flex-col gap-2">
          {activeGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onToggleComplete={handleToggleGoal}
              onEdit={(g) => {
                setEditingGoal(g)
                setGoalFormOpen(true)
              }}
              onDelete={(g) => setDeletingGoal(g)}
            />
          ))}
        </div>

        {completedGoals.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
            >
              <ChevronDown size={14} className={`transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
              {completedGoals.length} completed
            </button>
            {showCompleted && (
              <div className="mt-2 flex flex-col gap-2">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onToggleComplete={handleToggleGoal}
                    onEdit={(g) => {
                      setEditingGoal(g)
                      setGoalFormOpen(true)
                    }}
                    onDelete={(g) => setDeletingGoal(g)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="habits-heading">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks size={16} className="text-ink-faint" aria-hidden="true" />
          <h2 id="habits-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Habits
          </h2>
        </div>

        {!habitsLoading && habits.length === 0 && (
          <EmptyState icon={Sparkles} title="No habits added yet." description="Track daily or weekly routines here." />
        )}

        <div className="flex flex-col gap-2">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onToggle={handleToggleHabit}
              onEdit={(h) => {
                setEditingHabit(h)
                setHabitFormOpen(true)
              }}
              onDelete={(h) => setDeletingHabit(h)}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setAddMenuOpen(true)}
        aria-label="Add goal or habit"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)+1rem)] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-raised active:scale-95"
      >
        <Plus size={26} />
      </button>

      <ActionSheet
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title="Add"
        items={[
          { label: 'New goal', icon: Flag, onSelect: () => setGoalFormOpen(true) },
          { label: 'New habit', icon: Sparkles, onSelect: () => setHabitFormOpen(true) },
        ]}
      />

      <GoalFormSheet
        open={goalFormOpen}
        onClose={() => {
          setGoalFormOpen(false)
          setEditingGoal(null)
        }}
        onSubmit={handleGoalSubmit}
        initialGoal={editingGoal}
      />

      <HabitFormSheet
        open={habitFormOpen}
        onClose={() => {
          setHabitFormOpen(false)
          setEditingHabit(null)
        }}
        onSubmit={handleHabitSubmit}
        initialHabit={editingHabit}
      />

      <ConfirmDialog
        open={!!deletingGoal}
        title="Delete goal?"
        description={`"${deletingGoal?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteGoal}
        onCancel={() => setDeletingGoal(null)}
      />

      <ConfirmDialog
        open={!!deletingHabit}
        title="Delete habit?"
        description={`"${deletingHabit?.name}" and its history will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteHabit}
        onCancel={() => setDeletingHabit(null)}
      />
    </div>
  )
}
