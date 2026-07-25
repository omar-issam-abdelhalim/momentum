import { db } from './db'
import { createId } from '@/lib/id'
import { getCurrentWeekId } from '@/lib/date/week'
import { clampCount, effectiveTarget } from '@/lib/logic/quantity'
import type { Goal, GoalKind, Priority } from '@/types/models'

/** Normalizes a raw target-count input to storage form: undefined/1/≤1 all collapse to `undefined` (binary). Enforces the "minimum of 1" edge case. */
function normalizeTargetCount(targetCount: number | null | undefined): number | undefined {
  return targetCount && targetCount > 1 ? Math.floor(targetCount) : undefined
}

export interface CreateGoalInput {
  title: string
  description?: string
  kind: GoalKind
  /** Required for 'scheduled' and 'today'; ignored for 'weekly' and 'recurring' (set by the recurrence engine). */
  scheduledDateISO?: string
  deadlineISO?: string
  priority?: Priority
  /** Optional counter-completion target. Unset/1 = today's exact single-tap-to-complete behavior. */
  targetCount?: number
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const now = Date.now()
  const isWeekly = input.kind === 'weekly'
  const targetCount = normalizeTargetCount(input.targetCount)
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
    targetCount,
    currentCount: targetCount ? 0 : undefined,
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
  /** `null` clears it back to unset/binary. Editing downward onto/under the existing count auto-completes the goal (no undo required); editing upward never un-completes an already-completed goal. */
  targetCount?: number | null
}

export async function updateGoal(id: string, input: UpdateGoalInput): Promise<void> {
  const patch: Partial<Goal> = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.description !== undefined) patch.description = input.description.trim() || undefined
  if (input.scheduledDateISO !== undefined) patch.scheduledDateISO = input.scheduledDateISO
  if (input.deadlineISO !== undefined) patch.deadlineISO = input.deadlineISO ?? undefined
  if (input.priority !== undefined) patch.priority = input.priority

  if (input.targetCount !== undefined) {
    const newTarget = normalizeTargetCount(input.targetCount)
    patch.targetCount = newTarget
    const goal = await db.goals.get(id)
    if (goal && !goal.completed) {
      const currentCount = goal.currentCount ?? 0
      if (currentCount >= effectiveTarget(newTarget)) {
        patch.completed = true
        patch.completedAt = Date.now()
      }
    }
  }

  await db.goals.update(id, patch)
}

export async function completeGoal(id: string): Promise<void> {
  await db.goals.update(id, { completed: true, completedAt: Date.now() })
}

/** Un-completes a goal. For a counter goal, also resets currentCount to 0 — undoing the whole completion starts the count fresh rather than leaving it stuck at/above target (long-press undoes one tap at a time instead; see incrementGoalProgress/decrementGoalProgress). */
export async function uncompleteGoal(id: string): Promise<void> {
  const goal = await db.goals.get(id)
  const patch: Partial<Goal> = { completed: false, completedAt: null }
  if (goal?.targetCount && goal.targetCount > 1) {
    patch.currentCount = 0
  }
  await db.goals.update(id, patch)
}

/** Increments a counter goal's progress by 1 (capped at target). Reaching target completes it via the same pathway `completeGoal` uses. Returns whether this call just crossed the target, so the UI can show a completion toast. */
export async function incrementGoalProgress(id: string): Promise<{ completed: boolean }> {
  const goal = await db.goals.get(id)
  if (!goal) return { completed: false }
  const target = effectiveTarget(goal.targetCount)
  const newCount = clampCount((goal.currentCount ?? 0) + 1, target)
  const justCompleted = !goal.completed && newCount >= target
  const patch: Partial<Goal> = { currentCount: newCount }
  if (justCompleted) {
    patch.completed = true
    patch.completedAt = Date.now()
  }
  await db.goals.update(id, patch)
  return { completed: justCompleted }
}

/** Decrements a counter goal's progress by 1, floored at 0 — the undo mechanic for accidental extra taps. If this drops an already-completed goal's count back below target, un-completes it symmetrically. */
export async function decrementGoalProgress(id: string): Promise<void> {
  const goal = await db.goals.get(id)
  if (!goal) return
  const target = effectiveTarget(goal.targetCount)
  const newCount = Math.max(0, (goal.currentCount ?? 0) - 1)
  const patch: Partial<Goal> = { currentCount: newCount }
  if (goal.completed && newCount < target) {
    patch.completed = false
    patch.completedAt = null
  }
  await db.goals.update(id, patch)
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
