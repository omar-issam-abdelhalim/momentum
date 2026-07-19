import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/db'
import { getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import { selectRelevantGoals, splitAndSortGoals } from '@/lib/logic/goalsQuery'

/** Live, sorted view of goals relevant to "right now" (current week + today), split into active/completed buckets. */
export function useHomeGoals() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])

  if (!goals) return { loading: true as const, active: [], completed: [] }

  const todayISO = getTodayISO()
  const currentWeekId = getCurrentWeekId()
  const relevant = selectRelevantGoals(goals, todayISO, currentWeekId)
  const { active, completed } = splitAndSortGoals(relevant)

  return { loading: false as const, active, completed }
}

export function useAllGoals() {
  return useLiveQuery(() => db.goals.toArray(), [])
}
