import type { ReactNode } from 'react'
import s from './InsightsSection.module.css'

interface InsightsSectionProps {
  /** Anchor name. The section is `insights-<id>`, so the index can scroll to it. */
  id: string
  /** Mono label on the ticked rule: the section's name. */
  eyebrow: string
  /** One short Fraunces line naming the section. The sentence about the user's state goes in `lede`. */
  title: string
  /** Right-hand marginal note on the rule: a count, a range, a scale. */
  aside?: ReactNode
  /** The sentence written from the user's state, key name in <em>. Set in the body, not as a second headline. */
  lede?: ReactNode
  children: ReactNode
}

export const sectionAnchor = (id: string) => `insights-${id}`

/**
 * One section of the Insights sheet. Every section opens the same way: an eyebrow on a ticked
 * rule with a note in the margin, one serif title, then the sentence about where the user
 * stands. The page's single headline lives in the page header, not here.
 */
export default function InsightsSection({ id, eyebrow, title, aside, lede, children }: InsightsSectionProps) {
  return (
    <section className={s.section} id={sectionAnchor(id)} aria-labelledby={`${id}-title`}>
      <header className={s.head}>
        <div className={s.top}>
          <p className="eyebrow">{eyebrow}</p>
          <span className={s.scale} aria-hidden="true" />
          {aside ? <p className={`eyebrow ${s.aside}`}>{aside}</p> : null}
        </div>
        <h2 className={`title ${s.title}`} id={`${id}-title`}>
          {title}
        </h2>
        {lede ? <p className={s.lede}>{lede}</p> : null}
      </header>
      {children}
    </section>
  )
}

/** The one sub-label style: a mono eyebrow over a hairline, for the parts inside a section. */
export function SubHead({ children, aside, as: Tag = 'h3' }: { children: ReactNode; aside?: ReactNode; as?: 'h3' | 'p' }) {
  return (
    <div className={s.sub}>
      <Tag className="eyebrow">{children}</Tag>
      {aside ? <span className="eyebrow">{aside}</span> : null}
    </div>
  )
}
