import { useState, type CSSProperties } from 'react'
import { addDays, formatDate, isISODate } from '../../domain/dates'
import { useActions, useDerived, useSettings } from '../../state/hooks'
import { Field, Input, ToggleChip, cx } from '../../ui'
import { Section } from './Section'
import s from './Settings.module.css'

const WEEK_CHOICES = [8, 12, 16, 24] as const

/** A plan of N weeks covers N × 7 days, start and target both counted. */
const targetForWeeks = (start: string, weeks: number) => addDays(start, weeks * 7 - 1)

/**
 * A date input that only commits whole, plausible dates. Typing a year passes through values
 * like 0002 on the way to 2027; those stay in the field and never reach the plan.
 */
function DateField({ label, id, stored, onCommit }: { label: string; id: string; stored: string; onCommit: (iso: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="date"
        mono
        value={draft ?? stored}
        onChange={(event) => {
          const next = event.target.value
          const year = Number(next.slice(0, 4))
          if (isISODate(next) && year >= 2000 && year <= 2100) {
            setDraft(null)
            onCommit(next)
          } else {
            setDraft(next)
          }
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  )
}

const rate = (n: number) => (n >= 10 ? String(Math.round(n)) : n.toFixed(1))

export function PlanSection() {
  const { startDate, targetDate } = useSettings()
  const { plan } = useDerived()
  const actions = useActions()
  const [note, setNote] = useState<string | null>(null)

  const setStart = (iso: string) => {
    setNote(addDays(iso, 1) > targetDate ? 'The target moved to stay a day after the start.' : null)
    actions.updateSettings({ startDate: iso })
  }
  const setTarget = (iso: string) => {
    setNote(iso < addDays(startDate, 1) ? 'The target stays at least a day after the start.' : null)
    actions.updateSettings({ targetDate: iso })
  }

  const progress = plan.totalDays > 1 ? Math.min(1, Math.max(0, (plan.dayNumber - 1) / (plan.totalDays - 1))) : 0
  const weeks = Math.max(1, plan.totalDays / 7)

  let readout
  if (plan.remaining === 0) {
    readout = (
      <>
        All <span className="num">{plan.total}</span> problems are solved. The target date is only a marker now.
      </>
    )
  } else if (plan.daysLeft === 0) {
    readout = (
      <>
        The target date has passed with <span className="num">{plan.remaining}</span> problems still ahead. Move it to set a new pace.
      </>
    )
  } else {
    readout = (
      <>
        <span className="num">{plan.remaining}</span> problems in <span className="num">{plan.daysLeft}</span> {plan.daysLeft === 1 ? 'day' : 'days'} is{' '}
        <span className="num">{rate(plan.neededPerDay)}</span> a day.
      </>
    )
  }

  return (
    <Section no="01" title="Plan" blurb="The route runs from a start date to a target date. Today's pace and the map's marker follow from these two days.">
      <div className={s.fieldPair}>
        <DateField label="Start date" id="plan-start" stored={startDate} onCommit={setStart} />
        <DateField label="Target date" id="plan-target" stored={targetDate} onCommit={setTarget} />
      </div>
      {note ? (
        <p className={s.note} role="status">
          {note}
        </p>
      ) : null}

      <div className={s.group}>
        <p className="eyebrow">Plan length</p>
        <div className={s.chipRow} role="group" aria-label="Set the target relative to the start">
          {WEEK_CHOICES.map((w) => (
            <ToggleChip
              key={w}
              className={s.bigChip}
              pressed={targetDate === targetForWeeks(startDate, w)}
              onPressedChange={() => {
                setNote(null)
                actions.updateSettings({ targetDate: targetForWeeks(startDate, w) })
              }}
            >
              <span className="num">{w}</span> weeks
            </ToggleChip>
          ))}
        </div>
      </div>

      <div className={s.group}>
        <p className={cx('title title-sm', s.readout)} aria-live="polite">
          {readout}
        </p>
        <div className={s.runway} aria-hidden="true">
          <div className={s.runwayTrack} style={{ '--weeks': weeks } as CSSProperties} data-dense={weeks > 60 || undefined}>
            <span className={s.runwayFill} style={{ transform: `scaleX(${progress})` }} />
            <span className={s.runwayMark} style={{ left: `${progress * 100}%` }} />
          </div>
          <div className={cx('eyebrow', s.runwayLabels)}>
            <span>{formatDate(startDate, 'medium')}</span>
            <span className="num">
              Day {Math.max(0, plan.dayNumber)} of {plan.totalDays}
            </span>
            <span>{formatDate(targetDate, 'medium')}</span>
          </div>
        </div>
      </div>
    </Section>
  )
}
