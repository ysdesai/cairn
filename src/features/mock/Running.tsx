import { ArrowUpRight, Check, EyeOff } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { getProblem } from '../../data'
import { formatClock } from '../../domain/dates'
import type { MockSession } from '../../state/schema'
import { useActions, useNow, useSettings } from '../../state/hooks'
import { Button, ButtonLink, Chip, confirm, Frame, GradeMark, Terrain, useHotkeys } from '../../ui'
import { formatTimeOfDay, numberWord } from './format'
import s from './Running.module.css'

const LAST_STRETCH_MS = 5 * 60000
const SIZE = 320
const MID = SIZE / 2
const R_ARC = 124
const TICK_FROM = 140

function Ticks({ minutes, elapsedMinutes }: { minutes: number; elapsedMinutes: number }) {
  return (
    <g>
      {Array.from({ length: minutes }, (_, i) => {
        const angle = (i / minutes) * 2 * Math.PI - Math.PI / 2
        const long = i % 5 === 0
        const to = TICK_FROM + (long ? 11 : 6)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return (
          <line
            key={i}
            x1={MID + cos * TICK_FROM}
            y1={MID + sin * TICK_FROM}
            x2={MID + cos * to}
            y2={MID + sin * to}
            className={i < elapsedMinutes ? s.tickPast : long ? s.tickMajor : s.tick}
          />
        )
      })}
    </g>
  )
}

function Clock({ mock, remaining }: { mock: MockSession; remaining: number }) {
  const total = mock.config.minutes * 60000
  const fraction = total > 0 ? remaining / total : 0
  const last = remaining <= LAST_STRETCH_MS
  const circumference = 2 * Math.PI * R_ARC
  const tip = -Math.PI / 2 + fraction * 2 * Math.PI
  const shown = Math.ceil(remaining / 1000) * 1000
  const [mm, ss] = formatClock(shown).split(':')
  const minutesLeft = Math.ceil(remaining / 60000)
  const elapsedMinutes = Math.floor((total - remaining) / 60000)
  const spoken = [10, 5, 1].includes(minutesLeft) && remaining > 0 ? `${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} left` : ''

  return (
    <div className={s.clock} data-last={last || undefined} role="timer" aria-label={`Time remaining ${mm} minutes ${ss} seconds`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={s.dial} aria-hidden="true">
        <Ticks minutes={mock.config.minutes} elapsedMinutes={elapsedMinutes} />
        <circle className={s.disc} cx={MID} cy={MID} r={R_ARC} />
        <circle className={s.track} cx={MID} cy={MID} r={R_ARC} />
        {fraction > 0 ? (
          <>
            <circle
              className={s.arc}
              cx={MID}
              cy={MID}
              r={R_ARC}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fraction)}
              transform={`rotate(-90 ${MID} ${MID})`}
            />
            <circle className={s.tip} cx={MID + Math.cos(tip) * R_ARC} cy={MID + Math.sin(tip) * R_ARC} r="4.5" />
          </>
        ) : null}
      </svg>
      <div className={s.face}>
        <p className={`eyebrow ${s.faceLabel}`}>{last ? 'Last five minutes' : 'Remaining'}</p>
        <p className={`stat ${s.digits}`}>
          {mm}
          <span className={s.colon}>:</span>
          {ss}
        </p>
        <p className={`num ${s.ends}`}>Ends {formatTimeOfDay(mock.startedAt + total)}</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {spoken}
      </p>
    </div>
  )
}

interface PanelProps {
  index: number
  slug: string
  finishedAt: number | undefined
  keyHint: string
  onToggle: () => void
}

function ProblemPanel({ index, slug, finishedAt, keyHint, onToggle }: PanelProps) {
  const settings = useSettings()
  const problem = getProblem(slug)
  if (!problem) return null
  const finished = finishedAt !== undefined
  return (
    <Frame
      label={`Problem ${index + 1}`}
      aside={`Target ${settings.targets[problem.difficulty]}m`}
      className={finished ? s.finished : undefined}
      pad="lg"
    >
      <div className={s.panel}>
        <h2 className={`title ${s.name}`}>{problem.title}</h2>
        <p className={s.facts}>
          <span className="num muted">#{problem.number}</span>
          <GradeMark difficulty={problem.difficulty} label />
          {problem.premium ? <Chip>Premium</Chip> : null}
        </p>
        <div className={s.actions}>
          <ButtonLink href={problem.url} external icon={<ArrowUpRight />}>
            Open on LeetCode
          </ButtonLink>
          <Button
            aria-pressed={finished}
            data-mark={slug}
            className={finished ? s.done : undefined}
            icon={finished ? <Check /> : undefined}
            kbd={keyHint}
            onClick={onToggle}
          >
            {finished ? (
              <>
                Finished at <span className="num">{formatClock(finishedAt)}</span>
              </>
            ) : (
              'Mark finished'
            )}
          </Button>
        </div>
      </div>
    </Frame>
  )
}

export function Running({ mock }: { mock: MockSession }) {
  const actions = useActions()
  const now = useNow(1000)
  const total = mock.config.minutes * 60000
  const remaining = Math.max(0, mock.startedAt + total - now)

  // The clock lives in the stored start time; reaching zero just moves the mock on, once. This
  // runs before paint and the view renders nothing meanwhile, so a mock found already out of
  // time (a reload, a trip to another screen) goes straight to rating without a frame of 00:00.
  const ended = useRef(false)
  useLayoutEffect(() => {
    if (remaining > 0 || ended.current) return
    ended.current = true
    actions.endMock()
  }, [remaining, actions])

  async function endEarly() {
    const ok = await confirm({
      title: 'End the mock now?',
      body: 'The clock stops and you rate each problem. Problems you have not marked finished can be rated as not finished.',
      confirmLabel: 'End mock',
    })
    if (ok) actions.endMock()
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

  const slugs = mock.slugs

  // The number keys work with nothing focused, which would leave focus on <body>. Put it where
  // the next action is: the other problem's button while one is still open, else End early.
  function markByKey(slug: string) {
    const finishing = !Object.hasOwn(mock.marks, slug)
    actions.markMockProblem(slug)
    const idle = !document.activeElement || document.activeElement === document.body
    if (!idle) return
    const next = finishing ? slugs.find((other) => other !== slug && !Object.hasOwn(mock.marks, other)) : slug
    const target = next ? `[data-mark="${next}"]` : '[data-end-early]'
    document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true })
  }

  useHotkeys({
    1: slugs[0] ? () => markByKey(slugs[0]) : false,
    2: slugs[1] ? () => markByKey(slugs[1]) : false,
    e: () => void endEarly(),
  })

  const started = useMemo(() => formatTimeOfDay(mock.startedAt), [mock.startedAt])

  if (remaining <= 0) return null

  return (
    <>
      <div className={s.margin}>
        <span className="eyebrow">
          <span className="muted">Sheet 05</span>
          <span className={s.sep} aria-hidden="true" />
          <span className={s.sheetName}>Mock</span>
        </span>
        <span className={s.scale} aria-hidden="true" />
        <span className="eyebrow">Started {started}</span>
      </div>

      <h1 className="sr-only" tabIndex={-1}>
        {numberWord(mock.config.minutes)} minute mock interview in progress
      </h1>

      <section className={s.stage} aria-label="Countdown">
        <div className={s.terrain} aria-hidden="true">
          <Terrain seed={5} fade="edges" />
        </div>
        <Clock mock={mock} remaining={remaining} />
      </section>

      <div className={s.panels}>
        {slugs.map((slug, index) => (
          <ProblemPanel
            key={slug}
            index={index}
            slug={slug}
            finishedAt={Object.hasOwn(mock.marks, slug) ? mock.marks[slug] : undefined}
            keyHint={String(index + 1)}
            onToggle={() => actions.markMockProblem(slug)}
          />
        ))}
      </div>

      <div className={s.foot}>
        <p className={s.quiet}>
          <EyeOff aria-hidden="true" />
          Topic and pattern tags are hidden until you rate.
        </p>
        <div className={s.footActions}>
          <Button kbd="e" data-end-early="" onClick={() => void endEarly()}>
            End early
          </Button>
          <Button variant="ghost" onClick={() => void abandon()}>
            Abandon
          </Button>
        </div>
      </div>
    </>
  )
}
