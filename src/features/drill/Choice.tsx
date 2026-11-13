import { motion } from 'framer-motion'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { spring, Tip } from '../../ui'
import s from './Choice.module.css'

export interface ChoiceOption<T extends string> {
  value: T
  label: ReactNode
  /** Why this choice is closed. A closed choice stays reachable by keyboard so the reason can be read. */
  locked?: string
}

interface ChoiceProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly ChoiceOption<T>[]
  label: string
}

/**
 * A segmented radio group like the kit's Segmented, except that a closed option is aria-disabled
 * rather than disabled. A disabled button cannot take focus, so its reason would never show for
 * someone on the keyboard; this one explains itself in a Tip on hover and on focus.
 */
export function Choice<T extends string>({ value, onChange, options, label }: ChoiceProps<T>) {
  const thumbId = useId()
  const ref = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? []
    const at = Math.max(
      0,
      [...buttons].findIndex((b) => b === document.activeElement),
    )
    const index = (at + delta + options.length) % options.length
    const next = options[index]
    if (!next.locked) onChange(next.value)
    buttons[index]?.focus()
  }

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={s.group} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Tip key={option.value} content={option.locked} side="bottom">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={option.locked ? true : undefined}
              tabIndex={selected ? 0 : -1}
              className={`${s.segment} ${selected ? s.selected : ''}`}
              data-locked={option.locked ? '' : undefined}
              onClick={() => {
                if (!option.locked) onChange(option.value)
              }}
            >
              {selected ? <motion.span layoutId={thumbId} className={s.thumb} transition={spring.snappy} /> : null}
              <span className={s.label}>{option.label}</span>
              {option.locked ? <span className="sr-only">. {option.locked}</span> : null}
            </button>
          </Tip>
        )
      })}
    </div>
  )
}
