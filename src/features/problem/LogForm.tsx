import { motion } from 'framer-motion'
import { useId, useRef, type KeyboardEvent } from 'react'
import { MISTAKE_TAGS, RATING_META, RATINGS, type Rating } from '../../state/schema'
import type { ProblemView } from '../../domain/types'
import { Button, cx, Cairn, Field, fade, Input, Kbd, ToggleChip } from '../../ui'
import { consequence, followUp } from './logic'
import type { LogFormState } from './useLogForm'
import s from './LogForm.module.css'

interface LogFormProps {
  view: ProblemView
  form: LogFormState
  today: string
  /** Chosen through the parent so the timer can suggest minutes. */
  onChoose: (rating: Rating) => void
  onSubmit: () => void
  /** Shown under the question; the first-solve invitation. */
  lede?: string
  /** Show the empty cairn beside the lede (an unsolved problem). */
  ghostCairn?: boolean
}

/** "How did it go?": three rating choices that say what they will do, then the details. */
export function LogForm({ view, form, today, onChoose, onSubmit, lede, ghostCairn }: LogFormProps) {
  const ids = { minutes: useId(), date: useId() }
  const group = useRef<HTMLDivElement>(null)
  const label = view.solved ? 'Log revision' : 'Log solve'
  const on = form.date || today

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const at = form.rating ? RATINGS.indexOf(form.rating) : delta > 0 ? -1 : 0
    const next = RATINGS[(at + delta + RATINGS.length) % RATINGS.length]
    onChoose(next)
    group.current?.querySelectorAll<HTMLButtonElement>('button')[RATINGS.indexOf(next)]?.focus()
  }

  return (
    <div className={s.form}>
      <div className={s.ask}>
        <div className={s.askText}>
          <h3 className="title title-sm">How did it go?</h3>
          {lede ? <p className={s.lede}>{lede}</p> : null}
        </div>
        {ghostCairn ? <Cairn step={0} size={44} label="No stones yet" /> : null}
      </div>

      <div ref={group} className={s.rates} role="radiogroup" aria-label="How did it go?" onKeyDown={onKeyDown}>
        {RATINGS.map((rating, i) => {
          const meta = RATING_META[rating]
          const selected = form.rating === rating
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (form.rating === null && i === 0) ? 0 : -1}
              className={cx(s.rate, s[rating], selected && s.selected)}
              onClick={() => onChoose(rating)}
            >
              <span className={s.top}>
                <span className={s.dot} aria-hidden="true" />
                <span className={s.name}>{meta.label}</span>
                <Kbd keys={meta.hotkey} className={s.kbd} />
              </span>
              <span className={s.hint}>{meta.hint}</span>
              <span className={cx('num', s.then)}>{consequence(view, rating, on, today)}</span>
            </button>
          )
        })}
      </div>

      {form.rating ? (
        <motion.div className={s.details} variants={fade} initial="initial" animate="enter">
          <div className={s.pair}>
            <Field
              label="Minutes"
              htmlFor={ids.minutes}
              hint={form.minutesNote ? <span id={`${ids.minutes}-note`} className={s.warn}>{form.minutesNote}</span> : form.fromTimer ? 'From the timer. Edit or clear it.' : 'Optional. Whole minutes, 1 to 600.'}
            >
              <Input
                id={ids.minutes}
                mono
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                step={1}
                placeholder="min"
                value={form.minutes}
                aria-invalid={form.minutesNote ? true : undefined}
                aria-describedby={form.minutesNote ? `${ids.minutes}-note` : undefined}
                onChange={(event) => form.setMinutes(event.target.value)}
                onBlur={form.settleMinutes}
              />
            </Field>
            <Field label="Date" htmlFor={ids.date} hint={form.dateNote ? <span id={`${ids.date}-note`} className={s.warn}>{form.dateNote}</span> : 'Earlier than today backdates it.'}>
              <Input
                id={ids.date}
                mono
                type="date"
                max={today}
                value={form.date}
                aria-invalid={form.dateNote ? true : undefined}
                aria-describedby={form.dateNote ? `${ids.date}-note` : undefined}
                onChange={(event) => {
                  // A typed future date is pulled back; write it into the field too, since state may not change.
                  event.target.value = form.setDate(event.target.value)
                }}
              />
            </Field>
          </div>

          <Field label="What tripped you up" aside="Optional">
            <div className={s.chips} role="group" aria-label="Mistakes">
              {MISTAKE_TAGS.map((tag) => (
                <ToggleChip
                  key={tag.id}
                  className={s.chip}
                  tone="neutral"
                  pressed={form.mistakes.includes(tag.id)}
                  onPressedChange={() => form.toggleMistake(tag.id)}
                  title={tag.hint}
                >
                  {tag.label}
                </ToggleChip>
              ))}
            </div>
          </Field>

          <div className={s.submit}>
            <Button variant="primary" size="lg" kbd="mod+Enter" onClick={onSubmit}>
              {label}
            </Button>
            <span className={cx('num', s.after)}>{followUp(view, form.rating, on, today)}</span>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}
