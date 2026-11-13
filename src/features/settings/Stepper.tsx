import { Minus, Plus } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { cx } from '../../ui'
import s from './Stepper.module.css'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  /** Names the control for screen readers, e.g. "Daily revision cap". */
  label: string
  /** A short unit shown after the number: "min", "a day". */
  unit?: string
  /** Arrow keys and the buttons move by this much; Page Up and Page Down by five times it. */
  step?: number
  className?: string
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

/**
 * A number with minus and plus buttons around it. The number can also be typed: the draft is
 * committed on Enter or blur, clamped into range, and anything unreadable falls back to the stored value.
 */
export function Stepper({ value, onChange, min, max, label, unit, step = 1, className }: StepperProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (next: number) => {
    const clamped = clamp(next, min, max)
    if (clamped !== value) onChange(clamped)
  }

  const finishDraft = () => {
    if (draft !== null) {
      const parsed = draft.trim() === '' ? NaN : Number(draft)
      if (Number.isFinite(parsed)) commit(parsed)
    }
    setDraft(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const base = draft !== null && Number.isFinite(Number(draft)) && draft.trim() !== '' ? Number(draft) : value
    let next: number | null = null
    if (event.key === 'ArrowUp') next = base + step
    else if (event.key === 'ArrowDown') next = base - step
    else if (event.key === 'PageUp') next = base + step * 5
    else if (event.key === 'PageDown') next = base - step * 5
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    else if (event.key === 'Enter') {
      event.preventDefault()
      finishDraft()
      return
    } else if (event.key === 'Escape' && draft !== null) {
      event.stopPropagation()
      setDraft(null)
      return
    }
    if (next === null) return
    event.preventDefault()
    setDraft(null)
    commit(next)
  }

  return (
    <div className={cx(s.stepper, className)} role="group" aria-label={label}>
      <button
        type="button"
        className={s.button}
        aria-label={`Decrease ${label}`}
        aria-controls={id}
        disabled={value <= min}
        onClick={() => commit(value - step)}
      >
        <Minus />
      </button>
      <input
        id={id}
        className={cx('num', s.input)}
        role="spinbutton"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onFocus={(event) => event.target.select()}
        onBlur={finishDraft}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className={s.button}
        aria-label={`Increase ${label}`}
        aria-controls={id}
        disabled={value >= max}
        onClick={() => commit(value + step)}
      >
        <Plus />
      </button>
      {unit ? <span className={cx('num muted', s.unit)}>{unit}</span> : null}
    </div>
  )
}
