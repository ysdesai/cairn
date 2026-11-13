import { cx } from './cx'
import s from './Meter.module.css'

interface MeterProps {
  /** 0…1, or null for "no data" (drawn as an empty hatched track). */
  value: number | null
  tone?: 'ember' | 'moss' | 'lake' | 'gold' | 'dusk' | 'ink'
  /** A tick drawn at this position (0…1), e.g. a target. */
  marker?: number
  height?: number
  className?: string
  label?: string
}

/** A thin horizontal bar for a single 0…1 quantity. */
export function Meter({ value, tone = 'ember', marker, height = 4, className, label }: MeterProps) {
  const v = value == null ? null : Math.max(0, Math.min(1, value))
  return (
    <span
      className={cx(s.meter, s[tone], v == null && s.empty, className)}
      style={{ height }}
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label && v != null ? Math.round(v * 100) : undefined}
      aria-hidden={label ? undefined : true}
    >
      {v != null ? <span className={s.fill} style={{ transform: `scaleX(${v})` }} /> : null}
      {marker != null ? <span className={s.marker} style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} /> : null}
    </span>
  )
}
