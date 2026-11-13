import { useId, type ReactNode, type Ref } from 'react'
import { cx } from '../../ui'
import s from './Section.module.css'

interface SectionProps {
  /** The eyebrow set on the left of the ruled head. */
  label: ReactNode
  /** Marginalia on the right: a count, a target, a date. */
  aside?: ReactNode
  /** Make the section a focus target for scripted moves. */
  focusable?: boolean
  className?: string
  ref?: Ref<HTMLElement>
  children: ReactNode
}

/** A part of the sheet: a mono label, a hairline running to the margin note, then the content. */
export function Section({ label, aside, focusable, className, ref, children }: SectionProps) {
  const headingId = useId()
  return (
    <section ref={ref} className={cx(s.section, className)} aria-labelledby={headingId} tabIndex={focusable ? -1 : undefined}>
      <header className={s.head}>
        <h2 id={headingId} className="eyebrow">
          {label}
        </h2>
        <span className={s.rule} aria-hidden="true" />
        {aside ? <span className={cx('eyebrow', s.aside)}>{aside}</span> : null}
      </header>
      {children}
    </section>
  )
}
