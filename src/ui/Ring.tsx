import { useId, type ReactNode } from 'react'
import { cx } from './cx'
import s from './Ring.module.css'

interface RingProps {
  /** 0…1 */
  value: number
  size?: number
  stroke?: number
  /** ember: progress. moss: done. ink: neutral. glow: the alpenglow gradient, for achievement. */
  tone?: 'ember' | 'moss' | 'ink' | 'glow' | 'lake'
  /** Centered content. */
  children?: ReactNode
  className?: string
  /** Accessible name, e.g. "5 of 9 solved". Without it the ring is decorative. */
  label?: string
}

/** A progress ring. Animates when the value changes. */
export function Ring({ value, size = 44, stroke = 3, tone = 'ember', children, className, label }: RingProps) {
  const id = useId()
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span
      className={cx(s.ring, s[tone], className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {tone === 'glow' ? (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--glow-1)" />
              <stop offset="0.5" stopColor="var(--glow-2)" />
              <stop offset="1" stopColor="var(--glow-3)" />
            </linearGradient>
          </defs>
        ) : null}
        <circle className={s.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {v > 0 ? (
          <circle
            className={s.value}
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            style={tone === 'glow' ? { stroke: `url(#${id})` } : undefined}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      {children != null ? <span className={s.center}>{children}</span> : null}
    </span>
  )
}
