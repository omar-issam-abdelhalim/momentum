import { db } from './db'
import { createId } from '@/lib/id'
import { formatDateOnly, getTodayISO } from '@/lib/date/week'
import { previousDayISO } from '@/lib/logic/streaks'
import { datesNeedingOccurrence } from '@/lib/logic/recurrence'
import { getActiveRecurringDefinitions } from './recurring.repo'
import type { Goal, RecurringDefinition } from '@/types/models'

export interface RecurringGenResult {
  createdCount: number
}

function buildOccurrence(def: RecurringDefinition, dateISO: string): Goal {
  return {
    id: createId(),
    title: def.title,
    description: def.description,
    kind: 'recurring',
    scheduledDateISO: dateISO,
    priority: def.priority,
    createdAt: Date.now(),
    completedAt: null,
    completed: false,
    rolledOver: false,
    rolloverCount: 0,
    recurringDefinitionId: def.id,
    archived: false,
  }
}

/**
 * Runs at app startup (after rollover). For every active RecurringDefinition,
 * generates one independent occurrence Goal for each matching calendar day
 * between its generation cursor and today (inclusive), then advances the
 * cursor. Idempotent: re-running with an unchanged "today" generates nothing
 * further, since the cursor already covers that range — no date is ever
 * revisited, so no duplicate occurrence can be created. A still-incomplete
 * (Late) past occurrence is never touched by this run; a new occurrence for
 * today/this week is still created independently.
 */
export async function runRecurringGeneration(): Promise<RecurringGenResult> {
  const todayISO = getTodayISO()
  const definitions = await getActiveRecurringDefinitions()

  let createdCount = 0

  for (const def of definitions) {
    const baseline = def.lastGeneratedThroughISO ?? previousDayISO(formatDateOnly(new Date(def.createdAt)))
    const dates = datesNeedingOccurrence(def, baseline, todayISO)

    if (dates.length === 0) {
      if (def.lastGeneratedThroughISO !== todayISO) {
        await db.recurringDefinitions.update(def.id, { lastGeneratedThroughISO: todayISO })
      }
      continue
    }

    const occurrences = dates.map((dateISO) => buildOccurrence(def, dateISO))

    await db.transaction('rw', db.goals, db.recurringDefinitions, async () => {
      await db.goals.bulkAdd(occurrences)
      await db.recurringDefinitions.update(def.id, { lastGeneratedThroughISO: todayISO })
    })

    createdCount += occurrences.length
  }

  return { createdCount }
}
