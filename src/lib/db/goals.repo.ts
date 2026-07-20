import { db } from './db'
import { createId } from '@/lib/id'
import { getCurrentWeekId } from '@/lib/date/week'
import type { Goal, GoalKind, Priority } from '@/types/models'

export interface CreateGoalInput {
  title: string
  description?: string
  kind: GoalKind
  /** Required for 'scheduled' and 'today'; ignored for 'weekly' and 'recurring' (set by the recurrence engine). */
  scheduledDateISO?: string
  deadlineISO?: string
  priority?: Priority
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const now = Date.now()
  const isWeekly = input.kind === 'weekly'
  const goal: Goal = {
    id: createId(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    kind: input.kind,
    scheduledDateISO: isWeekly ? undefined : input.scheduledDateISO,
    deadlineISO: input.deadlineISO || undefined,
    priority: input.priority,
    createdAt: now,
    completedAt: null,
    completed: false,
    originalWeekId: isWeekly ? getCurrentWeekId() : undefined,
    currentWeekId: isWeekly ? getCurrentWeekId() : undefined,
    rolledOver: false,
    rolloverCount: 0,
    archived: false,
  }
  await db.goals.add(goal)
  return goal
}

export interface UpdateGoalInput {
  title?: string
  description?: string
  scheduledDateISO?: string
  deadlineISO?: string | null
  priority?: Priority
}

export async function updateGoal(id: string, input: UpdateGoalInput): Promise<void> {
  const patch: Partial<Goal> = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.description !== undefined) patch.description = input.description.trim() || undefined
  if (input.scheduledDateISO !== undefined) patch.scheduledDateISO = input.scheduledDateISO
  if (input.deadlineISO !== undefined) patch.deadlineISO = input.deadlineISO ?? undefined
  if (input.priority !== undefined) patch.priority = input.priority
  await db.goals.update(id, patch)
}

export async function completeGoal(id: string): Promise<void> {
  await db.goals.update(id, { completed: true, completedAt: Date.now() })
}

export async function uncompleteGoal(id: string): Promise<void> {
  await db.goals.update(id, { completed: false, completedAt: null })
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id)
}

export async function archiveGoal(id: string): Promise<void> {
  await db.goals.update(id, { archived: true })
}

export async function getActiveGoals(): Promise<Goal[]> {
  const all = await db.goals.toArray()
  return all.filter((g) => !g.archived)
}

export async function getGoalById(id: string): Promise<Goal | undefined> {
  return db.goals.get(id)
}

export async function getGoalsForWeek(weekId: string): Promise<Goal[]> {
  const goals = await db.goals.where('currentWeekId').equals(weekId).toArray()
  return goals.filter((g) => !g.archived)
}

export async function getGoalsForDate(dateISO: string): Promise<Goal[]> {
  const goals = await db.goals.where('scheduledDateISO').equals(dateISO).toArray()
  return goals.filter((g) => !g.archived)
}
