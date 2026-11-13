import { Play, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { diffDays, formatDate } from '../../domain/dates'
import { estimateMinutes, buildSession, SESSION_PRESETS, viewSession } from '../../domain/session'
import type { SessionItem } from '../../state/schema'
import { useActions, useDerived, useSettings, useStatus, useToday } from '../../state/hooks'
import { ROUTES, useProblemSheet } from '../../app/nav'
import { Button, Chip, cx, Empty, Frame, Loader, PageHeader, ProblemRow, Segmented, toast, useHotkeys, useListCursor } from '../../ui'
import { Altimeter, Elevation } from './Altimeter'
import { Forecast } from './Forecast'
import { Head } from './Head'
import { Route } from './Route'
import { useNarrow } from './useNarrow'
import { StreakStrip } from './Streak'
import { briefing, plural } from './briefing'
import { pace, PULLED, reconcile, routeKey } from './plan'
import s from './TodayScreen.module.css'

type ViewItem = NonNullable<ReturnType<typeof viewSession>>['items'][number]

/** The home screen. Waits for the stored document before drawing anything that depends on it. */
export default function TodayScreen() {
  const status = useStatus()
  if (status === 'loading') {
    return (
      <div className="page">
        <Loader label="Opening today's route" />
      </div>
    )
  }
  return <Today />
}

const rate = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Today() {
  const derived = useDerived()
  const settings = useSettings()
  const today = useToday()
  const actions = useActions()
  const sheet = useProblemSheet()
  const navigate = useNavigate()
  const { counts, queue, plan, streak, suggestion } = derived
  const narrow = useNarrow()

  const firstRun = counts.solved === 0 && derived.activity.activeDays === 0 && derived.drill.total === 0

  const plannedFor = (minutes: number): SessionItem[] => {
    const items = buildSession({
      minutes,
      queue,
      recommendations: derived.recommendations,
      problems: derived.problems,
      targets: settings.targets,
    })
    // Pattern cards assume some patterns have been met; a first visit starts on a problem instead.
    return firstRun ? items.filter((item) => item.kind !== 'drill') : items
  }

  const plain = (items: readonly ViewItem[]): SessionItem[] =>
    items.map((item) => ({ kind: item.kind, ...(item.slug ? { slug: item.slug } : {}), minutes: item.minutes, reason: item.reason }))

  const stored = derived.session
  const preview = useMemo(
    () => (stored ? [] : plannedFor(settings.sessionMinutes)),
    [stored, derived, settings],
  )
  // The stored route is kept steady through the day, but never stale: a backdated solve, a new daily cap or
  // new timer targets bring it up to date (finished stops stay checked off).
  const storedItems = useMemo(() => (stored ? plain(stored.items) : null), [stored])
  const current = useMemo(
    () => (storedItems && stored ? reconcile(storedItems, stored.budget, derived, settings.targets) : null),
    [storedItems, stored, derived, settings.targets],
  )
  const session =
    stored && current
      ? viewSession({ date: today, budget: stored.budget, items: current, createdAt: 0 }, derived.problems, derived.drill.today, today)!
      : viewSession({ date: today, budget: settings.sessionMinutes, items: preview, createdAt: 0 }, derived.problems, derived.drill.today, today)!

  useEffect(() => {
    if (!stored && preview.length > 0) {
      actions.setSession({ date: today, budget: settings.sessionMinutes, items: preview, createdAt: Date.now() })
    } else if (stored && storedItems && current && routeKey(current) !== routeKey(storedItems)) {
      actions.setSession({ date: today, budget: stored.budget, items: current, createdAt: Date.now() })
    }
  }, [stored, storedItems, current, preview, today, settings.sessionMinutes, actions])

  const rebuild = (minutes: number) => {
    actions.setSession({ date: today, budget: minutes, items: plannedFor(minutes), createdAt: Date.now() })
    actions.updateSettings({ sessionMinutes: minutes })
  }

  // Every due revision that is not on the route, the cap's allowance first, then the rest, most urgent first.
  const inRoute = new Set(session.items.map((item) => item.slug))
  const outside = [...queue.today, ...queue.waiting].filter((view) => !inRoute.has(view.problem.slug))
  const fit = queue.today.filter((view) => !inRoute.has(view.problem.slug)).length
  const backlog = { fit, held: outside.length - fit }

  const pullOne = () => {
    const view = outside[0]
    if (!view) return
    const items = plain(session.items)
    const at = items.reduce((last, item, i) => (item.kind === 'review' ? i : last), items.findIndex((item) => item.kind === 'drill'))
    items.splice(at + 1, 0, {
      kind: 'review',
      slug: view.problem.slug,
      minutes: estimateMinutes(view, 'review', settings.targets),
      reason: PULLED,
    })
    actions.setSession({ date: today, budget: session.budget, items, createdAt: Date.now() })
    toast({ message: `Added ${view.problem.title}`, id: 'route', tone: 'success' })
  }

  const openItem = (item: ViewItem) => {
    if (item.kind === 'drill') navigate('/drill?start=10')
    else if (item.slug) sheet.open(item.slug, item.kind === 'review' && !item.done ? { mode: 'revise' } : undefined)
  }

  const finished = session.items.length > 0 && session.nextIndex === -1
  const hasPending = session.nextIndex >= 0

  const cursor = useListCursor(session.items, {
    onOpen: (item) => openItem(item),
    enabled: hasPending,
    initial: Math.max(0, session.nextIndex),
  })

  useHotkeys({
    b: () => {
      rebuild(settings.sessionMinutes)
      toast({ message: `Route rebuilt for ${settings.sessionMinutes} minutes`, id: 'route' })
    },
  })
  useHotkeys({ Enter: () => rebuild(settings.sessionMinutes) }, { enabled: finished })

  const start = () => {
    const item = session.items[session.nextIndex]
    if (item) openItem(item)
  }

  const copy = briefing(derived, session, firstRun, backlog)
  const budget = session.items.length > 0 || stored ? session.budget : settings.sessionMinutes
  const presets = SESSION_PRESETS.includes(budget) ? SESSION_PRESETS : [...SESSION_PRESETS, budget].sort((a, b) => a - b)

  const rotation = counts.learning + counts.due
  // The year only earns its place when the date is far enough off to be ambiguous.
  const when = (iso: string) => formatDate(iso, Math.abs(diffDays(today, iso)) < 300 ? 'short' : 'medium')
  const daysToStart = diffDays(today, plan.startDate)
  const paceNow = pace(plan, when, daysToStart)
  const weekday = formatDate(today, 'weekday')
  const meta =
    paceNow.phase === 'before'
      ? `${weekday} · Starts ${daysToStart === 1 ? 'tomorrow' : `in ${daysToStart} days`}`
      : paceNow.phase === 'after'
        ? `${weekday} · Target passed`
        : paceNow.phase === 'done' && plan.dayNumber > plan.totalDays
          ? `${weekday} · Plan complete`
          : `${weekday} · Day ${plan.dayNumber} of ${plan.totalDays}`

  const suggest = () => {
    if (suggestion.kind === 'drill' && !suggestion.problem) navigate(ROUTES.drill)
    else if (suggestion.problem) sheet.open(suggestion.problem.slug, suggestion.kind === 'revise' ? { mode: 'revise' } : undefined)
    else if (suggestion.topic) navigate(ROUTES.topic(suggestion.topic))
    else navigate(ROUTES.map)
  }
  const suggestLabel = suggestion.problem
    ? `Open ${suggestion.problem.title}`
    : suggestion.kind === 'drill'
      ? 'Start a drill'
      : suggestion.topic
        ? 'Open the topic'
        : 'Open the map'

  // New problems to attempt next that the route does not already carry, so they are always in view.
  const deck = derived.recommendations.filter((rec) => !inRoute.has(rec.problem.slug)).slice(0, 4)

  // A pointer click leaves focus on the button it hit, which would claim Enter; let go so Enter starts the route.
  const letGo = (event: MouseEvent<HTMLElement>) => {
    if (event.detail > 0 && document.activeElement instanceof HTMLElement && event.currentTarget.contains(document.activeElement)) document.activeElement.blur()
  }
  // Pick a time with the arrow keys, then Enter starts the route.
  const startFromTime = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' && hasPending && event.target instanceof HTMLElement && event.target.matches('[role="radio"]')) {
      event.preventDefault()
      start()
    }
  }

  return (
    <div className="page">
      <PageHeader
        sheet="01"
        name="Today"
        terrain={1}
        meta={meta}
        title={copy.title}
        lede={copy.lede}
        actions={
          <div className={s.actions}>
            {hasPending ? (
              <Button variant="primary" size="lg" icon={<Play />} kbd="Enter" onClick={start} className={s.start}>
                Start
              </Button>
            ) : null}
            <div className={s.budget} onClick={letGo} onKeyDown={startFromTime}>
              <span className={s.have}>I have</span>
              <Segmented
                label="Time for today's route"
                value={budget}
                onChange={(minutes) => {
                  if (minutes !== budget) rebuild(minutes)
                }}
                options={presets.map((m) => ({ value: m, label: `${m} min` }))}
                className={s.seg}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw />}
                kbd="b"
                className={s.rebuild}
                onClick={() => {
                  rebuild(settings.sessionMinutes)
                  toast({ message: `Route rebuilt for ${settings.sessionMinutes} minutes`, id: 'route' })
                }}
              >
                Rebuild
              </Button>
            </div>
          </div>
        }
      />

      <p className={s.glance} aria-hidden="true">
        <span>
          <span className="num">{counts.solved}</span> of <span className="num">{counts.total}</span> solved
        </span>
        <span>
          <span className="num">{streak.current}</span> day streak
        </span>
        <span className={s.glancePace}>{paceNow.text}</span>
      </p>

      <div className={s.cols}>
        <div className={s.main}>
          <section className={s.route} aria-label="The route">
            {session.items.length > 0 ? (
              <Route
                session={session}
                views={derived.problems}
                cursor={cursor}
                outside={outside}
                fit={fit}
                onOpen={openItem}
                onPull={pullOne}
                onBuildAnother={() => rebuild(settings.sessionMinutes)}
              />
            ) : counts.todo === 0 && queue.totalDue === 0 ? (
              <Empty
                compact
                seed={5}
                title="Nothing on the route."
                body="Every problem is solved. Revisions will appear here the day they come due; a drill keeps the patterns fresh in between."
                action={
                  <Button onClick={() => navigate(ROUTES.drill)} variant="primary">
                    Start a drill
                  </Button>
                }
              />
            ) : (
              <Empty
                compact
                seed={5}
                title={`Nothing fits in ${budget} minutes.`}
                body="Choose a longer sitting and the route fills in with what is due and what comes next."
                action={
                  <Button variant="primary" onClick={() => rebuild(Math.max(...SESSION_PRESETS))}>
                    Plan {Math.max(...SESSION_PRESETS)} minutes
                  </Button>
                }
              />
            )}
          </section>

          <Frame label="Work on this next" className={s.suggest}>
            <p className="title title-sm">{suggestion.headline}</p>
            <p className={s.detail}>{suggestion.detail}</p>
            <Button onClick={suggest}>{suggestLabel}</Button>
          </Frame>

          <section className={s.deck} aria-label="On deck">
            <Head label="On deck" aside={deck.length > 0 ? `${deck.length} new` : undefined} />
            {deck.length > 0 ? (
              <ul className={s.deckList}>
                {deck.map((rec) => {
                  const view = derived.problems[rec.problem.slug]
                  return view ? (
                    <li key={rec.problem.slug}>
                      <ProblemRow
                        view={view}
                        showTopic={false}
                        note={narrow ? undefined : rec.note}
                        detail={narrow ? rec.note : undefined}
                        trailing={<span className="num">≈ {estimateMinutes(view, 'new', settings.targets)} min</span>}
                        onOpen={(slug) => sheet.open(slug)}
                      />
                    </li>
                  ) : null
                })}
              </ul>
            ) : (
              <p className={s.hint}>
                {counts.todo === 0
                  ? 'Every problem has been attempted. Revisions fill the route from here.'
                  : 'Everything new that comes next is already on today’s route.'}
              </p>
            )}
          </section>
        </div>

        <aside className={s.standing} aria-label="Where you stand">
          <section className={cx(s.block, s.wide)}>
            <Head label="Altitude" aside={`${counts.total} problems`} />
            <div className={s.altitude}>
              <Altimeter
                solved={counts.solved}
                total={counts.total}
                expected={plan.expected}
                dayNumber={plan.dayNumber}
                totalDays={plan.totalDays}
                showPlan={paceNow.phase !== 'before'}
              />
              <div className={s.reading}>
                <div className={s.numeral}>
                  <span className="eyebrow">Solved</span>
                  <Elevation solved={counts.solved} total={counts.total} />
                </div>
                <dl className={s.facts}>
                  <div>
                    <dt className="sr-only">Progress</dt>
                    <dd>
                      <span className="num">{counts.mastered}</span> mastered · <span className="num">{rotation}</span> in rotation
                    </dd>
                  </div>
                  <div className={s.pace}>
                    <dt className="sr-only">Pace</dt>
                    <dd>
                      <span className={s.paceChip}>
                        <Chip tone={paceNow.tone} variant={paceNow.variant}>
                          {paceNow.text}
                        </Chip>
                      </span>
                      {paceNow.phase === 'before' ? (
                        <span className="muted">The plan has not started; nothing is measured against it yet.</span>
                      ) : paceNow.phase === 'after' ? (
                        <span className="muted">
                          The target was <span className="num">{when(plan.targetDate)}</span>; <span className="num">{plan.remaining}</span> to go.
                        </span>
                      ) : paceNow.phase === 'done' ? (
                        <span className="muted">Every problem is solved.</span>
                      ) : plan.status === 'not-started' || counts.solved === 0 ? (
                        <span className="muted">Solve one problem and the ember column starts to climb.</span>
                      ) : (
                        <span className="muted">
                          The plan expects <span className="num">{plan.expected}</span> by today.
                        </span>
                      )}
                    </dd>
                  </div>
                  {paceNow.phase === 'during' || paceNow.phase === 'after' ? (
                    <div>
                      <dt className="sr-only">Rate</dt>
                      <dd>
                        {paceNow.phase === 'during' ? (
                          <>
                            Needs <span className="num">{rate(plan.neededPerDay)}</span> a day · you average{' '}
                          </>
                        ) : (
                          <>You average </>
                        )}
                        <span className="num">{rate(plan.recentPerDay)}</span>
                        {paceNow.phase === 'after' ? ' a day' : null}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="sr-only">Finish</dt>
                    <dd>
                      {paceNow.phase === 'done' ? (
                        <>
                          {plan.projectedFinish ? (
                            <>
                              Finished <span className="num">{when(plan.projectedFinish)}</span> ·{' '}
                            </>
                          ) : null}
                          target <span className="num">{when(plan.targetDate)}</span>
                        </>
                      ) : paceNow.phase === 'before' ? (
                        <>
                          Starts <span className="num">{when(plan.startDate)}</span> · target <span className="num">{when(plan.targetDate)}</span>
                        </>
                      ) : plan.projectedFinish ? (
                        <>
                          {paceNow.phase === 'after' ? 'At this pace, done ' : 'Projected '}
                          <span className="num">{when(plan.projectedFinish)}</span>
                          {paceNow.phase === 'after' ? null : (
                            <>
                              {' '}
                              · target <span className="num">{when(plan.targetDate)}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          Target <span className="num">{when(plan.targetDate)}</span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className={s.block}>
            <Head label="Streak" aside={`Best ${streak.best}`} />
            <div className={s.streak}>
              <p className={s.streakCount}>
                <span className="stat">{streak.current}</span>
                <span className="num muted">{plural(streak.current, 'day')}</span>
                {streak.current === 0 ? <span className="muted">A solve or a revision today starts one.</span> : null}
              </p>
              <StreakStrip streak={streak} today={today} />
            </div>
          </section>

          <section className={s.block}>
            <Head label="Revisions ahead" aside={queue.totalDue > 0 ? `${queue.totalDue} due · ${queue.cap} a day` : '14 days'} />
            <Forecast days={derived.forecast} cap={queue.cap} />
            {queue.totalDue === 0 && derived.forecast.every((d) => d.scheduled === 0) ? (
              <p className={s.hint}>Nothing is scheduled yet. Each problem you solve returns here for its first revision.</p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}
