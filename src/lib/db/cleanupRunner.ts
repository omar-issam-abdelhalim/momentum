import { db } from './db'
import { getSettings, setLastCleanupAt } from './settings.repo'
import { getGoalsEligibleForCleanup } from '@/lib/logic/cleanup'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export interface CleanupResult {
  ran: boolean
  deletedCount: number
}

/**
 * Runs at most once per day (cheap idempotency guard — the underlying
 * deletion is itself idempotent since already-deleted goals just won't
 * match on a future run).
 */
export async function runDataCleanup(force = false): Promise<CleanupResult> {
  const settings = await getSettings()
  const now = Date.now()

  if (!force && settings.lastCleanupAt && now - settings.lastCleanupAt < ONE_DAY_MS) {
    return { ran: false, deletedCount: 0 }
  }

  const allGoals = await db.goals.toArray()
  const eligible = getGoalsEligibleForCleanup(allGoals, now)

  if (eligible.length > 0) {
    await db.goals.bulkDelete(eligible.map((g) => g.id))
  }
  await setLastCleanupAt(now)

  return { ran: true, deletedCount: eligible.length }
}
