import type { ReactNode } from 'react'
import { cx } from './cx'
import { Terrain } from './Terrain'
import s from './PageHeader.module.css'

interface PageHeaderProps {
  /** Two-digit sheet number: every screen is a sheet of the atlas. "01" */
  sheet: string
  /** The screen's short name, for the margin: "Today" */
  name: string
  /** Right-hand margin note: the date, a count, coordinates. Kept short. */
  meta?: ReactNode
  /** The headline. Usually a sentence, not a label. */
  title: ReactNode
  /** One or two supporting sentences. */
  lede?: ReactNode
  /** Buttons that belong to the whole screen. */
  actions?: ReactNode
  /** Seed for the contour backdrop. Omit for none. */
  terrain?: number
  className?: string
  children?: ReactNode
}

/**
 * The top of every standard screen: a margin line (sheet number, name, a ruled scale, a note),
 * then the headline. This is what makes the screens read as pages of one atlas.
 */
export function PageHeader({ sheet, name, meta, title, lede, actions, terrain, className, children }: PageHeaderProps) {
  return (
    <header className={cx(s.header, className)}>
      {terrain != null ? (
        <div className={s.backdrop}>
          <Terrain seed={terrain} fade="edges" />
        </div>
      ) : null}
      <div className={s.margin}>
        <span className="eyebrow">
          <span className={s.sheetNo}>Sheet {sheet}</span>
          <span className={s.sep} aria-hidden="true" />
          <span className={s.name}>{name}</span>
        </span>
        <span className={s.scale} aria-hidden="true" />
        {meta ? <span className={cx('eyebrow', s.meta)}>{meta}</span> : null}
      </div>
      <div className={s.main}>
        <div className={s.text}>
          <h1 className={cx('display display-1', s.title)}>{title}</h1>
          {lede ? <p className={s.lede}>{lede}</p> : null}
        </div>
        {actions ? <div className={s.actions}>{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}
