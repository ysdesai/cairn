import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

interface CursorOptions {
  /** Number of positions the cursor can rest on. */
  length: number
  /** Where the cursor lands when the chart takes focus. */
  start: number
  /** How far each arrow key moves it. Defaults: left and right by one. */
  steps?: { left?: number; right?: number; up?: number; down?: number }
}

/** How long a tap keeps its readout on screen, since touch has no hover to end it. */
const TOUCH_HOLD_MS = 3200

/**
 * One active position on a chart, driven by pointer, touch and keyboard together, so a value
 * that appears on hover is also reachable from the keyboard. Spread `props` on the focusable
 * wrapper and call `set` from pointer-move handlers.
 */
export function useCursor({ length, start, steps }: CursorOptions) {
  const [raw, setRaw] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const index = raw == null || length === 0 ? null : Math.max(0, Math.min(length - 1, raw))

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const set = useCallback((next: number | null) => {
    window.clearTimeout(timer.current)
    setRaw(next)
  }, [])

  const left = steps?.left ?? 1
  const right = steps?.right ?? 1
  const up = steps?.up
  const down = steps?.down

  const onKeyDown = (e: KeyboardEvent) => {
    if (length === 0 || e.altKey || e.metaKey || e.ctrlKey) return
    const at = index ?? start
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = at - left
    else if (e.key === 'ArrowRight') next = at + right
    else if (e.key === 'ArrowUp' && up != null) next = at - up
    else if (e.key === 'ArrowDown' && down != null) next = at + down
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = length - 1
    else if (e.key === 'Escape') {
      set(null)
      return
    }
    if (next == null) return
    e.preventDefault()
    set(Math.max(0, Math.min(length - 1, next)))
  }

  const props = {
    tabIndex: 0,
    onFocus: () => setRaw((cur) => cur ?? start),
    onBlur: () => set(null),
    onKeyDown,
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') set(null)
    },
    onPointerUp: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setRaw(null), TOUCH_HOLD_MS)
    },
  }

  return { index, set, props }
}
