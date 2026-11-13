import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface TickerProps {
  value: number
  /** Turn the number into text. Default: rounded integer. */
  format?: (n: number) => string
  /** Seconds. */
  duration?: number
  className?: string
}

const defaultFormat = (n: number) => String(Math.round(n))

/** A number that counts to its new value when it changes. Jumps straight there under reduced motion. */
export function Ticker({ value, format = defaultFormat, duration = 0.8, className }: TickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    if (reduce || from === value) {
      shown.current = value
      el.textContent = format(value)
      return
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        shown.current = latest
        el.textContent = format(latest)
      },
    })
    return () => controls.stop()
  }, [value, format, duration, reduce])

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
