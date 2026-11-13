import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { Activity, ArrowLeft, ArrowRight, Check, Download, ExternalLink, FlaskConical, Keyboard, ListChecks, LogOut, Monitor, Moon, MountainSnow, Pause, Play, RefreshCw, Repeat, Search, Settings, Sun, Sunrise, Timer, Undo2, Upload, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProblem, PROBLEMS, PROBLEMS_BY_TOPIC, TOPICS, TOPIC_BY_ID } from '../../data'
import type { Problem, Topic } from '../../data/types'
import { NAV, ROUTES, useProblemSheet } from '../../app/nav'
import { openShortcuts, useUi } from '../../app/ui'
import { buildSession } from '../../domain/session'
import type { Derived, ProblemView } from '../../domain/types'
import { useActions, useCanUndo, useData, useDerived, useSettings, useTimer, useToday } from '../../state/hooks'
import { setThemeChoice, useTheme } from '../../state/prefs'
import type { ThemeChoice } from '../../state/schema'
import { downloadExport } from '../../state/transfer'
import { Button, Cairn, Chip, cx, GradeMark, Kbd, LAYER, statusLabel, Terrain, toast, useHotkeyLayer } from '../../ui'
import { CAMP_STATE, CampGlyph } from '../map/campState'
import { highlightRanges, normalize, scoreItem, tokens, type Searchable } from './search'
import s from './CommandPalette.module.css'

// ---------------------------------------------------------------------------------------------
// Static indexes: the catalog never changes, so normalize it once.

const field = (text: string, weight = 1) => ({ text: normalize(text), weight })

const PROBLEM_INDEX: { problem: Problem; search: Searchable; bare: Searchable }[] = PROBLEMS.map((problem) => {
  const topic = TOPIC_BY_ID[problem.topic]
  const own = [field(problem.title), field(String(problem.number)), field(problem.slug, 0.8)]
  return {
    problem,
    search: { fields: [...own, field(topic.name, 0.5), field(topic.short, 0.5), field(topic.id, 0.5)] },
    // While a mock is running its problems are found by title and number only: the topic is the hint.
    bare: { fields: own },
  }
})

const TOPIC_INDEX: { topic: Topic; search: Searchable }[] = TOPICS.map((topic) => ({
  topic,
  search: { fields: [field(topic.name), field(topic.short), field(topic.id, 0.8), field(topic.tagline, 0.3), field('topic camp', 0.2)] },
}))

// ---------------------------------------------------------------------------------------------
// Entries

type Group = 'next' | 'problem' | 'topic' | 'go' | 'action'

interface Entry {
  id: string
  group: Group
  search: Searchable
  icon: ReactNode
  title: string
  /** The title is a name on the map: set it in the italic serif. */
  place?: boolean
  meta?: ReactNode
  /** The meta is a short fixed label (a number and a topic): it keeps its width and the title gives way. */
  fixedMeta?: boolean
  trailing?: ReactNode
  keys?: string
  run: () => void
}

const GROUP_LABEL: Record<Group, string> = { next: 'Next up', problem: 'Problems', topic: 'Topics', go: 'Go to', action: 'Actions' }

const NAV_ICON: Record<string, ReactNode> = {
  [ROUTES.today]: <Sunrise />,
  [ROUTES.map]: <MountainSnow />,
  [ROUTES.problems]: <ListChecks />,
  [ROUTES.drill]: <Zap />,
  [ROUTES.mock]: <Timer />,
  [ROUTES.insights]: <Activity />,
}

const NAV_WORDS: Record<string, string> = {
  [ROUTES.today]: 'home route session plan revise revision',
  [ROUTES.map]: 'topics roadmap massif camps graph',
  [ROUTES.problems]: 'search list all find filter problem',
  [ROUTES.drill]: 'pattern patterns flashcards recognition practice',
  [ROUTES.mock]: 'interview timed simulate practice',
  [ROUTES.insights]: 'stats charts progress analytics weak mistakes',
}

const THEMES: { choice: ThemeChoice; label: string; icon: ReactNode; words: string }[] = [
  { choice: 'light', label: 'Light', icon: <Sun />, words: 'day bright paper' },
  { choice: 'dark', label: 'Dark', icon: <Moon />, words: 'night dim massif' },
  { choice: 'system', label: 'System', icon: <Monitor />, words: 'auto device os' },
]

const searchable = (title: string, words = ''): Searchable => ({ fields: [field(title), field(words, 0.6)] })

interface NextUp {
  title: string
  why: string
  chip: string
  problem: Problem | null
  view: ProblemView | null
  run: (open: (slug: string, mode?: 'revise') => void, go: (to: string) => void) => void
}

/** The first thing on today's route, falling back to the review queue and then to new ground. */
function findNextUp(derived: Derived): NextUp | null {
  const firstRun = derived.counts.solved === 0 && derived.activity.activeDays === 0 && derived.drill.total === 0
  const item = derived.session?.items.find((it) => !it.done && !(it.kind === 'drill' && firstRun))
  if (item) {
    const minutes = `about ${item.minutes} min`
    if (item.kind === 'drill' || !item.problem) {
      return { title: 'Pattern drill', why: `${item.reason} · ${minutes}`, chip: 'Drill', problem: null, view: null, run: (_open, go) => go(`${ROUTES.drill}?start=10`) }
    }
    const view = derived.problems[item.problem.slug] ?? null
    const revise = item.kind === 'review'
    return { title: item.problem.title, why: `${item.reason} · ${minutes}`, chip: revise ? 'Revise' : 'New', problem: item.problem, view, run: (open) => open(item.problem!.slug, revise ? 'revise' : undefined) }
  }
  const due = derived.queue.today[0]
  if (due) {
    return { title: due.problem.title, why: statusLabel(due)?.text ?? 'Revision waiting', chip: 'Revise', problem: due.problem, view: due, run: (open) => open(due.problem.slug, 'revise') }
  }
  const rec = derived.recommendations[0]
  if (rec) {
    return { title: rec.problem.title, why: rec.note, chip: 'New', problem: rec.problem, view: derived.problems[rec.problem.slug] ?? null, run: (open) => open(rec.problem.slug) }
  }
  return null
}

function Highlight({ text, query }: { text: string; query: string[] }) {
  const ranges = query.length ? highlightRanges(text, query) : []
  if (ranges.length === 0) return <>{text}</>
  const parts: ReactNode[] = []
  let at = 0
  ranges.forEach(([from, to], i) => {
    if (from > at) parts.push(text.slice(at, from))
    parts.push(
      <mark key={i} className={s.mark}>
        {text.slice(from, to)}
      </mark>,
    )
    at = to
  })
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}

// ---------------------------------------------------------------------------------------------

export default function CommandPalette() {
  const open = useUi((u) => u.paletteOpen)
  const setOpen = useUi((u) => u.setPaletteOpen)
  const keepFocus = useRef(true)
  useHotkeyLayer(LAYER.palette, open)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={s.scrim} />
        <Dialog.Content
          className={s.content}
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            keepFocus.current = true
          }}
          onCloseAutoFocus={(event) => {
            // A command that moved us somewhere else owns focus now; do not pull it back.
            if (!keepFocus.current) event.preventDefault()
          }}
        >
          <Dialog.Title className="sr-only">Search and commands</Dialog.Title>
          <Palette onClose={() => setOpen(false)} onMoved={() => (keepFocus.current = false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const LIMITS = { short: { problem: 6, topic: 4 }, full: { problem: 30, topic: 8 } }

function Palette({ onClose, onMoved }: { onClose: () => void; onMoved: () => void }) {
  const derived = useDerived()
  const data = useData()
  const settings = useSettings()
  const today = useToday()
  const actions = useActions()
  const canUndo = useCanUndo()
  const { timer, running } = useTimer()
  const { choice } = useTheme()
  const navigate = useNavigate()
  const sheet = useProblemSheet()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')

  const words = useMemo(() => tokens(query), [query])

  // A running mock keeps its problems' topics to itself, in the results and in what matches.
  const mock = derived.activeMock
  const hidden = useMemo(() => new Set(mock?.status === 'running' ? mock.slugs : []), [mock])

  const entries = useMemo(() => {
    const finish = (fn: () => void, moves = false) => () => {
      if (moves) onMoved()
      onClose()
      fn()
    }
    const go = (to: string) => navigate(to)
    const openProblem = (slug: string, mode?: 'revise') => sheet.open(slug, mode ? { mode } : undefined)

    const next = findNextUp(derived)
    const timerProblem = timer ? PROBLEMS.find((p) => p.slug === timer.slug) : undefined
    const themeNow = choice

    const list: Entry[] = []

    if (next) {
      list.push({
        id: 'next:start',
        group: 'next',
        search: searchable(next.title),
        icon: next.view?.solved ? <Cairn step={next.view.srs?.step ?? 0} tone="ember" size={20} /> : next.problem ? <GradeMark difficulty={next.problem.difficulty} /> : <Zap />,
        title: next.title,
        place: !!next.problem,
        meta: next.problem && hidden.has(next.problem.slug) ? 'In your running mock' : next.why,
        trailing: (
          <Chip tone="ember" variant="soft">
            {next.chip}
          </Chip>
        ),
        run: finish(() => next.run(openProblem, go), true),
      })
    }

    for (const item of [...NAV.map((n) => ({ to: n.to, label: n.label, keys: n.keys })), { to: ROUTES.settings, label: 'Settings', keys: 'g s' }]) {
      list.push({
        id: `go:${item.to}`,
        group: 'go',
        search: searchable(item.label, NAV_WORDS[item.to] ?? 'preferences options plan targets import export backup reset erase clear'),
        icon: NAV_ICON[item.to] ?? <Settings />,
        title: item.label,
        keys: item.keys,
        run: finish(() => go(item.to), true),
      })
    }

    if (next) {
      list.push({
        id: 'action:start',
        group: 'action',
        search: searchable("Start the next item on today's route", 'next up route revise revision solve begin go today'),
        icon: <Play />,
        title: "Start the next item on today's route",
        meta: next.title,
        run: finish(() => next.run(openProblem, go), true),
      })
    }
    // With a problem open, the first things to ask for are about that problem.
    const current = sheet.slug ? getProblem(sheet.slug) : undefined
    if (current) {
      const solved = !!derived.problems[current.slug]?.solved
      list.push({
        id: 'action:problem-start',
        group: 'action',
        search: searchable(solved ? 'Start a revision' : 'Start solving', 'log an attempt record rating rate solve revise recall practice this problem'),
        icon: solved ? <Repeat /> : <Play />,
        title: solved ? 'Start a revision' : 'Start solving',
        meta: current.title,
        run: finish(() => openProblem(current.slug, solved ? 'revise' : undefined), true),
      })
      list.push({
        id: 'action:problem-leetcode',
        group: 'action',
        search: searchable('Open on LeetCode', 'leetcode website statement submit external link this problem'),
        icon: <ExternalLink />,
        title: 'Open on LeetCode',
        meta: current.title,
        run: finish(() => void window.open(current.url, '_blank', 'noopener,noreferrer')),
      })
      if (!hidden.has(current.slug)) {
        const siblings = PROBLEMS_BY_TOPIC[current.topic]
        const at = siblings.findIndex((p) => p.slug === current.slug)
        const next = siblings[at + 1]
        const previous = siblings[at - 1]
        if (next) {
          list.push({
            id: 'action:problem-next',
            group: 'action',
            search: searchable('Open the next problem in this topic', `following forward ${next.title}`),
            icon: <ArrowRight />,
            title: 'Open the next problem in this topic',
            meta: next.title,
            run: finish(() => openProblem(next.slug), true),
          })
        }
        if (previous) {
          list.push({
            id: 'action:problem-previous',
            group: 'action',
            search: searchable('Open the previous problem in this topic', `back earlier ${previous.title}`),
            icon: <ArrowLeft />,
            title: 'Open the previous problem in this topic',
            meta: previous.title,
            run: finish(() => openProblem(previous.slug), true),
          })
        }
      }
    }
    list.push(
      {
        id: 'action:drill',
        group: 'action',
        search: searchable('Start a pattern drill', 'ten cards practice patterns flashcards recognition'),
        icon: <Zap />,
        title: 'Start a pattern drill',
        meta: '10 cards',
        run: finish(() => go(`${ROUTES.drill}?start=10`), true),
      },
      {
        id: 'action:mock',
        group: 'action',
        search: searchable('Start a mock interview', 'timed simulate practice'),
        icon: <Timer />,
        title: 'Start a mock interview',
        run: finish(() => go(ROUTES.mock), true),
      },
    )
    if (timer && timerProblem) {
      list.push({
        id: 'action:timer',
        group: 'action',
        search: searchable(running ? 'Pause the solve timer' : 'Start the solve timer', 'stopwatch clock resume time'),
        icon: running ? <Pause /> : <Play />,
        title: running ? 'Pause the solve timer' : 'Start the solve timer',
        meta: timerProblem.title,
        run: finish(() => (running ? actions.pauseTimer() : actions.startTimer(timer.slug))),
      })
    }
    for (const theme of THEMES) {
      list.push({
        id: `action:theme-${theme.choice}`,
        group: 'action',
        search: searchable(`Switch theme: ${theme.label}`, `${theme.words} theme appearance color mode`),
        icon: theme.icon,
        title: `Switch theme: ${theme.label}`,
        trailing: themeNow === theme.choice ? <Check className={s.current} aria-label="Current theme" /> : undefined,
        run: finish(() => setThemeChoice(theme.choice)),
      })
    }
    list.push({
      id: 'action:route',
      group: 'action',
      search: searchable("Rebuild today's route", 'plan session redraw refresh again new route stops'),
      icon: <RefreshCw />,
      title: "Rebuild today's route",
      meta: `${settings.sessionMinutes} min`,
      run: finish(() => {
        const firstRun = derived.counts.solved === 0 && derived.activity.activeDays === 0 && derived.drill.total === 0
        const built = buildSession({
          minutes: settings.sessionMinutes,
          queue: derived.queue,
          recommendations: derived.recommendations,
          problems: derived.problems,
          targets: settings.targets,
        })
        const items = firstRun ? built.filter((item) => item.kind !== 'drill') : built
        if (items.length === 0) {
          toast({ message: 'Nothing to plan yet', detail: 'Solve a problem and the route has something to build from.' })
          return
        }
        actions.setSession({ date: today, budget: settings.sessionMinutes, items, createdAt: Date.now() })
        toast({ message: "Today's route rebuilt", detail: `${items.length} ${items.length === 1 ? 'stop' : 'stops'} · about ${items.reduce((n, item) => n + item.minutes, 0)} min`, id: 'route', tone: 'success' })
      }),
    })
    list.push({
      id: 'action:export',
      group: 'action',
      search: searchable('Export a backup', 'download save data json file'),
      icon: <Download />,
      title: 'Export a backup',
      meta: 'JSON file',
      run: finish(() => {
        downloadExport(data, today, Date.now())
        toast({ message: 'Backup saved', detail: 'cairn-backup is in your downloads.', tone: 'success' })
      }),
    })
    list.push({
      id: 'action:import',
      group: 'action',
      search: searchable('Import a backup', 'restore upload load json file data bring back'),
      icon: <Upload />,
      title: 'Import a backup',
      meta: 'In Settings',
      run: finish(() => go(ROUTES.settings), true),
    })
    list.push(
      data.demo
        ? {
            id: 'action:demo',
            group: 'action',
            search: searchable('Exit demo', 'demo data leave clear sample restore mine'),
            icon: <LogOut />,
            title: 'Exit demo',
            meta: 'Back to your own data',
            run: finish(() => void actions.clearDemo()),
          }
        : {
            id: 'action:demo',
            group: 'action',
            search: searchable('Load demo data', 'demo sample example try history fill'),
            icon: <FlaskConical />,
            title: 'Load demo data',
            meta: 'Ten weeks of sample history',
            run: finish(() => void actions.loadDemo()),
          },
    )
    if (canUndo) {
      list.push({
        id: 'action:undo',
        group: 'action',
        search: searchable('Undo the last logged change', 'revert back mistake'),
        icon: <Undo2 />,
        title: 'Undo the last logged change',
        keys: 'mod+z',
        run: finish(() => {
          if (actions.undo()) toast({ message: 'Undone', id: 'undo' })
        }),
      })
    }
    list.push({
      id: 'action:shortcuts',
      group: 'action',
      search: searchable('Keyboard shortcuts', 'keys hotkeys help reference legend cheatsheet'),
      icon: <Keyboard />,
      title: 'Keyboard shortcuts',
      keys: '?',
      run: finish(openShortcuts),
    })
    // Problems and topics are filled in per query below.
    return list
  }, [actions, canUndo, choice, data, derived, hidden, navigate, onClose, onMoved, running, settings, sheet, timer, today])

  const sections = useMemo(() => {
    const byGroup = (group: Group) => entries.filter((e) => e.group === group)
    const order: Group[] = ['next', 'go', 'action']

    if (words.length === 0) {
      // The route's first stop is already under "Next up".
      const actionList = byGroup('action').filter((e) => e.id !== 'action:start')
      return order.map((group) => ({ group, items: group === 'action' ? actionList : byGroup(group) })).filter((sec) => sec.items.length > 0)
    }

    const limits = words.join('').length <= 1 ? LIMITS.short : LIMITS.full
    const score = (items: Entry[]) =>
      items
        .map((entry) => ({ entry, score: scoreItem(entry.search, words) }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)

    const problems = PROBLEM_INDEX.map((row) => ({ row, score: scoreItem(hidden.has(row.problem.slug) ? row.bare : row.search, words) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score || a.row.problem.number - b.row.problem.number)
      .slice(0, limits.problem)
      .map(({ row, score: sc }) => ({ entry: problemEntry(row.problem, derived.problems[row.problem.slug], sheet.open, onClose, onMoved, hidden.has(row.problem.slug)), score: sc }))

    const topics = TOPIC_INDEX.map((row) => ({ row, score: scoreItem(row.search, words) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limits.topic)
      .map(({ row, score: sc }) => ({ entry: topicEntry(row.topic, derived, navigate, onClose, onMoved), score: sc }))

    const goTo = score(byGroup('go'))
    const acts = score(byGroup('action'))

    const found: { group: Group; hits: { entry: Entry; score: number }[] }[] = [
      { group: 'problem', hits: problems },
      { group: 'topic', hits: topics },
      { group: 'go', hits: goTo },
      { group: 'action', hits: acts },
    ]
    return found
      .filter((g) => g.hits.length > 0)
      // A topic that matches as well as a problem leads: it is the broader answer.
      .map((g, i) => ({ ...g, top: g.hits[0].score + (g.group === 'topic' ? 8 : 0) - i * 0.01 }))
      .sort((a, b) => b.top - a.top)
      .map((g) => ({ group: g.group, items: g.hits.map((h) => h.entry) }))
  }, [entries, words, derived, hidden, sheet.open, navigate, onClose, onMoved])

  // A new query starts at the top of the list with its first hit selected. cmdk scrolls whatever it
  // selects into view, and on a short phone list that nudges the first heading under the input row,
  // so the scroll is put back once cmdk is done.
  const list = useRef<HTMLDivElement>(null)
  const firstId = sections[0]?.items[0]?.id ?? ''
  useEffect(() => {
    setSelected(firstId)
    const top = () => void (list.current && (list.current.scrollTop = 0))
    top()
    const frame = requestAnimationFrame(() => {
      top()
      requestAnimationFrame(top)
    })
    return () => cancelAnimationFrame(frame)
  }, [query, firstId])

  const total = sections.reduce((n, sec) => n + sec.items.length, 0)

  return (
    <Command
      className={s.root}
      label="Search problems, topics and commands"
      shouldFilter={false}
      loop
      // cmdk's default vim keys take Ctrl+K, J, N and P for themselves; Ctrl+K has to toggle the palette.
      vimBindings={false}
      value={selected}
      onValueChange={setSelected}
    >
      <div className={s.inputRow}>
        <Search className={s.searchIcon} aria-hidden="true" />
        <Command.Input
          className={s.input}
          value={query}
          onValueChange={setQuery}
          placeholder="Search or jump to…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          autoFocus
        />
        <Kbd keys="Escape" className={s.escKey} />
        <Dialog.Close asChild>
          <Button variant="ghost" size="sm" iconOnly icon={<X />} aria-label="Close" className={s.closeBtn} />
        </Dialog.Close>
      </div>

      <Command.List ref={list} className={s.list} label="Results">
        {total === 0 ? (
          <div className={s.none} role="status">
            <div className={s.noneArt}>
              <Terrain seed={7} width={560} height={260} levels={9} scale={120} fade="edges" />
            </div>
            <span className="eyebrow">No match</span>
            <p className={cx('title title-sm', s.noneTitle)}>
              Nothing on the map called <em>{query.trim()}</em>.
            </p>
            <p className={s.noneBody}>Try part of a title, a number like #153, or a topic such as two pointers.</p>
            <Button size="sm" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </div>
        ) : (
          sections.map((sec) => (
            <Command.Group
              key={sec.group}
              className={s.group}
              heading={
                <span className={s.heading}>
                  <span className="eyebrow">{GROUP_LABEL[sec.group]}</span>
                  {sec.group === 'problem' || sec.group === 'topic' ? <span className={cx('eyebrow num', s.headingCount)}>{sec.items.length}</span> : null}
                </span>
              }
            >
              {sec.items.map((entry) => (
                <Command.Item key={entry.id} value={entry.id} className={s.item} onSelect={entry.run}>
                  <span className={s.icon}>{entry.icon}</span>
                  <span className={cx(s.title, entry.place && 'place')}>
                    <span className={s.clamp}>
                      <Highlight text={entry.title} query={words} />
                    </span>
                  </span>
                  {entry.meta ? <span className={cx(s.meta, entry.fixedMeta && s.metaFixed)}>{entry.meta}</span> : <span className={s.fill} />}
                  {entry.trailing ? <span className={s.trailing}>{entry.trailing}</span> : null}
                  {entry.keys ? <Kbd keys={entry.keys} className={s.keys} /> : null}
                </Command.Item>
              ))}
            </Command.Group>
          ))
        )}
      </Command.List>

      <footer className={s.footer}>
        <span className={s.hints}>
          <span className={s.hint}>
            <Kbd keys="ArrowUp" />
            <Kbd keys="ArrowDown" /> to move
          </span>
          <span className={s.dot} aria-hidden="true">
            ·
          </span>
          <span className={s.hint}>
            <Kbd keys="Enter" /> to open
          </span>
          <span className={s.dot} aria-hidden="true">
            ·
          </span>
          <span className={s.hint}>
            <Kbd keys="Escape" /> to close
          </span>
        </span>
        <span className={cx('eyebrow', s.count)}>
          {words.length ? (
            <>
              <span className="num">{total}</span> {total === 1 ? 'match' : 'matches'}
            </>
          ) : (
            <>
              <span className="num">{PROBLEMS.length}</span> waypoints · <span className="num">{TOPICS.length}</span> camps
            </>
          )}
        </span>
      </footer>
    </Command>
  )
}

function problemEntry(problem: Problem, view: ProblemView | undefined, open: (slug: string) => void, close: () => void, moved: () => void, hideTopic: boolean): Entry {
  const status = view ? statusLabel(view) : null
  return {
    id: `problem:${problem.slug}`,
    group: 'problem',
    search: { fields: [] },
    icon: <GradeMark difficulty={problem.difficulty} />,
    title: problem.title,
    fixedMeta: true,
    meta: (
      <>
        <span className="num">#{problem.number}</span>
        {hideTopic ? null : <span className={s.metaTopic}> · {TOPIC_BY_ID[problem.topic].short}</span>}
      </>
    ),
    trailing: status ? (
      <Chip tone={status.tone} variant={status.variant}>
        {status.text}
      </Chip>
    ) : undefined,
    run: () => {
      moved()
      close()
      open(problem.slug)
    },
  }
}

function topicEntry(topic: Topic, derived: Derived, navigate: (to: string) => void, close: () => void, moved: () => void): Entry {
  const view = derived.topics[topic.id]
  return {
    id: `topic:${topic.id}`,
    group: 'topic',
    search: { fields: [] },
    icon: <CampGlyph state={view.state} size={18} />,
    title: topic.name,
    place: true,
    trailing: (
      <span className={cx('num', s.progress)} aria-label={`${view.solved} of ${view.total} solved, ${CAMP_STATE[view.state].label.toLowerCase()}`}>
        {view.solved} / {view.total}
      </span>
    ),
    run: () => {
      moved()
      close()
      navigate(ROUTES.topic(topic.id))
    },
  }
}
