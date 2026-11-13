import type { CSSProperties, ElementType, ReactNode } from 'react'
import { cx } from './cx'
import s from './Frame.module.css'

interface FrameProps {
  /** A mono label set into the top edge, like a map legend's heading. */
  label?: ReactNode
  /** Something set into the top edge on the right: a count, a link. */
  aside?: ReactNode
  /** plain: lines on the page. raised: a lighter sheet with a soft shadow, for things that float. */
  tone?: 'plain' | 'raised'
  /** Inner padding. */
  pad?: 'none' | 'sm' | 'md' | 'lg'
  /** Corner tick marks. On by default; they are the frame's signature. */
  ticks?: boolean
  as?: ElementType
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * The app's container: a hairline neatline with survey ticks at the corners, the way a map
 * frames its legend. Use it where content needs a boundary; prefer open layout otherwise.
 */
export function Frame({ label, aside, tone = 'plain', pad = 'md', ticks = true, as: Tag = 'section', className, style, children }: FrameProps) {
  return (
    <Tag className={cx(s.frame, s[tone], s[`pad-${pad}`], ticks && s.ticks, className)} style={style}>
      {label || aside ? (
        <div className={s.edge}>
          {label ? <span className={cx('eyebrow', s.label)}>{label}</span> : <span />}
          {aside ? <span className={cx('eyebrow', s.label, s.aside)}>{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  )
}
