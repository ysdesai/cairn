import { motion } from 'framer-motion'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { spring } from './motion'
import s from './Segmented.module.css'

export interface SegmentOption<T extends string | number> {
  value: T
  label: ReactNode
  /** Tooltip text. */
  title?: string
  disabled?: boolean
}

interface SegmentedProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  /** Names the group for screen readers. */
  label: string
  size?: 'sm' | 'md'
  /** Stretch to the container, equal-width segments. */
  block?: boolean
  className?: string
}

/** One choice out of a few. A radio group with a thumb that slides to the selection. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  block,
  className,
}: SegmentedProps<T>) {
  const thumbId = useId()
  const ref = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const enabled = options.filter((o) => !o.disabled)
    const at = enabled.findIndex((o) => o.value === value)
    const next = enabled[(at + delta + enabled.length) % enabled.length]
    if (!next) return
    onChange(next.value)
    const index = options.indexOf(next)
    ref.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus()
  }

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cx(s.group, s[size], block && s.block, className)} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            title={option.title}
            className={cx(s.segment, selected && s.selected)}
            onClick={() => onChange(option.value)}
          >
            {selected ? <motion.span layoutId={thumbId} className={s.thumb} transition={spring.snappy} /> : null}
            <span className={s.label}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
