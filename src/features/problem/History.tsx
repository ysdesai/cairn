import { Pencil, Trash } from 'lucide-react'
import { useState } from 'react'
import type { Attempt, MistakeTag, Rating } from '../../state/schema'
import type { AttemptPatch } from '../../state/reducers'
import { MISTAKE_LABEL, MISTAKE_TAGS, RATING_META, RATINGS } from '../../state/schema'
import type { ProblemView } from '../../domain/types'
import { useActions } from '../../state/hooks'
import { Button, Chip, confirm, cx, Field, Input, RATING_TONE, Segmented, ToggleChip, toast, Tip } from '../../ui'
import { attemptLabel, attemptTarget, checkDate, checkMinutes, dayLabel } from './logic'
import { Section } from './Section'
import s from './History.module.css'

interface EditFormProps {
  attempt: Attempt
  today: string
  onSave: (patch: AttemptPatch) => void
  onCancel: () => void
}

/** The fields of one attempt, editable in place. Mounted only while editing, so it always starts from what is stored. */
function EditForm({ attempt, today, onSave, onCancel }: EditFormProps) {
  const [rating, setRating] = useState<Rating>(attempt.rating)
  const [minutes, setMinutes] = useState(attempt.minutes === null ? '' : String(attempt.minutes))
  const [date, setDate] = useState(attempt.date)
  const [mistakes, setMistakes] = useState<MistakeTag[]>(attempt.mistakes)
  const minutesNote = checkMinutes(minutes).note
  const [dateNote, setDateNote] = useState<string | null>(null)

  return (
    <div className={s.form}>
      <div className={s.pair}>
        <Field label="Date" htmlFor={`edit-date-${attempt.id}`} hint={dateNote ? <span id={`edit-date-${attempt.id}-note`} className={s.warn}>{dateNote}</span> : undefined}>
          <Input
            id={`edit-date-${attempt.id}`}
            mono
            type="date"
            max={today}
            value={date}
            aria-invalid={dateNote ? true : undefined}
            aria-describedby={dateNote ? `edit-date-${attempt.id}-note` : undefined}
            onChange={(event) => {
              // A typed future date is pulled back to today, in the field as well as in what is saved.
              const checked = checkDate(event.target.value, today)
              event.target.value = checked.date
              setDate(checked.date)
              setDateNote(checked.note)
            }}
          />
        </Field>
        <Field
          label="Minutes"
          htmlFor={`edit-minutes-${attempt.id}`}
          hint={minutesNote ? <span id={`edit-minutes-${attempt.id}-note`} className={s.warn}>{minutesNote}</span> : undefined}
        >
          <Input
            id={`edit-minutes-${attempt.id}`}
            mono
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            placeholder="min"
            value={minutes}
            aria-invalid={minutesNote ? true : undefined}
            aria-describedby={minutesNote ? `edit-minutes-${attempt.id}-note` : undefined}
            onChange={(event) => setMinutes(event.target.value)}
            onBlur={() => setMinutes((current) => checkMinutes(current).text)}
          />
        </Field>
      </div>
      <Field label="How it went">
        <Segmented
          className={s.segmented}
          label="How it went"
          size="sm"
          value={rating}
          onChange={setRating}
          options={RATINGS.map((r) => ({ value: r, label: RATING_META[r].label }))}
        />
      </Field>
      <Field label="What tripped you up">
        <div className={s.chips} role="group" aria-label="Mistakes">
          {MISTAKE_TAGS.map((tag) => (
            <ToggleChip
              key={tag.id}
              className={s.chip}
              tone="neutral"
              pressed={mistakes.includes(tag.id)}
              onPressedChange={(on) => setMistakes((current) => (on ? [...current, tag.id] : current.filter((t) => t !== tag.id)))}
              title={tag.hint}
            >
              {tag.label}
            </ToggleChip>
          ))}
        </div>
      </Field>
      <div className={s.formActions}>
        <Button
          variant="primary"
          onClick={() => onSave({ date: checkDate(date, today).date || attempt.date, rating, minutes: checkMinutes(minutes).value, mistakes })}
        >
          Save changes
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

interface EntryProps {
  slug: string
  attempt: Attempt
  index: number
  total: number
  today: string
  editing: boolean
  onEdit: () => void
  onClose: () => void
}

function Entry({ slug, attempt, index, total, today, editing, onEdit, onClose }: EntryProps) {
  const actions = useActions()
  const label = attemptLabel(index)
  const target = attemptTarget(index)

  async function remove() {
    const only = total === 1
    const ok = await confirm({
      title: `Delete ${target}?`,
      body: only
        ? 'It is the only logged attempt, so this problem goes back to unsolved. Your notes are kept.'
        : 'It leaves your history, and the revision schedule is worked out again without it.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    actions.deleteAttempt(slug, attempt.id)
    toast({ message: `Deleted ${target}`, detail: dayLabel(attempt.date, today), action: { label: 'Undo', onClick: () => actions.undo() } })
  }

  return (
    <li className={cx(s.entry, editing && s.editing)} data-tone={attempt.rating}>
      <span className={s.node} aria-hidden="true" />
      <div className={s.head}>
        <span className={cx('num', s.date)}>{dayLabel(attempt.date, today)}</span>
        <span className={s.what}>
          {label}
          {attempt.source === 'mock' ? <span className={s.mock}> in a mock</span> : null}
        </span>
        {editing ? null : (
          <span className={s.tools}>
            <Tip content={`Edit ${target}`}>
              <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} aria-label={`Edit ${target} from ${dayLabel(attempt.date, today)}`} onClick={onEdit} />
            </Tip>
            <Tip content={`Delete ${target}`}>
              <Button variant="ghost" size="sm" iconOnly icon={<Trash />} aria-label={`Delete ${target} from ${dayLabel(attempt.date, today)}`} onClick={() => void remove()} />
            </Tip>
          </span>
        )}
      </div>

      {editing ? (
        <EditForm
          attempt={attempt}
          today={today}
          onSave={(patch) => {
            actions.updateAttempt(slug, attempt.id, patch)
            onClose()
          }}
          onCancel={onClose}
        />
      ) : (
        <>
          <div className={s.facts}>
            <Chip tone={RATING_TONE[attempt.rating]} variant="soft" dot>
              {RATING_META[attempt.rating].label}
            </Chip>
            {attempt.minutes !== null ? <span className={cx('num', s.minutes)}>{attempt.minutes} min</span> : null}
            {attempt.mistakes.map((tag) => (
              <Chip key={tag} face="sans">
                {MISTAKE_LABEL[tag]}
              </Chip>
            ))}
          </div>
          {attempt.recall ? <blockquote className={s.recall}>{attempt.recall}</blockquote> : null}
        </>
      )}
    </li>
  )
}

/** Every attempt, newest first, down a trail line. Each can be corrected in place or deleted. */
export function History({ view, today }: { view: ProblemView; today: string }) {
  const [editing, setEditing] = useState<string | null>(null)
  const total = view.attempts.length
  const newestFirst = view.attempts.map((attempt, index) => ({ attempt, index })).reverse()

  if (total === 0) {
    return (
      <Section label="History" aside="0 attempts">
        <p className={s.none}>
          <span className={s.noneNode} aria-hidden="true" />
          Nothing logged yet. Your first solve starts the trail.
        </p>
      </Section>
    )
  }

  return (
    <Section label="History" aside={`${total} ${total === 1 ? 'attempt' : 'attempts'}`}>
      <ol className={s.trail}>
        {newestFirst.map(({ attempt, index }) => (
          <Entry
            key={attempt.id}
            slug={view.problem.slug}
            attempt={attempt}
            index={index}
            total={total}
            today={today}
            editing={editing === attempt.id}
            onEdit={() => setEditing(attempt.id)}
            onClose={() => setEditing(null)}
          />
        ))}
      </ol>
    </Section>
  )
}
