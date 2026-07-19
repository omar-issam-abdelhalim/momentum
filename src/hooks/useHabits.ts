import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/db'
import { getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import { computeHabitStreak } from '@/lib/logic/streaks'
import type { Habit } from '@/types/models'

export interface HabitWithState extends Habit {
  completedThisPeriod: boolean
  currentStreak: number
  bestStreak: number
}

export function useActiveHabits() {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const completions = useLiveQuery(() => db.habitCompletions.toArray(), [])

  if (!habits || !completions) return { loading: true as const, habits: [] as HabitWithState[] }

  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()

  const active = habits
    .filter((h) => h.active)
    .sort((a, b) => a.order - b.order)
    .map((habit): HabitWithState => {
      const periodId = habit.frequency === 'daily' ? todayISO : currentWeekId
      const completedThisPeriod = completions.some((c) => c.habitId === habit.id && c.periodId === periodId)
      const streak = computeHabitStreak(habit, completions, todayISO, currentWeekId)
      return { ...habit, completedThisPeriod, currentStreak: streak.current, bestStreak: streak.best }
    })

  return { loading: false as const, habits: active }
}

export function useAllHabits() {
  return useLiveQuery(() => db.habits.toArray(), [])
}

export function useAllCompletions() {
  return useLiveQuery(() => db.habitCompletions.toArray(), [])
}
