import type { ReactNode } from 'react'
import { cx } from './cx'
import { Terrain } from './Terrain'
import s from './Empty.module.css'

interface EmptyProps {
  /** A short headline in the serif. */
  title: ReactNode
  /** One or two sentences: why it is empty and what fills it. */
  body?: ReactNode
  /** The way forward, usually one button. */
  action?: ReactNode
  /** A glyph or icon shown above the title. */
  icon?: ReactNode
  /** Seed for the contour vignette behind it. */
  seed?: number
  /** Less vertical padding, for use inside a panel. */
  compact?: boolean
  className?: string
}

/** What a screen or panel shows before there is anything to show. */
export function Empty({ title, body, action, icon, seed = 11, compact, className }: EmptyProps) {
  return (
    <div className={cx(s.empty, compact && s.compact, className)}>
      <div className={s.vignette}>
        <Terrain seed={seed} width={640} height={420} levels={11} scale={150} fade="edges" />
      </div>
      {icon ? <div className={s.icon}>{icon}</div> : null}
      <h2 className={cx('title', compact && 'title-sm')}>{title}</h2>
      {body ? <p className={s.body}>{body}</p> : null}
      {action ? <div className={s.action}>{action}</div> : null}
    </div>
  )
}
