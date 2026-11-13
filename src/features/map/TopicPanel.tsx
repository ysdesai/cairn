import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, useState, type Ref } from 'react'
import { ROADMAP_ORDER } from '../../data'
import type { TopicId } from '../../data/types'
import type { ProblemView, TopicView } from '../../domain/types'
import { useProblemSheet } from '../../app/nav'
import { Button, Chip, cx, fade, listContainer, listItem, Meter, ProblemRow, Ring, Segmented, spring, Tip, useListCursor } from '../../ui'
import { CAMP_STATE, CampGlyph } from './campState'
import FieldGuide from './FieldGuide'
import s from './TopicPanel.module.css'

type Tab = 'problems' | 'guide'

interface TopicPanelProps {
  view: TopicView
  topics: Record<TopicId, TopicView>
  phone: boolean
  onSelect: (id: TopicId) => void
  onClose: () => void
  panelRef: Ref<HTMLElement>
}

/** Which problem the footer button points at: the most waiting revision, else the next unsolved one. */
function target(view: TopicView): { problem: ProblemView | null; revise: boolean } {
  const due = view.problems.filter((p) => p.status === 'due').sort((a, b) => (a.dueIn ?? 0) - (b.dueIn ?? 0))
  if (due[0]) return { problem: due[0], revise: true }
  const next = view.problems.find((p) => !p.solved) ?? null
  return { problem: next, revise: false }
}

/** True when no control holds focus, so list keys (Enter in particular) cannot hijack a button. */
function keysFree(): boolean {
  const el = document.activeElement
  return !el || el === document.body || (el instanceof HTMLElement && el.hasAttribute('data-slug'))
}

function useKeysFree(): boolean {
  const [free, setFree] = useState(true)
  useEffect(() => {
    // focusout fires before the next element is focused, so read focus after the event settles.
    const update = () => queueMicrotask(() => setFree(keysFree()))
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
 */
export default function TopicPanel({ view, topics, phone, onSelect, onClose, panelRef }: TopicPanelProps) {
  const { topic } = view
  const [tab, setTab] = useState<Tab>('problems')
  const bodyRef = useRef<HTMLDivElement>(null)
  const sheet = useProblemSheet()
  const keysOn = useKeysFree()
  const firstMount = useRef(true)
  const goal = target(view)
  const camp = ROADMAP_ORDER.indexOf(topic.id) + 1
  const state = CAMP_STATE[view.state]

  useEffect(() => {
    firstMount.current = false
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [topic.id, tab])

  const openProblem = (p: ProblemView) => sheet.open(p.problem.slug, p.status === 'due' ? { mode: 'revise' } : undefined)

  return (
    <motion.aside
      ref={panelRef}
      className={s.panel}
      aria-label={`${topic.name} camp`}
      initial={phone ? { opacity: 0, y: 72 } : { opacity: 0, x: 44 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={phone ? { opacity: 0, y: 72 } : { opacity: 0, x: 36 }}
      transition={spring.soft}
    >
      <header className={s.margin}>
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
      </header>

      <div ref={bodyRef} className={s.body}>
        <motion.div key={topic.id} variants={fade} initial={firstMount.current ? false : 'initial'} animate="enter">
          <div className={s.intro}>
            <h2 className={cx('display display-2', s.name)}>{topic.name}</h2>
            <p className={cx('subtle', s.tagline)}>{topic.tagline}</p>

            <Facts view={view} />

            <div className={s.links}>
              <Neighbours label="Comes after" ids={topic.deps} empty="Base camp" topics={topics} onSelect={onSelect} />
              <Neighbours label="Leads to" ids={topic.unlocks} empty="The summit" topics={topics} onSelect={onSelect} />
            </div>
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
                stagger={firstMount.current}
                enabled={keysOn}
                initial={Math.max(0, goal.problem ? view.problems.indexOf(goal.problem) : 0)}
                container={bodyRef}
                onOpen={openProblem}
              />
            ) : (
              <FieldGuide topic={topic.id} />
            )}
          </div>
        </motion.div>
      </div>

      <footer className={s.footer}>
        {goal.problem ? (
          <Button variant="primary" size="lg" block onClick={() => openProblem(goal.problem!)}>
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

function Facts({ view }: { view: TopicView }) {
  const done = view.state === 'complete'
  return (
    <div className={s.facts}>
      <div className={s.fact}>
        <span className="eyebrow">Solved</span>
        <Ring value={view.progress} size={56} stroke={3.5} tone={done ? 'glow' : 'ember'} label={`${view.solved} of ${view.total} solved`}>
          <span className={cx('num', s.ringText)}>
            {view.solved}/{view.total}
          </span>
        </Ring>
      </div>
      <div className={cx(s.fact, s.factStrength)}>
        <span className="eyebrow">Strength</span>
        {view.strength == null ? (
          <>
            <span className={cx('place muted', s.uncharted)}>Uncharted</span>
            <Meter value={null} label="Strength not yet charted" />
          </>
        ) : (
          <>
            <span className={cx('stat', s.strength)}>{Math.round(view.strength)}</span>
            <Meter value={view.strength / 100} tone="ink" label={`Strength ${Math.round(view.strength)} of 100`} />
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
          </span>
        </p>
      </div>
      {view.weakness ? (
        <p className={s.weakness}>
          <span className="eyebrow">Holding it back</span> {view.weakness}.
        </p>
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
  onSelect: (id: TopicId) => void
}) {
  return (
    <div className={s.neighbours}>
      <span className="eyebrow">{label}</span>
      {ids.length === 0 ? (
        <span className={cx('place muted', s.emptyLink)}>{empty}</span>
      ) : (
        <ul className={s.linkList}>
          {ids.map((id) => (
            <li key={id}>
              <button type="button" className={s.linkBtn} onClick={() => onSelect(id)}>
                <CampGlyph state={topics[id].state} size={14} />
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
  stagger: boolean
  enabled: boolean
  initial: number
  container: React.RefObject<HTMLElement | null>
  onOpen: (p: ProblemView) => void
}

/** The problems in order along a thin trail: solid where walked, dotted where still ahead. */
function ProblemList({ view, stagger, enabled, initial, container, onOpen }: ProblemListProps) {
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
              trailing={p === next ? <Chip tone="ember" variant="soft">Next</Chip> : undefined}
            />
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
