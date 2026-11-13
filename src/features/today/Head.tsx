import type { ReactNode } from 'react'
import s from './Head.module.css'

/** A margin label with a ruled line running out to a note on the right: heads every block on the sheet. */
export function Head({ label, aside, id }: { label: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className={s.head}>
      <h2 className="eyebrow" id={id}>
        {label}
      </h2>
      <span className={s.line} aria-hidden="true" />
      {aside ? <span className="eyebrow num">{aside}</span> : null}
    </div>
  )
}
