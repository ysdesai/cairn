import { motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { useState } from 'react'
import { getProblem, PATTERN_BY_ID, TOPIC_BY_ID } from '../../data'
import type { Problem } from '../../data/types'
import { formatClock, formatMinutes } from '../../domain/dates'
import { MISTAKE_TAGS, RATING_META, RATINGS } from '../../state/schema'
import type { MistakeTag, MockOutcome, MockResult, MockSession } from '../../state/schema'
import { useActions } from '../../state/hooks'
import { Button, Chip, confirm, cx, Field, Frame, GradeMark, Input, PageHeader, RATING_TONE, ToggleChip, fade, toast } from '../../ui'
import { minutesUsed, wholeMinutes } from './format'
import s from './Rating.module.css'

interface Entry {
  outcome: MockOutcome | null
  minutes: string
  mistakes: MistakeTag[]
}

const CHOICES: { value: MockOutcome; label: string; hint: string; tone: 'moss' | 'gold' | 'dusk' | 'neutral' }[] = [
  ...RATINGS.map((value) => ({
    value,
    label: RATING_META[value].label,
    hint: RATING_META[value].hint,
    tone: RATING_TONE[value] as 'moss' | 'gold' | 'dusk',
  })),
  { value: 'unfinished', label: 'Did not finish', hint: 'Nothing is logged', tone: 'neutral' },
]

/**
 * Minutes to offer for each problem. Whichever was marked finished first gets its mark, the
 * next gets the gap between marks, and a problem never marked gets the time left after the
 * last mark. With no marks at all there is nothing to go on, so the fields start empty.
 */
function suggestMinutes(mock: MockSession): Record<string, number | null> {
  const deadline = mock.startedAt + mock.config.minutes * 60000
  const total = Math.min(mock.endedAt ?? deadline, deadline) - mock.startedAt
  const out: Record<string, number | null> = Object.fromEntries(mock.slugs.map((slug) => [slug, null]))
  const marked = mock.slugs.filter((slug) => Object.hasOwn(mock.marks, slug)).sort((a, b) => mock.marks[a] - mock.marks[b])
  let previous = 0
  for (const slug of marked) {
    out[slug] = wholeMinutes(mock.marks[slug] - previous)
    previous = mock.marks[slug]
  }
  const open = mock.slugs.filter((slug) => !marked.includes(slug))
  if (marked.length > 0 && open.length > 0 && total - previous > 0) {
    for (const slug of open) out[slug] = wholeMinutes((total - previous) / open.length)
  }
  return out
}

function initialEntries(mock: MockSession): Record<string, Entry> {
  const minutes = suggestMinutes(mock)
  return Object.fromEntries(
    mock.slugs.map((slug) => [
      slug,
      {
        outcome: Object.hasOwn(mock.marks, slug) ? null : 'unfinished',
        minutes: minutes[slug] == null ? '' : String(minutes[slug]),
        mistakes: [],
      } satisfies Entry,
    ]),
  )
}

interface ProblemEntryProps {
  index: number
  problem: Problem
  finishedAt: number | undefined
  entry: Entry
  onChange: (patch: Partial<Entry>) => void
}

function ProblemEntry({ index, problem, finishedAt, entry, onChange }: ProblemEntryProps) {
  const topic = TOPIC_BY_ID[problem.topic]
  const pattern = PATTERN_BY_ID[problem.pattern]
  const name = `outcome-${index}`

  return (
    <article className={s.entry} aria-labelledby={`entry-title-${index}`}>
      <div className={s.about}>
        <p className="eyebrow">Problem {index + 1}</p>
        <h2 id={`entry-title-${index}`} className={cx('title', s.name)}>
          {problem.title}
        </h2>
        <p className={s.facts}>
          <span className="num muted">#{problem.number}</span>
          <GradeMark difficulty={problem.difficulty} label />
          <span className="muted">
            {finishedAt !== undefined ? (
              <>
                Finished at <span className="num">{formatClock(finishedAt)}</span>
              </>
            ) : (
              'Not marked finished'
            )}
          </span>
        </p>

        <motion.dl className={s.reveal} variants={fade} initial="initial" animate="enter">
          <div>
            <dt className="eyebrow">Topic</dt>
            <dd className={cx('place', s.topic)}>{topic.name}</dd>
          </div>
          <div>
            <dt className="eyebrow">Pattern</dt>
            <dd>{pattern.name}</dd>
          </div>
          <div>
            <dt className="eyebrow">Tags</dt>
            <dd className={s.tags}>
              {problem.tags.map((tag) => (
                <Chip key={tag} face="sans">
                  {tag}
                </Chip>
              ))}
            </dd>
          </div>
        </motion.dl>
      </div>

      <div className={s.controls}>
        <fieldset className={s.outcome}>
          <legend className="eyebrow">Outcome</legend>
          <div className={s.choices}>
            {CHOICES.map((choice) => {
              const checked = entry.outcome === choice.value
              return (
                <label key={choice.value} className={cx(s.choice, s[choice.tone], checked && s.checked)}>
                  <input
                    type="radio"
                    name={name}
                    className={s.radio}
                    checked={checked}
                    onChange={() => onChange({ outcome: choice.value })}
                  />
                  <span className={s.face}>
                    <span className={s.choiceHead}>
                      <span className={s.dot} aria-hidden="true" />
                      <span className={s.choiceLabel}>{choice.label}</span>
                      {checked ? <Check className={s.check} aria-hidden="true" /> : null}
                    </span>
                    <span className={s.choiceHint}>{choice.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <Field label="Minutes" htmlFor={`minutes-${index}`} hint="Time on this problem. Editable.">
          <Input
            id={`minutes-${index}`}
            mono
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            placeholder="min"
            className={s.minutes}
            value={entry.minutes}
            onChange={(event) => onChange({ minutes: event.target.value })}
          />
        </Field>

        <div className={s.mistakes} role="group" aria-labelledby={`mistakes-${index}`}>
          <p id={`mistakes-${index}`} className="eyebrow">
            What went wrong <span className={s.optional}>optional</span>
          </p>
          <div className={s.chips}>
            {MISTAKE_TAGS.map((tag) => (
              <ToggleChip
                key={tag.id}
                pressed={entry.mistakes.includes(tag.id)}
                title={tag.hint}
                onPressedChange={(on) =>
                  onChange({ mistakes: on ? [...entry.mistakes, tag.id] : entry.mistakes.filter((m) => m !== tag.id) })
                }
              >
                {tag.label}
              </ToggleChip>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

export function Rating({ mock }: { mock: MockSession }) {
  const actions = useActions()
  const [entries, setEntries] = useState(() => initialEntries(mock))

  const deadline = mock.startedAt + mock.config.minutes * 60000
  const timeUp = (mock.endedAt ?? deadline) >= deadline
  const used = minutesUsed(mock)

  const problems = mock.slugs.map((slug) => getProblem(slug)).filter((p): p is Problem => !!p)
  const unrated = problems.filter((p) => entries[p.slug].outcome === null).length
  const logged = problems.filter((p) => {
    const outcome = entries[p.slug].outcome
    return outcome !== null && outcome !== 'unfinished'
  }).length

  function patch(slug: string, change: Partial<Entry>) {
    setEntries((current) => ({ ...current, [slug]: { ...current[slug], ...change } }))
  }

  function save() {
    if (unrated > 0) return
    const results: Record<string, MockResult> = {}
    for (const problem of problems) {
      const entry = entries[problem.slug]
      const minutes = entry.minutes.trim() === '' ? null : Number(entry.minutes)
      results[problem.slug] = {
        outcome: entry.outcome ?? 'unfinished',
        minutes: minutes !== null && Number.isFinite(minutes) ? minutes : null,
        mistakes: entry.mistakes,
      }
    }
    actions.rateMock(results)
    window.scrollTo(0, 0)
    toast({
      message: 'Mock saved',
      detail: logged === 0 ? 'Nothing was logged' : `${logged} ${logged === 1 ? 'attempt' : 'attempts'} added to your history`,
      tone: 'success',
    })
  }

  async function abandon() {
    const ok = await confirm({
      title: 'Abandon this mock?',
      body: 'Nothing is logged and it does not appear in your history.',
      confirmLabel: 'Abandon',
      tone: 'danger',
    })
    if (ok) actions.abandonMock()
  }

  return (
    <>
      <PageHeader
        sheet="05"
        name="Mock"
        terrain={5}
        meta={
          <>
            <span className="num">{formatMinutes(used)}</span> of <span className="num">{formatMinutes(mock.config.minutes)}</span> used
          </>
        }
        title={
          <>
            How did it <em>go</em>?
          </>
        }
        lede="Topic and pattern are shown now. Rate each problem; every one you finished is logged as an attempt and scheduled for revision."
      />

      <div className={s.notice} role="status">
        <Clock aria-hidden="true" />
        <span className={cx('place', s.noticeWord)}>{timeUp ? 'Time.' : 'Stopped.'}</span>
        <span className={s.noticeText}>
          {timeUp
            ? `The ${mock.config.minutes} minutes are up.`
            : `You ended the mock after ${formatMinutes(used)} of ${formatMinutes(mock.config.minutes)}.`}
        </span>
      </div>

      <Frame label="Results" aside={`${problems.length} problems`} pad="none">
        {problems.map((problem, index) => (
          <ProblemEntry
            key={problem.slug}
            index={index}
            problem={problem}
            finishedAt={Object.hasOwn(mock.marks, problem.slug) ? mock.marks[problem.slug] : undefined}
            entry={entries[problem.slug]}
            onChange={(change) => patch(problem.slug, change)}
          />
        ))}

        <div className={s.foot}>
          <p className={s.summary} aria-live="polite">
            {unrated > 0 ? (
              <>
                Choose an outcome for {unrated === problems.length ? 'each problem' : 'the other problem'} to save.
              </>
            ) : (
              <>
                <span className="num">{logged}</span> of <span className="num">{problems.length}</span> will be logged as attempts.
              </>
            )}
          </p>
          <div className={s.footActions}>
            <Button variant="ghost" onClick={() => void abandon()}>
              Abandon
            </Button>
            <Button variant="primary" size="lg" disabled={unrated > 0} onClick={save}>
              Save results
            </Button>
          </div>
        </div>
      </Frame>
    </>
  )
}
