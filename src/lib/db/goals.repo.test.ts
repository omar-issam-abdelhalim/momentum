import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import {
  completeGoal,
  createGoal,
  decrementGoalProgress,
  incrementGoalProgress,
  uncompleteGoal,
  updateGoal,
} from './goals.repo'

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

describe('createGoal', () => {
  it('leaves targetCount/currentCount unset when no target is given — byte-for-byte binary behavior', async () => {
    const goal = await createGoal({ title: 'Plain task', kind: 'scheduled', scheduledDateISO: '2026-07-20' })
    expect(goal.targetCount).toBeUndefined()
    expect(goal.currentCount).toBeUndefined()
  })

  it('leaves targetCount unset when target is exactly 1', async () => {
    const goal = await createGoal({ title: 'Plain task', kind: 'scheduled', scheduledDateISO: '2026-07-20', targetCount: 1 })
    expect(goal.targetCount).toBeUndefined()
    expect(goal.currentCount).toBeUndefined()
  })

  it('sets targetCount and starts currentCount at 0 for a real counter target', async () => {
    const goal = await createGoal({ title: 'Read 5 chapters', kind: 'scheduled', scheduledDateISO: '2026-07-20', targetCount: 5 })
    expect(goal.targetCount).toBe(5)
    expect(goal.currentCount).toBe(0)
  })
})

describe('incrementGoalProgress / decrementGoalProgress', () => {
  it('increments by 1 up to target, then reports completion exactly once', async () => {
    const goal = await createGoal({ title: 'Drink 3 waters', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 3 })

    let result = await incrementGoalProgress(goal.id)
    expect(result.completed).toBe(false)
    expect((await db.goals.get(goal.id))?.currentCount).toBe(1)

    result = await incrementGoalProgress(goal.id)
    expect(result.completed).toBe(false)

    result = await incrementGoalProgress(goal.id)
    expect(result.completed).toBe(true)
    const final = await db.goals.get(goal.id)
    expect(final?.currentCount).toBe(3)
    expect(final?.completed).toBe(true)
    expect(final?.completedAt).not.toBeNull()
  })

  it('caps stored count at target — overshoot beyond target is a no-op', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 2 })
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id)
    const result = await incrementGoalProgress(goal.id) // third tap, already at target
    expect(result.completed).toBe(false) // already completed by the second tap, not a fresh crossing
    expect((await db.goals.get(goal.id))?.currentCount).toBe(2)
  })

  it('decrements floored at 0', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 3 })
    await decrementGoalProgress(goal.id)
    expect((await db.goals.get(goal.id))?.currentCount).toBe(0)
  })

  it('decrementing an already-completed goal below target un-completes it symmetrically', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 2 })
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id) // now complete, count 2
    expect((await db.goals.get(goal.id))?.completed).toBe(true)

    await decrementGoalProgress(goal.id) // undo one tap
    const after = await db.goals.get(goal.id)
    expect(after?.completed).toBe(false)
    expect(after?.completedAt).toBeNull()
    expect(after?.currentCount).toBe(1)
  })
})

describe('uncompleteGoal', () => {
  it('resets currentCount to 0 for a counter goal', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 3 })
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id) // complete, count 3

    await uncompleteGoal(goal.id)
    const after = await db.goals.get(goal.id)
    expect(after?.completed).toBe(false)
    expect(after?.currentCount).toBe(0)
  })

  it('does not touch currentCount for a binary goal', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20' })
    await completeGoal(goal.id)
    await uncompleteGoal(goal.id)
    const after = await db.goals.get(goal.id)
    expect(after?.completed).toBe(false)
    expect(after?.currentCount).toBeUndefined()
  })
})

describe('updateGoal — target edit edge cases', () => {
  it('auto-completes immediately when the target is edited downward onto/under the existing count, without requiring an undo', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 5 })
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id) // count = 4, target = 5, not complete

    await updateGoal(goal.id, { targetCount: 3 }) // lower target below current count
    const after = await db.goals.get(goal.id)
    expect(after?.completed).toBe(true)
    expect(after?.completedAt).not.toBeNull()
  })

  it('reducing target back to 1 (binary) while count > 0 marks it complete — the documented binary/counter conversion behavior', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 5 })
    await incrementGoalProgress(goal.id) // count = 1

    await updateGoal(goal.id, { targetCount: null })
    const after = await db.goals.get(goal.id)
    expect(after?.targetCount).toBeUndefined()
    expect(after?.completed).toBe(true)
  })

  it('never un-completes an already-completed goal when the target is edited upward', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20', targetCount: 2 })
    await incrementGoalProgress(goal.id)
    await incrementGoalProgress(goal.id) // complete

    await updateGoal(goal.id, { targetCount: 10 })
    const after = await db.goals.get(goal.id)
    expect(after?.completed).toBe(true)
    expect(after?.targetCount).toBe(10)
  })

  it('does not complete a goal just because a target was newly added with count still at 0', async () => {
    const goal = await createGoal({ title: 'Task', kind: 'today', scheduledDateISO: '2026-07-20' })
    await updateGoal(goal.id, { targetCount: 5 })
    const after = await db.goals.get(goal.id)
    expect(after?.completed).toBe(false)
    expect(after?.targetCount).toBe(5)
  })
})
