import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * Hover, tap and keyboard focus for the marks of a hand-drawn chart. The wrapper is one tab stop;
 * the arrow keys walk the marks, so a keyboard user reads the same values a mouse user does.
 */
export function useMarkTip(count: number, start: number) {
  const [active, setActive] = useState<number | null>(null)
  const [cursor, setCursor] = useState(start)
  const wrap = useRef<HTMLDivElement>(null)

  // A tap on a phone leaves the tip up; a tap anywhere else puts it away.
  useEffect(() => {
    if (active === null) return
    const away = (event: globalThis.PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [active])

  const step = (to: number) => {
    const next = Math.min(Math.max(to, 0), count - 1)
    setCursor(next)
    setActive(next)
  }

  return {
    active,
    wrap,
    group: {
      tabIndex: 0,
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.currentTarget === event.target && event.currentTarget.matches(':focus-visible')) setActive(cursor)
      },
      onBlur: () => setActive(null),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const to =
          event.key === 'ArrowRight'
            ? cursor + 1
            : event.key === 'ArrowLeft'
              ? cursor - 1
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? count - 1
                  : null
        if (to === null) return
        event.preventDefault()
        step(to)
      },
    },
    mark: (i: number) => ({
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType === 'mouse') setActive(i)
      },
      onPointerLeave: (event: PointerEvent) => {
        if (event.pointerType === 'mouse') setActive((current) => (current === i ? null : current))
      },
      onClick: () => {
        setCursor(i)
        setActive(i)
      },
    }),
  }
}
