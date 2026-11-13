import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'
import s from './Field.module.css'

interface FieldProps {
  label: ReactNode
  /** id of the control this labels. */
  htmlFor?: string
  /** Helper text under the control. */
  hint?: ReactNode
  /** Something on the right of the label row: a counter, a "Saved" mark. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** A labelled control. The label is a mono eyebrow, as on a map legend. */
export function Field({ label, htmlFor, hint, aside, className, children }: FieldProps) {
  return (
    <div className={cx(s.field, className)}>
      <div className={s.head}>
        <label className="eyebrow" htmlFor={htmlFor}>
          {label}
        </label>
        {aside ? <span className={s.aside}>{aside}</span> : null}
      </div>
      {children}
      {hint ? <p className={s.hint}>{hint}</p> : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Use the measurement face (numbers, dates, complexities). */
  mono?: boolean
  ref?: Ref<HTMLInputElement>
}

export function Input({ mono, className, ...rest }: InputProps) {
  return <input className={cx(s.control, s.input, mono && s.mono, className)} {...rest} />
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with the content instead of scrolling. */
  autosize?: boolean
  mono?: boolean
}

export function Textarea({ autosize = true, mono, className, value, onInput, ...rest }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !autosize) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value, autosize])

  return (
    <textarea
      ref={ref}
      value={value}
      className={cx(s.control, s.textarea, mono && s.mono, className)}
      onInput={(event) => {
        if (autosize) {
          const el = event.currentTarget
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight + 2}px`
        }
        onInput?.(event)
      }}
      {...rest}
    />
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

/** The native select, dressed. Native keeps it fast and right on phones. */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <span className={cx(s.selectWrap, className)}>
      <select className={cx(s.control, s.select)} {...rest}>
        {children}
      </select>
      <svg className={s.chevron} width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
