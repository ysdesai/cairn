import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { PATTERN_BY_ID, ROADMAP_ORDER, TOPIC_BY_ID } from '../../data'
import type { TopicId } from '../../data/types'
import { diffDays } from '../../domain/dates'
import type { Derived, ProblemView } from '../../domain/types'
import { RATING_META } from '../../state/schema'
import { Chip, Meter, ProblemRow, cx, listContainer, listItem, statusLabel, type ListCursor } from '../../ui'
import { ROUTES } from '../../app/nav'
import { CampRail, campAnchor, type RailCamp } from './CampRail'
import { SORT_OPTIONS, campNumber, normalize, wordPattern, type Match, type Snippet, type SortKey } from './filters'
import s from './Results.module.css'

/** Only the first screenful arrives with a stagger. */
const STAGGER_ROWS = 12

interface ResultsProps {
  matches: Match[]
  sort: SortKey
  tokens: string[]
  filtered: boolean
  cursor: ListCursor
  topics: Derived['topics']
  today: string
  onOpen: (slug: string) => void
}

/** "today", "yesterday", "12d ago": compact enough for a mono column. */
function ago(iso: string, today: string): string {
  const n = -diffDays(today, iso)
  if (n <= 0) return 'today'
  return n === 1 ? 'yesterday' : `${n}d ago`
}

const PHONE = '(max-width: 640px)'
const subscribePhone = (notify: () => void) => {
  const query = window.matchMedia(PHONE)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const isPhone = () => window.matchMedia(PHONE).matches

/**
 * The rows: grouped by camp in roadmap order beside an index of the camps, or one flat list in any other
 * sort. Matches are ordered so that exact number matches come first; they are set apart under their own rule.
 */
export function Results({ matches, sort, tokens, filtered, cursor, topics, today, onOpen }: ResultsProps) {
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false)

  // Rows that appear later (after a filter change) should simply be there, not animate in again.
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 1000)
    return () => window.clearTimeout(timer)
  }, [])

  // Exact number matches lead the list (the screen orders them first). With nothing else to set them apart from, they stay put.
  const pinCount = useMemo(() => {
    const exact = matches.filter((m) => m.exact).length
    return exact < matches.length ? exact : 0
  }, [matches])

  const groups = useMemo(() => {
    if (sort !== 'roadmap') return null
    const byTopic = new Map<TopicId, { match: Match; index: number }[]>()
    matches.forEach((match, index) => {
      if (index < pinCount) return
      const list = byTopic.get(match.view.problem.topic) ?? []
      list.push({ match, index })
      byTopic.set(match.view.problem.topic, list)
    })
    return ROADMAP_ORDER.filter((id) => byTopic.has(id)).map((id) => ({ id, rows: byTopic.get(id)! }))
  }, [matches, sort, pinCount])

  const camps = useMemo<RailCamp[]>(
    () =>
      (groups ?? []).map(({ id, rows }) => ({
        id,
        number: campNumber(id),
        short: TOPIC_BY_ID[id].short,
        name: TOPIC_BY_ID[id].name,
        solved: topics[id].solved,
        total: topics[id].total,
        shown: rows.length,
      })),
    [groups, topics],
  )

  const renderRow = (match: Match, index: number, showTopic: boolean) => {
    const { view, snippet } = match
    const pattern = view.solved ? PATTERN_BY_ID[view.problem.pattern]?.name : undefined
    // Wide screens have the last-result column; a phone gets the date on a line of its own.
    const when = phone && sort === 'attempted' && view.srs ? ago(view.srs.lastOn, today) : undefined
    const content = (
      <ProblemRow
        view={view}
        showTopic={showTopic}
        note={pattern ? <span className={s.pattern}>{pattern}</span> : undefined}
        detail={
          when || snippet ? (
            <>
              {when ? <span className={s.when}>Last attempt {when}</span> : null}
              {snippet ? <SnippetLine snippet={snippet} tokens={tokens} /> : null}
            </>
          ) : undefined
        }
        trailing={<Trailing view={view} today={today} />}
        active={cursor.shown && cursor.index === index}
        onOpen={onOpen}
      />
    )
    return index < STAGGER_ROWS ? (
      <motion.li key={view.problem.slug} className={s.item} variants={listItem}>
        {content}
      </motion.li>
    ) : (
      <li key={view.problem.slug} className={s.item}>
        {content}
      </li>
    )
  }

  const pinned = pinCount > 0 ? matches.slice(0, pinCount) : []
  const rest = matches.slice(pinCount)

  return (
    <div className={s.layout} data-rail={groups && groups.length > 1 ? true : undefined}>
      {groups && groups.length > 1 ? <CampRail camps={camps} filtered={filtered} /> : null}
      <motion.div variants={listContainer} initial={intro ? 'initial' : false} animate="enter" className={s.results}>
        {pinned.length > 0 ? (
          <section className={s.group} aria-label="Exact number">
            <div className={s.flatHead}>
              <span className="eyebrow">{pinned.length === 1 ? 'Exact number' : 'Exact numbers'}</span>
              <span className={cx('eyebrow', 'num')}>{pinned.length}</span>
            </div>
            <ul className={s.list}>{pinned.map((match, index) => renderRow(match, index, true))}</ul>
          </section>
        ) : null}
        {groups ? (
          groups.map(({ id, rows }) => {
            const view = topics[id]
            const name = TOPIC_BY_ID[id].name
            return (
              <section key={id} id={campAnchor(id)} className={s.group} aria-label={name}>
                <Link to={ROUTES.topic(id)} className={s.head} aria-label={`${name}, ${view.solved} of ${view.total} solved. Open on the map`}>
                  <span className={s.headName}>
                    <span className={cx('eyebrow', s.camp)}>Camp {String(campNumber(id)).padStart(2, '0')}</span>
                    <span className={cx('place', s.topicName)}>{name}</span>
                    {filtered && rows.length < view.total ? <span className={cx('eyebrow', s.shown)}>{rows.length} shown</span> : null}
                  </span>
                  <span className={s.headStat}>
                    <span className={cx('num', s.count)}>
                      {view.solved} / {view.total}
                    </span>
                    <Meter value={view.progress} className={s.meter} />
                    <ArrowRight className={s.arrow} aria-hidden="true" />
                  </span>
                </Link>
                <ul className={s.list}>{rows.map(({ match, index }) => renderRow(match, index, false))}</ul>
              </section>
            )
          })
        ) : (
          <section className={s.group}>
            <div className={s.flatHead}>
              <span className="eyebrow">Sorted {SORT_OPTIONS.find((o) => o.value === sort)?.phrase}</span>
              <span className={cx('eyebrow', 'num')}>{rest.length}</span>
            </div>
            <ul className={cx(s.list, s.flat)}>{rest.map((match, index) => renderRow(match, pinCount + index, true))}</ul>
          </section>
        )}
      </motion.div>
    </div>
  )
}

/**
 * The right of a row: the last result and when, then the status. A mastered problem shows no status
 * chip because its cairn is full and carries the flag; the chip is for what still needs a date.
 */
function Trailing({ view, today }: { view: ProblemView; today: string }) {
  const status = statusLabel(view)
  const last = view.attempts[view.attempts.length - 1]
  return (
    <>
      {last ? (
        <span className={s.last}>
          <span className={s.dot} data-rating={last.rating} aria-hidden="true" />
          <span className={cx('num', s.lastText)}>
            {RATING_META[last.rating].label} {'·'} {ago(last.date, today)}
          </span>
        </span>
      ) : null}
      <span className={s.status}>
        {status && view.status !== 'mastered' ? (
          <Chip tone={status.tone} variant={status.variant}>
            {status.text}
          </Chip>
        ) : null}
      </span>
    </>
  )
}

/** What matched outside the title: a line of your notes, or the tag. Shown inside the row, so the whole thing is one target. */
function SnippetLine({ snippet, tokens }: { snippet: Snippet; tokens: string[] }) {
  return (
    <span className={s.snippet}>
      <span className={cx('eyebrow', s.snippetLabel)}>{snippet.kind === 'notes' ? snippet.label : 'Tag'}</span>
      {snippet.kind === 'hidden-tag' ? (
        <span className={cx(s.snippetText, 'muted')}>Matches a pattern tag</span>
      ) : (
        <span className={s.snippetText}>
          <Highlight text={snippet.text} tokens={tokens} />
        </span>
      )}
    </span>
  )
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  const parts = useMemo(() => {
    const patterns = [...new Set(tokens.filter((t) => normalize(t)))]
      .sort((a, b) => b.length - a.length)
      .map(wordPattern)
      .filter(Boolean)
    if (patterns.length === 0) return [text]
    return text.split(new RegExp(`(${patterns.join('|')})`, 'gi'))
  }, [text, tokens])
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}
    </>
  )
}
