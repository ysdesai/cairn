import type { CSSProperties, Ref } from 'react'
import { formatDate, relativeDay } from '../../domain/dates'
import { LADDER } from '../../domain/srs'
import type { ProblemView } from '../../domain/types'
import { Cairn, CAIRN_STONES, cx } from '../../ui'
import { Section } from './Section'
import s from './Route.module.css'

/** The ladder as five stones that shrink upward like the cairn: cleared ones filled, the next one lit. */
function Ladder({ step, mastered }: { step: number; mastered: boolean }) {
  return (
    <ol className={cx(s.ladder, mastered && s.glow)} aria-label="Revision ladder">
      {LADDER.map((days, i) => {
        const cleared = i < step
        const upNext = !mastered && i === step
        return (
          <li key={days} className={cx(s.rung, cleared && s.cleared, upNext && s.upNext)} style={{ '--w': `${22 - i * 3.5}px` } as CSSProperties}>
            <span className={s.stone} aria-hidden="true" />
            <span className={cx('num', s.days)}>{days}d</span>
            <span className="sr-only">{cleared ? ' cleared' : upNext ? ' next' : ' later'}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** The cairn, how far up the ladder it is, and when it is next due. Solved problems only. */
export function Route({ view, today, ref }: { view: ProblemView; today: string; ref?: Ref<HTMLElement> }) {
  const srs = view.srs
  if (!srs) return null
  const { step, mastered, due } = srs

  let when
  if (mastered || due === null) {
    when = <>Mastered. It will not come back unless you revise it yourself.</>
  } else if (due < today) {
    when = (
      <>
        Waiting since <span className="num">{formatDate(due, 'weekday')}</span>
      </>
    )
  } else {
    when = (
      <>
        Next revision <span className="num">{formatDate(due, 'weekday')}</span> <span aria-hidden="true">·</span> {relativeDay(due, today)}
      </>
    )
  }

  return (
    <Section ref={ref} label="Route" aside={`${view.attempts.length} ${view.attempts.length === 1 ? 'attempt' : 'attempts'}`} focusable>
      <div className={s.route}>
        <Cairn step={step} mastered={mastered} size={64} animate tone={view.status === 'due' ? 'ember' : 'ink'} />
        <div className={s.facts}>
          <p className={s.count}>
            <span className={cx('stat', s.numeral)}>{step}</span>
            <span>
              {' '}
              of {CAIRN_STONES} revisions cleared
            </span>
          </p>
          <Ladder step={step} mastered={mastered} />
          <p className={cx(s.when, mastered && s.done)}>{when}</p>
        </div>
      </div>
    </Section>
  )
}
