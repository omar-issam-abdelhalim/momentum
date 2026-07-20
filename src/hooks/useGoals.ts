import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/db'
import { getCurrentWeekId, getTodayISO, weekIdToRange } from '@/lib/date/week'
import { selectRelevantGoals, splitAndSortGoals } from '@/lib/logic/goalsQuery'

/** Live, sorted view of goals relevant to "right now" (active items + anything completed this custom week), split into active/completed buckets. */
export function useHomeGoals() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])

  if (!goals) return { loading: true as const, active: [], completed: [] }

  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()
  const { start, end } = weekIdToRange(currentWeekId)
  const relevant = selectRelevantGoals(goals, todayISO, currentWeekId, start.getTime(), end.getTime())
  const { active, completed } = splitAndSortGoals(relevant, todayISO)

  return { loading: false as const, active, completed }
}

export function useAllGoals() {
  return useLiveQuery(() => db.goals.toArray(), [])
}

export function useRecurringDefinitions() {
  return useLiveQuery(() => db.recurringDefinitions.toArray(), [])
}
