import { LADDER } from '../../domain/srs'
import { SETTINGS_LIMITS } from '../../state/reducers'
import { useActions, useSettings } from '../../state/hooks'
import { Cairn } from '../../ui'
import { Section } from './Section'
import { Stepper } from './Stepper'
import s from './Settings.module.css'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function RevisionsSection() {
  const { dailyReviewCap } = useSettings()
  const actions = useActions()

  // Days from the first solve until each stone is placed, if every revision lands on its date.
  let elapsed = 0
  const stones = LADDER.map((gap, i) => {
    elapsed += gap
    return { gap, elapsed, rung: i + 1 }
  })
  const mastered = stones[stones.length - 1]

  return (
    <Section
      no="02"
      title="Revisions"
      blurb="At most this many revisions are put in front of you each day. The rest wait, without penalty."
    >
      <div className={s.group}>
        <p className="eyebrow" id="cap-label">
          Daily cap
        </p>
        <Stepper
          label="Daily revision cap"
          unit="revisions a day"
          value={dailyReviewCap}
          min={SETTINGS_LIMITS.dailyReviewCap.min}
          max={SETTINGS_LIMITS.dailyReviewCap.max}
          onChange={(v) => actions.updateSettings({ dailyReviewCap: v })}
        />
      </div>

      <div className={s.group}>
        <p className="eyebrow">The ladder</p>
        <ol className={s.ladder}>
          {stones.map(({ gap, elapsed: day, rung }) => (
            <li key={rung} className={s.rung}>
              <Cairn
                step={rung}
                mastered={rung === stones.length}
                size={56}
                label={rung === stones.length ? `Revision ${rung}, mastered` : `Revision ${rung}`}
              />
              <span className={s.rungBase} aria-hidden="true" />
              <span className="eyebrow">{rung === stones.length ? 'Mastered' : `Stone ${rung}`}</span>
              <span className={`num ${s.rungGap}`}>{plural(gap, 'day')}</span>
              <span className={`num muted ${s.rungDay}`}>Day {day}</span>
            </li>
          ))}
        </ol>
        <p className={s.footnote}>
          Each gap is counted from the revision before it. Mastery lands up to about <span className="num">{mastered.elapsed}</span> days after the first solve, sooner when
          revisions on their due date are rated Easy. The gaps stretch or shrink a little with how each revision went.
        </p>
      </div>
    </Section>
  )
}
