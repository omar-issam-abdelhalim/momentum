import { db } from './db'
import { createId } from '@/lib/id'
import { getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import { isCompletionAtTarget, targetForHabit } from '@/lib/logic/habitProgress'
import { clampCount } from '@/lib/logic/quantity'
import type { Habit, HabitCompletion, HabitFrequency } from '@/types/models'

/** Daily target only ever applies to daily-frequency habits (decision made with the user — weekly habits keep their existing single week-level completion with no quantity concept). Unset/≤1 = binary. */
function normalizeDailyTarget(frequency: HabitFrequency | undefined, dailyTarget: number | null | undefined): number | undefined {
  if (frequency !== 'daily') return undefined
  return dailyTarget && dailyTarget > 1 ? Math.floor(dailyTarget) : undefined
}

export interface CreateHabitInput {
  name: string
  description?: string
  frequency: HabitFrequency
  weekdays?: number[]
  icon?: string
  /** Optional daily counter-completion target. Ignored unless frequency === 'daily'. */
  dailyTarget?: number
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const count = await db.habits.count()
  const now = Date.now()
  const habit: Habit = {
    id: createId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    frequency: input.frequency,
    weekdays: input.frequency === 'daily' && input.weekdays?.length ? [...input.weekdays].sort() : undefined,
    dailyTarget: normalizeDailyTarget(input.frequency, input.dailyTarget),
    icon: input.icon,
    order: count,
    status: 'active',
    epochs: [{ id: createId(), startDate: now, endDate: null }],
    createdAt: now,
  }
  await db.habits.add(habit)
  return habit
}

export interface UpdateHabitInput {
  name?: string
  description?: string
  frequency?: HabitFrequency
  weekdays?: number[]
  icon?: string
  dailyTarget?: number | null
}

export async function updateHabit(id: string, input: UpdateHabitInput): Promise<void> {
  const patch: Partial<Habit> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description.trim() || undefined
  if (input.frequency !== undefined) patch.frequency = input.frequency
  if (input.icon !== undefined) patch.icon = input.icon

  if (input.frequency !== undefined || input.weekdays !== undefined || input.dailyTarget !== undefined) {
    const existing = await db.habits.get(id)
    const frequency = input.frequency ?? existing?.frequency

    if (input.frequency !== undefined || input.weekdays !== undefined) {
      patch.weekdays = frequency === 'daily' && input.weekdays?.length ? [...input.weekdays].sort() : undefined
    }
    if (input.frequency !== undefined || input.dailyTarget !== undefined) {
      const dailyTargetInput = input.dailyTarget !== undefined ? input.dailyTarget : existing?.dailyTarget
      patch.dailyTarget = normalizeDailyTarget(frequency, dailyTargetInput)
    }
  }

  await db.habits.update(id, patch)
}

/**
 * Closes the habit's currently open epoch and marks it paused. Finalizes
 * that epoch's statistics simply by fixing its endDate — stats themselves
 * stay derived (see lib/logic/epochs.ts), so nothing else needs to be
 * written. No-op if the habit is already paused or has no open epoch. Any
 * partial-progress HabitCompletion row for today is left exactly as-is —
 * pause has never touched completion records, and epoch-bounded due-period
 * logic already excludes it from a future epoch's window.
 */
export async function pauseHabit(id: string): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit || habit.status === 'paused') return
  const now = Date.now()
  const epochs = habit.epochs.map((e) => (e.endDate === null ? { ...e, endDate: now } : e))
  await db.habits.update(id, { status: 'paused', epochs })
}

/**
 * Opens a brand-new epoch starting now, with the streak reset to zero —
 * never reopens or continues the epoch that was closed by the last pause,
 * even if resumed the same day. No-op if the habit is already active.
 */
export async function resumeHabit(id: string): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit || habit.status === 'active') return
  const now = Date.now()
  const epochs = [...habit.epochs, { id: createId(), startDate: now, endDate: null }]
  await db.habits.update(id, { status: 'active', epochs })
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction('rw', db.habits, db.habitCompletions, async () => {
    await db.habits.delete(id)
    const completions = await db.habitCompletions.where('habitId').equals(id).toArray()
    await db.habitCompletions.bulkDelete(completions.map((c) => c.id))
  })
}

export async function getActiveHabits(): Promise<Habit[]> {
  const all = await db.habits.toArray()
  return all.filter((h) => h.status === 'active').sort((a, b) => a.order - b.order)
}

export async function getPausedHabits(): Promise<Habit[]> {
  const all = await db.habits.toArray()
  return all.filter((h) => h.status === 'paused').sort((a, b) => a.order - b.order)
}

export async function getAllHabits(): Promise<Habit[]> {
  return db.habits.toArray()
}

export async function getHabit(id: string): Promise<Habit | undefined> {
  return db.habits.get(id)
}

function periodIdFor(habit: Habit): string {
  return habit.frequency === 'daily' ? getTodayISO() : getCurrentWeekId()
}

function getCompletionRecord(habitId: string, periodId: string): Promise<HabitCompletion | undefined> {
  return db.habitCompletions.where('[habitId+periodId]').equals([habitId, periodId]).first()
}

export async function isHabitCompleteForCurrentPeriod(habit: Habit): Promise<boolean> {
  const periodId = periodIdFor(habit)
  const record = await getCompletionRecord(habit.id, periodId)
  return isCompletionAtTarget(record, targetForHabit(habit))
}

/**
 * Generic mark-fully-done/not-done toggle. For a binary habit (target 1,
 * the vast majority of habits) this is the only completion pathway and
 * writes exactly the same row shape it always has — no `count` field, ever.
 * For a counter habit this jumps straight between "cleared" and "fully at
 * target"; the primary UI interaction for a counter habit is
 * incrementHabitProgress/decrementHabitProgress instead (see below).
 */
export async function toggleHabitCompletion(habit: Habit): Promise<'completed' | 'uncompleted'> {
  const periodId = periodIdFor(habit)
  const target = targetForHabit(habit)
  const existing = await getCompletionRecord(habit.id, periodId)

  if (isCompletionAtTarget(existing, target)) {
    if (existing) await db.habitCompletions.delete(existing.id)
    return 'uncompleted'
  }

  if (existing) {
    await db.habitCompletions.update(existing.id, { count: target })
  } else {
    const completion: HabitCompletion = {
      id: createId(),
      habitId: habit.id,
      periodId,
      completedAt: Date.now(),
      count: target > 1 ? target : undefined,
    }
    await db.habitCompletions.add(completion)
  }
  return 'completed'
}

/** Increments a daily counter habit's progress for today by 1 (capped at target). Reaching target completes the day through the same completion record every other habit check uses. Returns whether this call just crossed the target. */
export async function incrementHabitProgress(habit: Habit): Promise<{ completed: boolean }> {
  const periodId = periodIdFor(habit)
  const target = targetForHabit(habit)
  const existing = await getCompletionRecord(habit.id, periodId)
  const wasComplete = isCompletionAtTarget(existing, target)
  const previousCount = existing ? (existing.count ?? target) : 0
  const newCount = clampCount(previousCount + 1, target)

  if (existing) {
    await db.habitCompletions.update(existing.id, { count: newCount })
  } else {
    const completion: HabitCompletion = { id: createId(), habitId: habit.id, periodId, completedAt: Date.now(), count: newCount }
    await db.habitCompletions.add(completion)
  }

  return { completed: !wasComplete && newCount >= target }
}

/** Decrements a daily counter habit's progress for today by 1, floored at 0 — the undo mechanic for accidental extra taps. Dropping to 0 removes the completion row entirely, so "no progress" is represented identically to how it always has been: no row. */
export async function decrementHabitProgress(habit: Habit): Promise<void> {
  const periodId = periodIdFor(habit)
  const target = targetForHabit(habit)
  const existing = await getCompletionRecord(habit.id, periodId)
  if (!existing) return

  const previousCount = existing.count ?? target
  const newCount = Math.max(0, previousCount - 1)

  if (newCount <= 0) {
    await db.habitCompletions.delete(existing.id)
  } else {
    await db.habitCompletions.update(existing.id, { count: newCount })
  }
}

export async function getCompletionsForHabit(habitId: string): Promise<HabitCompletion[]> {
  return db.habitCompletions.where('habitId').equals(habitId).toArray()
}

export async function getAllCompletions(): Promise<HabitCompletion[]> {
  return db.habitCompletions.toArray()
}
