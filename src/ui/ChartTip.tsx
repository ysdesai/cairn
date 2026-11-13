import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from './cx'
import s from './ChartTip.module.css'

interface ChartTipProps {
  /** Position inside the nearest positioned ancestor, in px. The tip centres above this point. */
  x: number
  y: number
  /** Flip below the point when there is no room above. */
  below?: boolean
  className?: string
  children: ReactNode
}

/**
 * One visually hidden polite live region for every chart. A region that is created together with
 * its text is often not announced, so this one exists before the first value is written to it.
 */
let announcer: HTMLElement | null = null
let clearTimer: number | undefined

function announce(text: string) {
  if (typeof document === 'undefined') return
  if (!announcer || !announcer.isConnected) {
    announcer = document.createElement('div')
    announcer.className = 'sr-only'
    announcer.setAttribute('role', 'status')
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    document.body.appendChild(announcer)
  }
  window.clearTimeout(clearTimer)
  announcer.textContent = text
  // Forget it shortly after, so the same value read twice in a row is announced twice.
  clearTimer = window.setTimeout(() => {
    if (announcer) announcer.textContent = ''
  }, 1500)
}

/**
 * The tooltip charts use for the hovered or focused mark. Render it only while a mark is active,
 * inside a `position: relative` wrapper around the chart. It never takes pointer events.
 * The text it shows is also read out through a live region, so moving along a chart with the
 * arrow keys is heard as well as seen.
 */
export function ChartTip({ x, y, below, className, children }: ChartTipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef('')
  // children is a fresh element every render; announce only when the rendered text changes.
  useEffect(() => {
    const text = ref.current?.innerText?.replace(/\s*\n\s*/g, ', ').trim()
    if (text && text !== last.current) announce(text)
    last.current = text ?? ''
  })
  return (
    <div ref={ref} className={cx(s.tip, below && s.below, className)} style={{ left: x, top: y }} aria-hidden="true">
      {children}
    </div>
  )
}
