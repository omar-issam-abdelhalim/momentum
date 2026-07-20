import { db } from './db'
import { formatDateOnly, weekIdToRange } from '@/lib/date/week'
import type { Goal } from '@/types/models'

/**
 * Gathers every goal relevant to `weekId`'s snapshot: weekly goals in the
 * week, plus any goal whose scheduled date or deadline falls within it.
 * Shared by the rollover runner (closing a past week) and the live
 * current-week Analytics view (an open week that has no snapshot yet).
 */
export async function gatherSnapshotPool(weekId: string): Promise<Goal[]> {
  const { start, end } = weekIdToRange(weekId)
  const weekStartISO = formatDateOnly(start)
  const weekEndISO = formatDateOnly(end)

  const [weeklyInWeek, scheduledInWeek, deadlineInWeek] = await Promise.all([
    db.goals.where('currentWeekId').equals(weekId).toArray(),
    db.goals.where('scheduledDateISO').between(weekStartISO, weekEndISO, true, true).toArray(),
    db.goals.where('deadlineISO').between(weekStartISO, weekEndISO, true, true).toArray(),
  ])

  const byId = new Map<string, Goal>()
  for (const g of [...weeklyInWeek, ...scheduledInWeek, ...deadlineInWeek]) byId.set(g.id, g)
  return [...byId.values()]
}
