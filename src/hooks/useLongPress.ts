import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

interface UsePressHandlersOptions {
  /** Fires on a quick press-and-release (below holdDelayMs). */
  onTap: () => void
  /** Fires once, after holding for holdDelayMs — does not also fire onTap. */
  onHold: () => void
  holdDelayMs?: number
}

export interface PressHandlers {
  onPointerDown: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerLeave: (e: PointerEvent) => void
  onContextMenu: (e: MouseEvent) => void
}

/**
 * Tap = increment, hold = decrement (the long-press undo mechanic for
 * counter-based Tasks/Habits). Shared by GoalCard and HabitCard's progress
 * ring buttons. Uses pointer events (covers touch and mouse) and suppresses
 * the native context menu a touch long-press would otherwise trigger.
 */
export function usePressHandlers({ onTap, onHold, holdDelayMs = 500 }: UsePressHandlersOptions): PressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedHoldRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault()
      firedHoldRef.current = false
      clearTimer()
      timerRef.current = setTimeout(() => {
        firedHoldRef.current = true
        onHold()
      }, holdDelayMs)
    },
    [clearTimer, holdDelayMs, onHold],
  )

  const onPointerUp = useCallback(() => {
    clearTimer()
    if (!firedHoldRef.current) onTap()
    firedHoldRef.current = false
  }, [clearTimer, onTap])

  const onPointerLeave = useCallback(() => {
    clearTimer()
    firedHoldRef.current = false
  }, [clearTimer])

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
  }, [])

  return { onPointerDown, onPointerUp, onPointerLeave, onContextMenu }
}
