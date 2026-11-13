import { useCallback, useEffect, useRef } from 'react'

/**
 * A timeout that waits while the pointer is over the element or focus is inside it, and starts
 * again from the full duration when both have left (WCAG 2.2.1: time limits can be held).
 * Spread the returned handlers on the element:
 *
 *   const hold = usePauseTimer(() => dismiss(id), 6500, item)
 *   <li {...hold}>
 *
 * `resetKey` restarts the timer when it changes (a new message reusing the same element).
 */
export function usePauseTimer(onElapsed: () => void, ms: number, resetKey?: unknown) {
  const held = useRef({ pointer: false, focus: false })
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(onElapsed)
  latest.current = onElapsed

  const arm = useCallback(() => {
    window.clearTimeout(timer.current)
    if (held.current.pointer || held.current.focus) return
    timer.current = window.setTimeout(() => latest.current(), ms)
  }, [ms])

  useEffect(() => {
    arm()
    return () => window.clearTimeout(timer.current)
  }, [arm, resetKey])

  const hold = useCallback(
    (kind: 'pointer' | 'focus', value: boolean) => {
      held.current[kind] = value
      arm()
    },
    [arm],
  )

  return {
    onPointerEnter: () => hold('pointer', true),
    onPointerLeave: () => hold('pointer', false),
    onFocus: () => hold('focus', true),
    onBlur: () => hold('focus', false),
  }
}
