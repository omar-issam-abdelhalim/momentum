import { db } from './db'
import { getSettings } from './settings.repo'
import { getCurrentWeekId, getWeekIdsBetweenExclusiveStart, isNewWeek } from '@/lib/date/week'
import { applyRollover, buildWeeklySnapshot, getGoalsToRollover } from '@/lib/logic/rollover'

export interface RolloverResult {
  processedWeeks: string[]
  skippedWeeks: string[]
}

/**
 * Runs at app startup. Detects every custom week that closed since the app
 * was last opened (there may be more than one if the app was closed for a
 * while) and, for each in chronological order:
 *   1. Snapshots that week's planned/completed goal counts.
 *   2. Moves its incomplete weekly goals forward into the next week.
 *
 * Idempotent: a week is only processed if it doesn't already have a
 * snapshot, and each week's snapshot + goal moves + settings update commit
 * in a single IndexedDB transaction, so a closed week can never be
 * reprocessed (which would otherwise see its goals already moved and
 * produce a bogus empty snapshot).
 */
export async function runWeeklyRollover(): Promise<RolloverResult> {
  const settings = await getSettings()
  const currentWeekId = getCurrentWeekId()

  if (!isNewWeek(settings.lastWeekIdSeen)) {
    return { processedWeeks: [], skippedWeeks: [] }
  }

  if (settings.lastWeekIdSeen === null) {
    // Fresh install — nothing to close out, just start tracking from now.
    await db.settings.update('app', { lastWeekIdSeen: currentWeekId })
    return { processedWeeks: [], skippedWeeks: [] }
  }

  const sequence = [settings.lastWeekIdSeen, ...getWeekIdsBetweenExclusiveStart(settings.lastWeekIdSeen, currentWeekId)]

  const processedWeeks: string[] = []
  const skippedWeeks: string[] = []

  for (let i = 0; i < sequence.length - 1; i++) {
    const closingWeekId = sequence[i]
    const nextWeekId = sequence[i + 1]

    const alreadySnapshotted = await db.weeklySnapshots.get(closingWeekId)
    if (alreadySnapshotted) {
      skippedWeeks.push(closingWeekId)
      continue
    }

    const goalsInWeek = await db.goals.where('currentWeekId').equals(closingWeekId).toArray()
    const snapshot = buildWeeklySnapshot(closingWeekId, goalsInWeek)
    const toRoll = getGoalsToRollover(goalsInWeek).map((g) => applyRollover(g, nextWeekId))

    await db.transaction('rw', db.goals, db.weeklySnapshots, async () => {
      await db.weeklySnapshots.put(snapshot)
      if (toRoll.length > 0) await db.goals.bulkPut(toRoll)
    })

    processedWeeks.push(closingWeekId)
  }

  // Always converge settings to the true current week, even if every step
  // above was skipped (already processed) — keeps future calls cheap.
  await db.settings.update('app', { lastWeekIdSeen: currentWeekId })

  return { processedWeeks, skippedWeeks }
}
