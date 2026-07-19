import { db } from './db'
import { createId } from '@/lib/id'
import { getCurrentWeekId, getTodayISO } from '@/lib/date/week'
import type { Habit, HabitCompletion, HabitFrequency } from '@/types/models'

export interface CreateHabitInput {
  name: string
  description?: string
  frequency: HabitFrequency
  icon?: string
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const count = await db.habits.count()
  const habit: Habit = {
    id: createId(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    frequency: input.frequency,
    icon: input.icon,
    order: count,
    active: true,
    createdAt: Date.now(),
  }
  await db.habits.add(habit)
  return habit
}

export interface UpdateHabitInput {
  name?: string
  description?: string
  frequency?: HabitFrequency
  icon?: string
}

export async function updateHabit(id: string, input: UpdateHabitInput): Promise<void> {
  const patch: Partial<Habit> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description.trim() || undefined
  if (input.frequency !== undefined) patch.frequency = input.frequency
  if (input.icon !== undefined) patch.icon = input.icon
  await db.habits.update(id, patch)
}

export async function deactivateHabit(id: string): Promise<void> {
  await db.habits.update(id, { active: false })
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
  return all.filter((h) => h.active).sort((a, b) => a.order - b.order)
}

export async function getAllHabits(): Promise<Habit[]> {
  return db.habits.toArray()
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
