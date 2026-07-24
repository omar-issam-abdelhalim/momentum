import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/db'
import { getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import { computeEpochStats, getOpenEpoch } from '@/lib/logic/epochs'
import { isHabitDueOnDate } from '@/lib/logic/habitSchedule'
import type { Habit, HabitCompletion } from '@/types/models'

export interface HabitWithState extends Habit {
  completedThisPeriod: boolean
  /** True for weekly-frequency habits (always "in progress" for the week) and for daily habits due today per their schedule. */
  dueToday: boolean
  currentStreak: number
  bestStreak: number
}

function withState(habit: Habit, completions: HabitCompletion[], todayISO: string, currentWeekId: string): HabitWithState {
  const periodId = habit.frequency === 'daily' ? todayISO : currentWeekId
  const completedThisPeriod = completions.some((c) => c.habitId === habit.id && c.periodId === periodId)
  const dueToday = habit.frequency === 'weekly' || isHabitDueOnDate(habit, todayISO)

  const openEpoch = getOpenEpoch(habit)
  const stats = openEpoch ? computeEpochStats(habit, openEpoch, completions, todayISO, currentWeekId) : null

  return {
    ...habit,
    completedThisPeriod,
    dueToday,
    currentStreak: stats?.currentStreak ?? 0,
    bestStreak: stats?.bestStreak ?? 0,
  }
}

/** Active-status habits only, sorted for display. Each carries an open-epoch-bounded streak — never spans a prior pause. */
export function useActiveHabits() {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), [])

  if (!habits || !completions) return { loading: true as const, habits: [] as HabitWithState[] }

  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()

  const active = habits
    .filter((h) => h.status === 'active')
    .sort((a, b) => a.order - b.order)
    .map((habit) => withState(habit, completions, todayISO, currentWeekId))

  return { loading: false as const, habits: active }
}

/** Paused-status habits, sorted for display. Streak/completedThisPeriod are frozen (no open epoch to bound them to). */
export function usePausedHabits() {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), [])

  if (!habits || !completions) return { loading: true as const, habits: [] as HabitWithState[] }

  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()

  const paused = habits
    .filter((h) => h.status === 'paused')
    .sort((a, b) => a.order - b.order)
    .map((habit) => withState(habit, completions, todayISO, currentWeekId))

  return { loading: false as const, habits: paused }
}

export function useAllHabits() {
  return useLiveQuery(() => db.habits.toArray(), [])
}

export function useHabit(id: string | null) {
  return useLiveQuery(() => (id ? db.habits.get(id) : undefined), [id])
}

export function useAllCompletions() {
  return useLiveQuery(() => db.habitCompletions.toArray(), [])
}
