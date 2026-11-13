import { useEffect, useState, type RefObject } from 'react'
import { LAYER, useHotkeys } from './hotkeys'

interface ListCursorOptions<T> {
  /** Enter on the current row. */
  onOpen: (item: T, index: number) => void
  /** Turn the keys off (while the list is hidden, or another list has them). Default true. */
  enabled?: boolean
  /** Default LAYER.page. Use LAYER.sheet for a list inside a sheet. */
  layer?: number
  /** Where the cursor starts, and where Enter lands before any arrow is pressed. Default 0. */
  initial?: number
  /** Scroll the active row into view within this element. Default: the page. */
  container?: RefObject<HTMLElement | null>
}

export interface ListCursor {
  /** The row the cursor is on, or -1 for an empty list. Enter opens this row. */
  index: number
  /** True once the keyboard has been used; pass `active={cursor.shown && i === cursor.index}` to rows. */
  shown: boolean
  /** Put the cursor on a row (and show it). */
  setIndex: (index: number) => void
}

/**
 * Keyboard navigation for a list of rows: j / k or the arrow keys move, Enter opens,
 * Home and End jump. The highlight only appears once a key is used, and steps aside when the
 * mouse moves, so it never fights the pointer. Rows mark themselves with `data-active`
 * (ProblemRow does this from its `active` prop) so the cursor can keep its row in view.
 */
export function useListCursor<T>(
  items: readonly T[],
  { onOpen, enabled = true, layer = LAYER.page, initial = 0, container }: ListCursorOptions<T>,
): ListCursor {
  const [raw, setRaw] = useState<number | null>(null)
  const [shown, setShown] = useState(false)
  const count = items.length
  const index = count === 0 ? -1 : Math.min(Math.max(raw ?? initial, 0), count - 1)

  const move = (delta: number) => {
    if (count === 0) return
    // The first key press reveals the cursor where it already is; the next one moves it.
    setRaw(shown ? Math.min(Math.max(index + delta, 0), count - 1) : index)
    setShown(true)
  }

  useHotkeys(
    {
      j: () => move(1),
      ArrowDown: () => move(1),
      k: () => move(-1),
      ArrowUp: () => move(-1),
      Home: () => move(-count),
      End: () => move(count),
      Enter: () => {
        if (index >= 0) onOpen(items[index], index)
      },
    },
    { enabled: enabled && count > 0, layer },
  )

  useEffect(() => {
    if (!shown) return
    const hide = () => setShown(false)
    window.addEventListener('mousemove', hide, { once: true })
    return () => window.removeEventListener('mousemove', hide)
  }, [shown, index])

  useEffect(() => {
    if (!shown) return
    const scope: ParentNode = container?.current ?? document
    scope.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [shown, index, container])

  return {
    index,
    shown,
    setIndex: (next) => {
      setRaw(next)
      setShown(true)
    },
  }
}
