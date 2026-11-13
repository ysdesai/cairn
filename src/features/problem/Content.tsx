import { ArrowDown, ArrowRight, ArrowUpRight, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES, type ProblemSheetControl, type SheetMode } from '../../app/nav'
import { getProblem, PROBLEMS } from '../../data'
import { coachUrl } from '../../domain/coach'
import { formatClock } from '../../domain/dates'
import { useActions, useData, useDerived, useToday } from '../../state/hooks'
import type { Rating } from '../../state/schema'
import { Button, confirm, LAYER, SheetBody, toast, useHotkeys } from '../../ui'
import type { ProblemView } from '../../domain/types'
import type { LeadAction } from './actionTypes'
import { ActionRow } from './ActionRow'
import { FooterBar } from './FooterBar'
import { Header } from './Header'
import { History } from './History'
import { LogForm } from './LogForm'
import { checkMinutes, consequence, timerEngaged, timerMs, validDate, wholeMinutes } from './logic'
import { INSIGHT_FIELD, Notes } from './Notes'
import { Recall, type RecallFlow } from './Recall'
import { Route } from './Route'
import { Section } from './Section'
import { TimerBlock } from './TimerBlock'
import { TitleBlock } from './TitleBlock'
import { SHEET_MARK, useEnterToLog } from './useEnterToLog'
import { useLogForm } from './useLogForm'
import s from './Content.module.css'

/** Asks whether leaving is fine. Resolves false when the person chooses to stay. */
export type LeaveGuard = () => Promise<boolean>

interface ContentProps {
  view: ProblemView
  mode: SheetMode
  open: boolean
  sheet: ProblemSheetControl
  registerGuard: (guard: LeaveGuard | null) => void
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Everything inside the sheet for one problem. Keyed by problem, so each one starts clean. */
export function Content({ view, mode, open, sheet, registerGuard }: ContentProps) {
  const { problem } = view
  const slug = problem.slug
  const actions = useActions()
  const navigate = useNavigate()
  const derived = useDerived()
  const today = useToday()
  const timer = useData().timer

  // A running mock that includes this problem: no hints, no notes, no tags, and the result is logged once, by the mock.
  const inMock = derived.activeMock?.status === 'running' && derived.activeMock.slugs.includes(slug)
  const [flow, setFlow] = useState<RecallFlow | null>(() => (mode === 'revise' && view.solved && !inMock ? { step: 'memory', text: '' } : null))
  const [justLogged, setJustLogged] = useState(false)
  const [logCount, setLogCount] = useState(0)
  const form = useLogForm(today)
  const routeRef = useRef<HTMLElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const engaged = timerEngaged(timer, slug)
  const memory = flow?.step === 'memory'

  // --- leaving with unsaved recall ---------------------------------------------------------------

  const dirty = flow !== null && flow.text.trim().length > 0
  const canLeave = useCallback<LeaveGuard>(async () => {
    if (!dirty) return true
    return confirm({
      title: 'Discard what you wrote?',
      body: 'Your recall is only kept when you log the revision.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep writing',
      tone: 'danger',
    })
  }, [dirty])
  useEffect(() => {
    registerGuard(canLeave)
    return () => registerGuard(null)
  }, [canLeave, registerGuard])
  const guarded = useCallback(
    (go: () => void) => {
      void canLeave().then((ok) => {
        if (ok) go()
      })
    },
    [canLeave],
  )

  // --- actions -----------------------------------------------------------------------------------

  async function startSolving() {
    if (!(await claimTimer())) return
    window.open(problem.url, '_blank', 'noopener')
  }

  function startRevision() {
    if (!view.solved || inMock) return
    form.reset()
    setJustLogged(false)
    setFlow({ step: 'memory', text: '' })
  }

  /** Start the timer here. Asks first when another problem's minutes would be thrown away; false if declined. */
  async function claimTimer(): Promise<boolean> {
    const other = timer && timer.slug !== slug ? getProblem(timer.slug) : undefined
    const lost = timerMs(timer)
    if (other && lost >= 60_000) {
      const ok = await confirm({
        title: 'Switch the timer?',
        body: `The ${formatClock(lost)} on ${other.title} will be discarded.`,
        confirmLabel: 'Switch and discard',
        tone: 'danger',
      })
      if (!ok) return false
    }
    actions.startTimer(slug)
    return true
  }

  function toggleTimer() {
    if (timer && timer.slug !== slug) void claimTimer()
    else if (timer && timer.runningSince !== null) actions.pauseTimer()
    else actions.startTimer(slug)
  }

  function jumpToLog() {
    const target = logRef.current
    if (!target) return
    target.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    target.querySelector<HTMLElement>('[role="radio"]')?.focus({ preventScroll: true })
  }

  const choose = (rating: Rating) => {
    const here = timer && timer.slug === slug ? timer : null
    // Picking a rating ends the attempt: stop the clock so the minutes filled in are the minutes on the timer.
    if (here && here.runningSince !== null) actions.pauseTimer()
    form.choose(rating, wholeMinutes(timerMs(here)))
  }

  function submit() {
    const rating = form.rating
    if (!rating) return
    const on = validDate(form.date, today)
    const detail = consequence(view, rating, on, today)
    actions.logAttempt(slug, {
      rating,
      minutes: checkMinutes(form.minutes).value,
      date: on,
      mistakes: form.mistakes,
      recall: flow?.text,
    })
    toast({ message: `Logged ${problem.title}`, detail, tone: 'success', action: { label: 'Undo', onClick: () => actions.undo() } })
    form.reset()
    setFlow(null)
    setJustLogged(true)
    setLogCount((n) => n + 1)
  }

  // After logging, bring the cairn into view: the new stone is the reward.
  useEffect(() => {
    if (logCount === 0) return
    const route = routeRef.current
    if (!route) return
    route.focus({ preventScroll: true })
    route.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [logCount])

  async function markUnsolved() {
    const n = view.attempts.length
    const ok = await confirm({
      title: 'Mark as unsolved?',
      body: `This removes its ${n} logged ${n === 1 ? 'attempt' : 'attempts'} and takes it out of rotation. Your notes are kept.`,
      confirmLabel: 'Mark unsolved',
      tone: 'danger',
    })
    if (!ok) return
    actions.markUnsolved(slug)
    toast({ message: `${problem.title} is unsolved`, detail: 'Removed from rotation', action: { label: 'Undo', onClick: () => actions.undo() } })
    setFlow(null)
    setJustLogged(false)
  }

  // --- what the primary button is ----------------------------------------------------------------

  const session = derived.session
  const queued = session && session.nextIndex >= 0 ? session.items[session.nextIndex] : null
  const upNext = queued && queued.slug !== slug ? queued : null

  function goNext() {
    if (!upNext) return
    if (upNext.slug) sheet.open(upNext.slug, { mode: upNext.kind === 'review' ? 'revise' : 'solve' })
    else navigate(ROUTES.drill)
  }

  let lead: LeadAction
  if (inMock) {
    lead = { label: 'Open on LeetCode', icon: <ArrowUpRight />, kbd: 'o', variant: 'primary', onClick: () => window.open(problem.url, '_blank', 'noopener') }
  } else if (justLogged && upNext) {
    lead = { label: `Next on the route: ${upNext.problem?.title ?? 'Pattern drill'}`, icon: <ArrowRight />, variant: 'primary', onClick: goNext }
  } else if (!view.solved) {
    lead = engaged
      ? { label: 'Log how it went', icon: <ArrowDown />, variant: 'primary', onClick: jumpToLog }
      : { label: 'Start solving', icon: <Play />, kbd: 's', variant: 'primary', onClick: () => void startSolving() }
  } else if (view.status === 'due') {
    lead = { label: 'Start revision', icon: <RotateCcw />, kbd: 'r', variant: 'primary', onClick: startRevision }
  } else {
    lead = { label: 'Revise now', icon: <RotateCcw />, kbd: 'r', variant: 'secondary', onClick: startRevision }
  }

  const logReady = form.rating !== null || flow?.step === 'compare'
  const logLabel = view.solved ? 'Log revision' : 'Log solve'
  const footer: LeadAction = memory
    ? { label: 'Reveal my notes', variant: 'primary', onClick: reveal }
    : logReady
      ? { label: logLabel, variant: 'primary', onClick: submit, disabled: form.rating === null }
      : lead
  // Only one ember button at a time: once a rating is chosen the log button takes it.
  // During a mock the LeetCode link beside it already does this; the lead is only for the phone footer.
  const inline: LeadAction | null = flow || inMock ? null : logReady ? { ...lead, variant: 'secondary' } : lead

  function reveal() {
    setFlow((current) => (current ? { ...current, step: 'compare' } : current))
  }

  // --- keys --------------------------------------------------------------------------------------

  const previous = PROBLEMS[problem.order - 2]
  const following = PROBLEMS[problem.order]
  const openProblem = (slugToOpen: string) => sheet.open(slugToOpen)

  const free = !inMock
  useHotkeys(
    {
      s: free && !view.solved && !engaged && (() => void startSolving()),
      t: free && toggleTimer,
      r: free && view.solved && !flow && startRevision,
      '1': free && !memory && (() => choose('easy')),
      '2': free && !memory && (() => choose('struggled')),
      '3': free && !memory && (() => choose('help')),
      n: free && !memory && (() => document.getElementById(INSIGHT_FIELD)?.focus()),
      o: () => window.open(problem.url, '_blank', 'noopener'),
      c: free && (() => window.open(coachUrl(problem), '_blank', 'noopener')),
      w: free && problem.videoUrl ? () => window.open(problem.videoUrl ?? '', '_blank', 'noopener') : null,
      '[': previous ? () => guarded(() => openProblem(previous.slug)) : null,
      ']': following ? () => guarded(() => openProblem(following.slug)) : null,
    },
    { layer: LAYER.sheet, enabled: open },
  )
  // These two work while typing: the whole point is to act without leaving the field.
  useHotkeys(
    {
      'mod+Enter': () => {
        if (memory) reveal()
        else if (form.rating) submit()
      },
    },
    { layer: LAYER.sheet, enabled: open, inFields: true },
  )
  useEnterToLog(open && form.rating !== null && !memory, submit)

  // --- the page ----------------------------------------------------------------------------------

  const log = (
    <div ref={logRef}>
      <LogForm
        view={view}
        form={form}
        today={today}
        onChoose={choose}
        onSubmit={submit}
        lede={view.solved ? undefined : 'Log it when you finish. It joins your revision route, and grows a cairn: one stone for each revision cleared, five for mastered.'}
        ghostCairn={!view.solved}
      />
    </div>
  )

  return (
    <>
      <Header problem={problem} blind={inMock} guarded={guarded} onOpen={openProblem} />
      <SheetBody>
        <div className={s.stack} {...{ [SHEET_MARK]: '' }}>
          <TitleBlock view={view} today={today} blind={inMock} recalling={memory} />
          <ActionRow problem={problem} lead={inline} mock={inMock} />

          {inMock ? (
            <Section label="Mock">
              <p className={s.mockNote}>
                The clock is running. Hints, your notes and your history stay closed until it stops, and you rate this problem once, when the mock ends.
              </p>
            </Section>
          ) : null}

          {flow ? (
            <Recall
              view={view}
              flow={flow}
              onText={(text) => setFlow((current) => (current ? { ...current, text } : current))}
              onReveal={reveal}
              onSkip={() => guarded(() => setFlow(null))}
              onCancel={() => guarded(() => setFlow(null))}
              onKeep={() => actions.setNotes(slug, { insight: flow.text.trim() })}
            >
              {log}
            </Recall>
          ) : null}

          {view.solved ? <Route ref={routeRef} view={view} today={today} /> : null}
          {inMock ? null : <TimerBlock view={view} onSwitch={() => void claimTimer()} />}
          {flow || inMock ? null : <Section label="Log">{log}</Section>}
          {memory || inMock ? null : <Notes view={view} today={today} open={open} />}
          {memory || inMock ? null : <History view={view} today={today} />}

          {view.solved && !memory && !inMock ? (
            <div className={s.leave}>
              <Button variant="ghost" size="sm" className={s.unsolve} onClick={() => void markUnsolved()}>
                Mark as unsolved
              </Button>
            </div>
          ) : null}
        </div>
      </SheetBody>
      <FooterBar action={footer} slug={slug} difficulty={problem.difficulty} timed={engaged && !inMock} />
    </>
  )
}
