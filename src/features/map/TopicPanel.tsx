import { motion, type PanInfo } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { ROADMAP_ORDER } from '../../data'
import type { TopicId } from '../../data/types'
import type { ProblemView, ReviewQueue, TopicView } from '../../domain/types'
import { reviewPriority } from '../../domain/queue'
import type { ISODate } from '../../state/schema'
import { useProblemSheet } from '../../app/nav'
import { Button, Chip, cx, fade, listContainer, listItem, Meter, ProblemRow, Ring, Segmented, spring, Tip, useListCursor } from '../../ui'
import { CAMP_STATE, campReason, CampGlyph } from './campState'
import FieldGuide from './FieldGuide'
import type { OpenedBy } from './types'
import s from './TopicPanel.module.css'

type Tab = 'problems' | 'guide'

interface TopicPanelProps {
  view: TopicView
  topics: Record<TopicId, TopicView>
  queue: ReviewQueue
  today: ISODate
  phone: boolean
  /** The keyboard opened this camp: focus moves into the panel, so j, k and Enter work at once. */
  openedBy: OpenedBy
  onSelect: (id: TopicId, by?: OpenedBy) => void
  onClose: () => void
  panelRef: Ref<HTMLElement>
}

/**
 * Which problem the footer button points at. A revision waiting in today's queue comes first, the
 * most urgent and weakest of them (the order the queue itself uses); then any other waiting one;
 * otherwise the next unsolved problem.
 */
function target(view: TopicView, queue: ReviewQueue, today: ISODate): { problem: ProblemView | null; revise: boolean } {
  const due = view.problems.filter((p) => p.status === 'due')
  if (due.length > 0) {
    const inQueue = new Set(queue.today.map((p) => p.problem.slug))
    const pool = due.some((p) => inQueue.has(p.problem.slug)) ? due.filter((p) => inQueue.has(p.problem.slug)) : due
    const ranked = [...pool].sort((a, b) => reviewPriority(b, today) - reviewPriority(a, today))
    return { problem: ranked[0], revise: true }
  }
  return { problem: view.problems.find((p) => !p.solved) ?? null, revise: false }
}

/** True when no control holds focus, so list keys (Enter in particular) cannot hijack a button. */
function keysFree(): boolean {
  const el = document.activeElement
  return !el || el === document.body || (el instanceof HTMLElement && (el.hasAttribute('data-slug') || el.hasAttribute('data-keys-free')))
}

function useKeysFree(): boolean {
  const [free, setFree] = useState(true)
  useEffect(() => {
    // focusout fires before the next element is focused, so read focus after the event settles.
    const update = () => queueMicrotask(() => setFree(keysFree()))
    update()
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', update)
    return () => {
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', update)
    }
  }, [])
  return free
}

/**
 * The camp's page: its place on the route, how it is going, its problems along a trail, and its
 * field guide. Floats beside the map (or rises from the bottom on a phone) and is not modal.
 * Opens with the problems in reach: a name, one line of figures, one sentence on why the camp is
 * where it is, and the tabs. The rest scrolls under the tabs.
 */
export default function TopicPanel({ view, topics, queue, today, phone, openedBy, onSelect, onClose, panelRef }: TopicPanelProps) {
  const { topic } = view
  const [tab, setTab] = useState<Tab>('problems')
  const [expanded, setExpanded] = useState(false)
  const asideRef = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sheet = useProblemSheet()
  const keysOn = useKeysFree()
  const firstMount = useRef(true)
  const goal = target(view, queue, today)
  const camp = ROADMAP_ORDER.indexOf(topic.id) + 1
  const state = CAMP_STATE[view.state]
  const reason = campReason(view, topics)
  const inQueue = new Set(queue.today.map((p) => p.problem.slug))

  const setNode = useCallback(
    (el: HTMLElement | null) => {
      asideRef.current = el
      if (typeof panelRef === 'function') panelRef(el)
      else if (panelRef) (panelRef as { current: HTMLElement | null }).current = el
    },
    [panelRef],
  )

  useEffect(() => {
    firstMount.current = false
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [topic.id, tab])

  // Opened from the keyboard: take focus, so the list keys work without a Tab to find it.
  useEffect(() => {
    if (openedBy === 'key') asideRef.current?.focus({ preventScroll: true })
  }, [topic.id, openedBy])

  const openProblem = (p: ProblemView) => sheet.open(p.problem.slug, p.status === 'due' ? { mode: 'revise' } : undefined)

  // A phone's sheet: swipe up for more of it, down for less, and down again to put it away.
  const onPanEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.y < -36 || info.velocity.y < -420) setExpanded(true)
    else if (info.offset.y > 36 || info.velocity.y > 420) {
      if (expanded) setExpanded(false)
      else onClose()
    }
  }

  const route = <Route view={view} topics={topics} onSelect={onSelect} open={phone} />

  return (
    <motion.aside
      ref={setNode}
      className={cx(s.panel, expanded && s.expanded)}
      aria-label={`${topic.name} camp`}
      tabIndex={-1}
      data-keys-free=""
      initial={phone ? { opacity: 0, y: 72 } : { opacity: 0, x: 44 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={phone ? { opacity: 0, y: 72 } : { opacity: 0, x: 36 }}
      transition={spring.soft}
    >
      <motion.header className={s.margin} onPanEnd={phone ? onPanEnd : undefined}>
        {phone ? (
          <button
            type="button"
            className={s.grabber}
            aria-label={expanded ? 'Show more of the map' : 'Show more of the camp'}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <p className={cx('eyebrow', s.marginLine)}>
          Camp <span className="num">{camp}</span> of <span className="num">{ROADMAP_ORDER.length}</span> · Level <span className="num">{topic.level}</span>
        </p>
        <Chip tone={state.tone} variant={state.variant} dot={view.state === 'active'}>
          {state.label}
        </Chip>
        <Tip content="Close" kbd="Escape" side="bottom">
          <button type="button" className={s.close} onClick={onClose} aria-label="Close the camp panel">
            <X />
          </button>
        </Tip>
      </motion.header>

      <div ref={bodyRef} className={s.body}>
        <motion.div key={topic.id} variants={fade} initial={firstMount.current ? false : 'initial'} animate="enter">
          <div className={s.intro}>
            <h2 className={cx('display display-2', s.name)}>{topic.name}</h2>
            {phone ? null : <p className={cx('subtle', s.tagline)}>{topic.tagline}</p>}

            <Facts view={view} inToday={view.problems.filter((p) => inQueue.has(p.problem.slug)).length} />

            {reason || view.weakness ? (
              <p className={s.note}>
                {reason}
                {view.weakness ? (
                  <>
                    {reason ? ' ' : null}
                    <span className={cx('eyebrow', s.holding)}>Holding it back</span> {view.weakness}.
                  </>
                ) : null}
              </p>
            ) : null}

            {phone ? null : route}
          </div>

          <div className={s.tabsBar}>
            <Segmented<Tab>
              block
              label="Camp sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'problems', label: `Problems · ${view.total}` },
                { value: 'guide', label: 'Field guide' },
              ]}
            />
          </div>

          <div className={s.content}>
            {tab === 'problems' ? (
              <ProblemList
                key={topic.id}
                view={view}
                inQueue={inQueue}
                stagger={firstMount.current}
                enabled={keysOn}
                initial={Math.max(0, goal.problem ? view.problems.indexOf(goal.problem) : 0)}
                container={bodyRef}
                onOpen={openProblem}
              />
            ) : (
              <FieldGuide
                topic={topic.id}
                before={
                  phone ? (
                    <>
                      <p className={cx('subtle', s.lede)}>{topic.tagline}</p>
                      {route}
                    </>
                  ) : undefined
                }
              />
            )}
          </div>
        </motion.div>
      </div>

      <footer className={s.footer}>
        {goal.problem ? (
          <Button variant="primary" size={phone ? 'md' : 'lg'} block onClick={() => openProblem(goal.problem!)}>
            <span className={s.footLabel}>
              {goal.revise ? 'Revise' : 'Start'}: {goal.problem.problem.title}
            </span>
          </Button>
        ) : (
          <p className={s.quiet}>
            All <span className="num">{view.total}</span> solved, <span className="num">{view.mastered}</span> mastered. Nothing waiting here.
          </p>
        )}
      </footer>
    </motion.aside>
  )
}

/** One line of figures: how much is solved, how strong the camp is, and where its revisions stand. */
function Facts({ view, inToday }: { view: TopicView; inToday: number }) {
  const done = view.state === 'complete'
  return (
    <div className={s.facts}>
      <div className={cx(s.fact, s.factSolved)}>
        <Ring value={view.progress} size={46} stroke={3.5} tone={done ? 'glow' : 'ember'} label={`${view.solved} of ${view.total} solved`}>
          <span className={cx('num', s.ringText)}>
            {view.solved}/{view.total}
          </span>
        </Ring>
      </div>
      <div className={cx(s.fact, s.factStrength)}>
        <span className="eyebrow">Strength</span>
        {view.strength == null ? (
          <span className={cx('place muted', s.uncharted)}>Uncharted</span>
        ) : (
          <>
            <span className={cx('stat', s.strength)}>{Math.round(view.strength)}</span>
            <Meter value={view.strength / 100} tone="ink" height={3} label={`Strength ${Math.round(view.strength)} of 100`} />
          </>
        )}
      </div>
      <div className={s.fact}>
        <span className="eyebrow">Revision</span>
        <p className={s.counts}>
          <span>
            <span className="num">{view.mastered}</span> mastered
          </span>
          <span>
            <span className="num">{view.due}</span> waiting
            {inToday > 0 ? (
              <>
                , <span className="num">{inToday}</span> today
              </>
            ) : null}
          </span>
        </p>
      </div>
    </div>
  )
}

interface RouteProps {
  view: TopicView
  topics: Record<TopicId, TopicView>
  onSelect: (id: TopicId, by?: OpenedBy) => void
  /** Show the camps either side at once, with no disclosure. */
  open?: boolean
}

/** Where the camp sits on the route: the camps before it and after it, each one tap away. */
function Route({ view, topics, onSelect, open: always }: RouteProps) {
  const { topic } = view
  const [shown, setShown] = useState(false)
  const bodyId = useId()
  const open = always || shown
  const summary = `${topic.deps.length === 0 ? 'base camp' : `after ${topic.deps.map((id) => topics[id].topic.short).join(', ')}`} · ${
    topic.unlocks.length === 0 ? 'the summit' : `leads to ${topic.unlocks.length}`
  }`
  return (
    <div className={s.route}>
      {always ? null : (
        <button type="button" className={s.routeHead} aria-expanded={open} aria-controls={bodyId} onClick={() => setShown((v) => !v)}>
          <span className="eyebrow">Route</span>
          <span className={cx('truncate', s.routeSummary)}>{summary}</span>
          <ChevronDown className={cx(s.chev, open && s.chevOpen)} aria-hidden="true" />
        </button>
      )}
      {open ? (
        <div id={bodyId} className={s.links}>
          <Neighbours label="Comes after" ids={topic.deps} empty="Base camp" topics={topics} onSelect={onSelect} />
          <Neighbours label="Leads to" ids={topic.unlocks} empty="The summit" topics={topics} onSelect={onSelect} />
        </div>
      ) : null}
    </div>
  )
}

function Neighbours({
  label,
  ids,
  empty,
  topics,
  onSelect,
}: {
  label: string
  ids: TopicId[]
  empty: string
  topics: Record<TopicId, TopicView>
  onSelect: (id: TopicId, by?: OpenedBy) => void
}): ReactNode {
  return (
    <div className={s.neighbours}>
      <span className="eyebrow">{label}</span>
      {ids.length === 0 ? (
        <span className={cx('place muted', s.emptyLink)}>{empty}</span>
      ) : (
        <ul className={s.linkList}>
          {ids.map((id) => (
            <li key={id}>
              <button type="button" className={s.linkBtn} onClick={(e) => onSelect(id, e.detail === 0 ? 'key' : 'pointer')}>
                <CampGlyph state={topics[id].state} size={16} />
                <span className="place">{topics[id].topic.short}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface ProblemListProps {
  view: TopicView
  inQueue: ReadonlySet<string>
  stagger: boolean
  enabled: boolean
  initial: number
  container: React.RefObject<HTMLElement | null>
  onOpen: (p: ProblemView) => void
}

/** The problems in order along a thin trail: solid where walked, dotted where still ahead. */
function ProblemList({ view, inQueue, stagger, enabled, initial, container, onOpen }: ProblemListProps) {
  const { problems } = view
  const cursor = useListCursor(problems, { onOpen: (p) => onOpen(p), enabled, initial, container })
  const next = problems.find((p) => !p.solved)
  return (
    <motion.ul
      className={s.trail}
      variants={listContainer}
      initial={stagger ? 'initial' : false}
      animate="enter"
      onFocusCapture={(event) => {
        const slug = (event.target as HTMLElement).closest('[data-slug]')?.getAttribute('data-slug')
        const at = problems.findIndex((p) => p.problem.slug === slug)
        if (at >= 0) cursor.setIndex(at)
      }}
    >
      {problems.map((p, i) => {
        const after = problems[i + 1]
        const seg = !after ? 'none' : p.solved && after.solved ? 'walked' : p.solved || after.solved ? 'open' : 'ahead'
        return (
          <motion.li key={p.problem.slug} className={cx(s.step, s[`seg-${seg}`])} variants={i < 12 ? listItem : undefined}>
            <ProblemRow
              view={p}
              showTopic={false}
              active={cursor.shown && cursor.index === i}
              onOpen={() => onOpen(p)}
              note={inQueue.has(p.problem.slug) ? "In today's queue" : undefined}
              trailing={p === next ? <Chip tone="ember" variant="soft">Next</Chip> : undefined}
            />
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
