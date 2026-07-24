import { db } from './db'
import { createId } from '@/lib/id'
import { getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import type { Habit, HabitCompletion, HabitFrequency } from '@/types/models'

export interface CreateHabitInput {
  name: string
  description?: string
  frequency: HabitFrequency
  weekdays?: number[]
  icon?: string
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
}

export async function updateHabit(id: string, input: UpdateHabitInput): Promise<void> {
  const patch: Partial<Habit> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description.trim() || undefined
  if (input.frequency !== undefined) patch.frequency = input.frequency
  if (input.icon !== undefined) patch.icon = input.icon
  if (input.frequency !== undefined || input.weekdays !== undefined) {
    const frequency = input.frequency ?? (await db.habits.get(id))?.frequency
    patch.weekdays = frequency === 'daily' && input.weekdays?.length ? [...input.weekdays].sort() : undefined
  }
  await db.habits.update(id, patch)
}

/**
 * Closes the habit's currently open epoch and marks it paused. Finalizes
 * that epoch's statistics simply by fixing its endDate — stats themselves
 * stay derived (see lib/logic/epochs.ts), so nothing else needs to be
 * written. No-op if the habit is already paused or has no open epoch.
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

export async function isHabitCompleteForCurrentPeriod(habit: Habit): Promise<boolean> {
  const periodId = periodIdFor(habit)
  const match = await db.habitCompletions.where('[habitId+periodId]').equals([habit.id, periodId]).first()
  return !!match
}

export async function toggleHabitCompletion(habit: Habit): Promise<'completed' | 'uncompleted'> {
  const periodId = periodIdFor(habit)
  const existing = await db.habitCompletions.where('[habitId+periodId]').equals([habit.id, periodId]).first()
  if (existing) {
    await db.habitCompletions.delete(existing.id)
    return 'uncompleted'
  }
  const completion: HabitCompletion = {
    id: createId(),
    habitId: habit.id,
    periodId,
    completedAt: Date.now(),
  }
  await db.habitCompletions.add(completion)
  return 'completed'
}

export async function getCompletionsForHabit(habitId: string): Promise<HabitCompletion[]> {
  return db.habitCompletions.where('habitId').equals(habitId).toArray()
}

export async function getAllCompletions(): Promise<HabitCompletion[]> {
  return db.habitCompletions.toArray()
}
