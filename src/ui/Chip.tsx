import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'
import s from './Chip.module.css'

export type Tone = 'neutral' | 'ember' | 'moss' | 'lake' | 'gold' | 'dusk' | 'danger'

interface ChipProps {
  tone?: Tone
  /** outline: quiet label. soft: tinted fill. */
  variant?: 'outline' | 'soft'
  /** mono: small capitals in the measurement face (statuses, counts). sans: ordinary words (tags). */
  face?: 'mono' | 'sans'
  icon?: ReactNode
  /** A small leading dot in the tone colour. */
  dot?: boolean
  className?: string
  title?: string
  children: ReactNode
}

/** A small label. Not interactive: for toggles use ToggleChip. */
export function Chip({ tone = 'neutral', variant = 'outline', face = 'mono', icon, dot, className, title, children }: ChipProps) {
  return (
    <span className={cx(s.chip, s[tone], s[variant], s[face], className)} title={title}>
      {dot ? <span className={s.dot} /> : null}
      {icon ? <span className={s.icon}>{icon}</span> : null}
      {children}
    </span>
  )
}

interface ToggleChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  tone?: Tone
  icon?: ReactNode
  /** A count shown after the label. */
  count?: number
}

/** A chip you can switch on and off: filters, mistake tags. */
export function ToggleChip({ pressed, onPressedChange, tone = 'ember', icon, count, className, children, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(s.chip, s.toggle, s.sans, s[tone], pressed ? s.on : s.off, className)}
      onClick={() => onPressedChange(!pressed)}
      {...rest}
    >
      {icon ? <span className={s.icon}>{icon}</span> : null}
      {children}
      {count != null ? <span className={s.count}>{count}</span> : null}
    </button>
  )
}
