import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { runRecurringGeneration } from './recurringRunner'
import { createRecurringDefinition } from './recurring.repo'

async function resetDb() {
  await db.goals.clear()
  await db.recurringDefinitions.clear()
  await db.habits.clear()
  await db.habitCompletions.clear()
  await db.weeklySnapshots.clear()
  await db.settings.clear()
}

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runRecurringGeneration', () => {
  it('generates an occurrence for a daily definition on the day it is created', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20)) // 2026-07-20
    await createRecurringDefinition({ title: 'Drink water reminder', recurrenceType: 'daily' })

    const result = await runRecurringGeneration()
    expect(result.createdCount).toBe(1)

    const occurrences = await db.goals.where('kind').equals('recurring').toArray()
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].scheduledDateISO).toBe('2026-07-20')
  })

  it('is idempotent: running again the same day creates nothing new', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    await createRecurringDefinition({ title: 'Drink water reminder', recurrenceType: 'daily' })

    await runRecurringGeneration()
    const result = await runRecurringGeneration()

    expect(result.createdCount).toBe(0)
    expect(await db.goals.count()).toBe(1)
  })

  it('generates a new occurrence for today even while an earlier occurrence remains uncompleted (Late)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 21)) // Tuesday, 2026-07-21
    const def = await createRecurringDefinition({ title: 'Study Tuesday lecture', recurrenceType: 'weekly', weekdays: [2] })
    await runRecurringGeneration()

    let occurrences = await db.goals.where('recurringDefinitionId').equals(def.id).toArray()
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].scheduledDateISO).toBe('2026-07-21')

    // A week later — the July 21 occurrence is left untouched (still incomplete/Late).
    vi.setSystemTime(new Date(2026, 6, 28)) // Tuesday, 2026-07-28
    const result = await runRecurringGeneration()
    expect(result.createdCount).toBe(1)

    occurrences = await db.goals.where('recurringDefinitionId').equals(def.id).toArray()
    expect(occurrences).toHaveLength(2)
    const dates = occurrences.map((o) => o.scheduledDateISO).sort()
    expect(dates).toEqual(['2026-07-21', '2026-07-28'])

    const firstOccurrence = occurrences.find((o) => o.scheduledDateISO === '2026-07-21')
    expect(firstOccurrence?.completed).toBe(false) // untouched, still Late
  })

  it('never generates occurrences for an inactive definition', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 20))
    const def = await createRecurringDefinition({ title: 'Paused task', recurrenceType: 'daily' })
    await db.recurringDefinitions.update(def.id, { active: false })

    const result = await runRecurringGeneration()
    expect(result.createdCount).toBe(0)
  })

  it('copies the definition targetCount onto each occurrence, each starting its own independent count at 0', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 21)) // Tuesday, 2026-07-21
    const def = await createRecurringDefinition({
      title: 'Drink 3 waters',
      recurrenceType: 'weekly',
      weekdays: [2],
      targetCount: 3,
    })
    await runRecurringGeneration()

    let occurrences = await db.goals.where('recurringDefinitionId').equals(def.id).toArray()
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].targetCount).toBe(3)
    expect(occurrences[0].currentCount).toBe(0)

    // Bump the first occurrence's count partway, and leave it Late/incomplete.
    await db.goals.update(occurrences[0].id, { currentCount: 2 })

    // A week later, a second independent occurrence is generated.
    vi.setSystemTime(new Date(2026, 6, 28)) // Tuesday, 2026-07-28
    await runRecurringGeneration()

    occurrences = await db.goals.where('recurringDefinitionId').equals(def.id).toArray()
    expect(occurrences).toHaveLength(2)
    const first = occurrences.find((o) => o.scheduledDateISO === '2026-07-21')
    const second = occurrences.find((o) => o.scheduledDateISO === '2026-07-28')
    // The Late occurrence's partial count is untouched...
    expect(first?.currentCount).toBe(2)
    expect(first?.completed).toBe(false)
    // ...and never leaked into the new occurrence's independent count.
    expect(second?.currentCount).toBe(0)
    expect(second?.targetCount).toBe(3)
  })
})
