import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Flame, ListChecks, Monitor, Moon, MountainSnow, Search, Settings, Sun, Sunrise, Timer, Zap } from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { getProblem, isTopicId } from '../data'
import { formatClock } from '../domain/dates'
import { useActions, useData, useDerived, useNow, useStorageProblems, useTimer } from '../state/hooks'
import { cycleTheme, useTheme } from '../state/prefs'
import { Button, CairnMark, Kbd, pageVariants, spring, Tip, toast, useHotkeys, cx } from '../ui'
import { ErrorBoundary } from './ErrorBoundary'
import { exitDemo } from './demo'
import { NAV, ROUTES, useProblemSheet } from './nav'
import { lazyChunk, preloadAllWhenIdle, preloadRoute } from './screens'
import { openPalette, openShortcuts, useUi } from './ui'
import s from './Shell.module.css'

const ProblemSheet = lazyChunk('problemSheet')
const CommandPalette = lazyChunk('palette')
const ShortcutsDialog = lazyChunk('shortcuts')
const Celebrations = lazyChunk('celebrations')
const Welcome = lazyChunk('welcome')

const OVERLAYS = [ProblemSheet, CommandPalette, ShortcutsDialog, Celebrations, Welcome]

const NAV_ICONS: Record<string, ReactNode> = {
  [ROUTES.today]: <Sunrise />,
  [ROUTES.map]: <MountainSnow />,
  [ROUTES.problems]: <ListChecks />,
  [ROUTES.drill]: <Zap />,
  [ROUTES.mock]: <Timer />,
  [ROUTES.insights]: <Activity />,
}

const SCREEN_TITLES: Record<string, string> = {
  '': 'Today',
  map: 'Map',
  problems: 'Problems',
  drill: 'Drill',
  mock: 'Mock interview',
  insights: 'Insights',
  settings: 'Settings',
}

const THEME_ICON = { light: <Sun />, dark: <Moon />, system: <Monitor /> }
const THEME_LABEL = { light: 'Light theme', dark: 'Dark theme', system: 'Following the system theme' }

/** The frame around every screen: a top bar, the floating dock, and the overlays that can open anywhere. */
export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const outlet = useOutlet()
  const actions = useActions()
  const paletteOpen = useUi((u) => u.paletteOpen)
  const setPaletteOpen = useUi((u) => u.setPaletteOpen)

  // The first path segment names the screen; deeper changes (a topic on the map) do not re-run the transition.
  const screen = location.pathname.split('/')[1] ?? ''

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  // Fetch every screen once the first one has painted, so no later visit waits on the network.
  useEffect(() => {
    preloadAllWhenIdle()
  }, [])

  // The tab title follows what is on screen: the open problem, else the screen's name.
  const openSlug = new URLSearchParams(location.search).get('p')
  useEffect(() => {
    const problem = openSlug ? getProblem(openSlug) : undefined
    const name = problem?.title ?? SCREEN_TITLES[screen] ?? null
    document.title = name ? `${name} · Cairn` : 'Cairn'
  }, [screen, openSlug])

  // A mistyped or stale deep link says so and cleans the address, as an unknown route does.
  const rawSlug = openSlug
  const topicSegment = /^\/map\/([^/]+)/.exec(location.pathname)?.[1] ?? null
  useEffect(() => {
    if (rawSlug && !getProblem(rawSlug)) {
      toast({ id: 'bad-link', message: 'That problem is not on the route', detail: 'The link may be mistyped. Search for it instead.' })
      const params = new URLSearchParams(location.search)
      params.delete('p')
      params.delete('mode')
      const search = params.toString()
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
    }
    // Once the parameter is dropped there is nothing left to react to.
  }, [rawSlug, location.pathname, location.search, navigate])
  useEffect(() => {
    if (topicSegment && !isTopicId(topicSegment)) {
      toast({ id: 'bad-link', message: 'That topic is not on the map', detail: 'Showing the whole range instead.' })
    }
  }, [topicSegment])

  useHotkeys({ 'mod+k': () => setPaletteOpen(!paletteOpen) }, { global: true, inFields: true })
  useHotkeys(
    {
      '?': openShortcuts,
      // Undo is available with a sheet open too, but never steals ⌘Z from a text field.
      'mod+z': () => {
        if (actions.undo()) toast({ message: 'Undone', id: 'undo' })
      },
    },
    { global: true },
  )
  useHotkeys({
    'g t': () => navigate(ROUTES.today),
    'g m': () => navigate(ROUTES.map),
    'g p': () => navigate(ROUTES.problems),
    'g d': () => navigate(ROUTES.drill),
    'g k': () => navigate(ROUTES.mock),
    'g i': () => navigate(ROUTES.insights),
    'g s': () => navigate(ROUTES.settings),
    '/': () => navigate(ROUTES.problems, { state: { focusSearch: true } }),
  })

  return (
    <div className={s.shell}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>
      <TopBar />
      <MockClock />
      <main id="main" className={s.main} tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={screen} className={s.screen} variants={pageVariants} initial="initial" animate="enter" exit="exit">
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<ScreenFallback />}>{outlet}</Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <Dock />
      {OVERLAYS.map((Overlay, i) => (
        // Each overlay loads and fails on its own, so one cannot take the others down.
        <ErrorBoundary key={i} fallback={null}>
          <Suspense fallback={null}>
            <Overlay />
          </Suspense>
        </ErrorBoundary>
      ))}
    </div>
  )
}

function TopBar() {
  const [scrolled, setScrolled] = useState(false)
  const { choice } = useTheme()
  const data = useData()
  const { storageError, loadError } = useStorageProblems()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cx(s.topbar, scrolled && s.scrolled)}>
      <div className={s.topbarInner}>
        <Link to={ROUTES.today} className={s.brand} aria-label="Cairn, go to Today">
          <CairnMark size={22} />
          <span className={s.wordmark}>Cairn</span>
        </Link>

        {data.demo ? (
          <span className={s.demo}>
            <span className={cx('eyebrow', s.demoLabel)}>
              Demo<span className={s.demoWord}> data</span>
            </span>
            <button type="button" className={s.demoExit} onClick={() => void exitDemo()} aria-label="Exit the demo and restore your data">
              <span>
                Exit<span className={s.demoOnly}> demo</span>
              </span>
            </button>
          </span>
        ) : null}

        <div className={s.spacer} />

        {storageError || loadError ? (
          <Tip content={loadError ?? 'Your browser is not letting Cairn save. Export a backup from Settings.'}>
            <Link to={ROUTES.settings} className={s.warn}>
              {loadError ? 'Stored data unreadable' : 'Not saving'}
            </Link>
          </Tip>
        ) : null}

        <MockPill />
        <TimerPill />
        <StreakPill />

        <button type="button" className={s.search} onClick={openPalette} aria-label="Search and commands">
          <Search />
          <span className={s.searchLabel}>Jump to…</span>
          <Kbd keys="mod+k" className={s.searchKbd} />
        </button>

        <Tip content={THEME_LABEL[choice]}>
          <Button className={s.themeButton} variant="ghost" size="sm" iconOnly icon={THEME_ICON[choice]} aria-label={`${THEME_LABEL[choice]}. Switch theme`} onClick={() => cycleTheme()} />
        </Tip>
        <Tip content="Settings" kbd="g s">
          <Link to={ROUTES.settings} className={s.iconLink} aria-label="Settings">
            <Settings />
          </Link>
        </Tip>
      </div>
    </header>
  )
}

/** The running solve timer, always one click from its problem. */
function TimerPill() {
  const { timer, elapsedMs, running } = useTimer()
  const sheet = useProblemSheet()
  if (!timer) return null
  const problem = getProblem(timer.slug)
  if (!problem) return null
  return (
    <Tip content={running ? 'Timer running. Open the problem' : 'Timer paused. Open the problem'}>
      <button
        type="button"
        className={cx(s.pill, s.timer)}
        onClick={() => sheet.open(problem.slug)}
        aria-label={`${problem.title}, timer ${running ? 'running' : 'paused'} at ${formatClock(elapsedMs)}`}
      >
        <span className={cx(s.live, running && s.liveOn)} aria-hidden="true" />
        <span className={cx('truncate', s.timerTitle)}>{problem.title}</span>
        <span className="num">{formatClock(elapsedMs)}</span>
      </button>
    </Tip>
  )
}

/**
 * The mock's clock runs on its stored start time, so it has to stop on time wherever you are in
 * the app, not only while the Mock screen is open. Moves the mock on to rating, once.
 */
function MockClock() {
  const { activeMock } = useDerived()
  const actions = useActions()
  const running = activeMock?.status === 'running'
  const tick = useNow(1000, running)
  const ended = useRef<string | null>(null)
  const id = activeMock?.id
  const deadline = activeMock ? activeMock.startedAt + activeMock.config.minutes * 60_000 : 0
  useEffect(() => {
    if (!running || !id || ended.current === id || tick < deadline) return
    ended.current = id
    actions.endMock()
  }, [running, id, tick, deadline, actions])
  return null
}

/** A mock interview in progress follows you around the app. */
function MockPill() {
  const { activeMock } = useDerived()
  const location = useLocation()
  const running = activeMock?.status === 'running'
  const tick = useNow(1000, running)
  if (!activeMock || location.pathname.startsWith(ROUTES.mock)) return null
  const left = Math.max(0, activeMock.startedAt + activeMock.config.minutes * 60_000 - tick)
  return (
    <Link
      to={ROUTES.mock}
      className={cx(s.pill, s.timer, s.mockPill, running && s.mockRunning)}
      aria-label={running ? `Mock interview, ${formatClock(left)} left` : 'Mock interview ended. Rate it'}
    >
      <span className={cx(s.live, running && s.liveOn)} aria-hidden="true" />
      <Timer className={s.mockIcon} aria-hidden="true" />
      <span className={cx(s.timerTitle, s.mockLabel)}>{running ? 'Mock' : 'Rate mock'}</span>
      {running ? <span className="num">{formatClock(left)}</span> : null}
    </Link>
  )
}

function StreakPill() {
  const { streak } = useDerived()
  if (streak.current === 0) return null
  return (
    <Tip content={`${streak.current}-day streak${streak.activeToday ? '' : '. Log something today to keep it'} · best ${streak.best}`}>
      <Link to={ROUTES.insights} className={cx(s.pill, s.streak, !streak.activeToday && s.pending)} aria-label={`${streak.current}-day streak`}>
        <Flame />
        <span className="num">{streak.current}</span>
      </Link>
    </Tip>
  )
}

function Dock() {
  const location = useLocation()
  return (
    <nav className={s.dock} aria-label="Primary">
      <ul className={s.dockList}>
        {NAV.map((item) => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <li key={item.to}>
              <Tip content={item.label} kbd={item.keys}>
                <NavLink
                  to={item.to}
                  className={cx(s.dockItem, active && s.dockActive)}
                  aria-current={active ? 'page' : undefined}
                  end={item.to === '/'}
                  onPointerEnter={() => preloadRoute(item.to)}
                  onFocus={() => preloadRoute(item.to)}
                >
                  {active ? <motion.span layoutId="dock-active" className={s.dockThumb} transition={spring.snappy} /> : null}
                  <span className={s.dockIcon}>{NAV_ICONS[item.to]}</span>
                  <span className={s.dockLabel}>{item.label}</span>
                </NavLink>
              </Tip>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * What a screen shows for the moment its code is on the way: the sheet label's ruled line and the
 * shape of a headline, at the height of a real page so nothing jumps when it arrives.
 */
function ScreenFallback() {
  return (
    <div className={s.fallback} role="status">
      <span className="sr-only">Loading</span>
      <div className={cx('page', s.fallbackPage)} aria-hidden="true">
        <div className={s.fbMargin}>
          <span className={s.fbLabel} />
          <span className={s.fbScale} />
        </div>
        <span className={s.fbTitle} />
        <span className={cx(s.fbTitle, s.fbTitleShort)} />
        <span className={s.fbLede} />
      </div>
    </div>
  )
}
