/**
 * Shared pure helpers for the counter-based (quantity) completion mechanic,
 * used by both Goals (lib/db/goals.repo.ts) and Habits
 * (lib/logic/habitProgress.ts). Kept framework/table-agnostic on purpose —
 * neither function knows about Goal, RecurringDefinition, or Habit shapes.
 */

/** Undefined, 0, or 1 all resolve to the binary target of 1 — today's exact single-tap-to-complete behavior. Fractional targets are floored. */
export function effectiveTarget(target?: number): number {
  return target && target > 1 ? Math.floor(target) : 1
}

/** True when this target represents a real counter item (target > 1), not the binary default. */
export function isCounterTarget(target?: number): boolean {
  return effectiveTarget(target) > 1
}

/** Clamps a count to [0, target] — floor-at-0 on decrement, capped-at-target on increment (overshoot beyond target is a no-op). */
export function clampCount(count: number, target: number): number {
  return Math.max(0, Math.min(count, target))
}

/** Displayed progress, capped at 100% once at/above target. */
export function progressPercent(count: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((count / target) * 100))
}
