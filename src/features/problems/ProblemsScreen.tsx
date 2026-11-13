import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useProblemSheet } from '../../app/nav'
import { Button, Empty, PageHeader, useHotkeys, useListCursor } from '../../ui'
import { useDerived } from '../../state/hooks'
import { Results } from './Results'
import { Toolbar } from './Toolbar'
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
  matchSearch,
  passesStatus,
  readFilters,
  sortMatches,
  tokenize,
  withFilters,
  type Filters,
  type Match,
  type StatusFilter,
} from './filters'
import s from './ProblemsScreen.module.css'

const URL_DELAY = 180

/** Sheet 03: all 150 problems, searchable, filterable, sortable. */
export default function ProblemsScreen() {
  const derived = useDerived()
  const sheet = useProblemSheet()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const inputRef = useRef<HTMLInputElement>(null)

  // The text field keeps its own state so typing never waits on the router; the URL follows.
  const urlQ = filters.q
  const [text, setText] = useState(urlQ)
  const written = useRef(urlQ)
  useEffect(() => {
    if (urlQ !== written.current) {
      written.current = urlQ
      setText(urlQ)
    }
  }, [urlQ])
  useEffect(() => {
    if (text === urlQ) return
    const timer = window.setTimeout(() => {
      written.current = text
      setParams((current) => withFilters(current, { q: text }), { replace: true })
    }, URL_DELAY)
    return () => window.clearTimeout(timer)
  }, [text, urlQ, setParams])

  const update = (patch: Partial<Filters>) => setParams((current) => withFilters(current, patch))
  const clear = () => {
    setText('')
    written.current = ''
    setParams((current) => withFilters(current, { q: '', status: 'all', d: [], topic: 'all' }))
  }

  const query = useDeferredValue(text)
  const tokens = useMemo(() => tokenize(query), [query])
  const filtered = tokens.length > 0 || filters.status !== 'all' || filters.d.length > 0 || filters.topic !== 'all'

  // Everything but the status filter, so each status tab can show what it would give.
  const grades = filters.d.join(',')
  const base = useMemo(() => {
    const out: Match[] = []
    for (const view of derived.list) {
      if (filters.topic !== 'all' && view.problem.topic !== filters.topic) continue
      if (grades && !grades.includes(view.problem.difficulty)) continue
      const match = matchSearch(view, tokens)
      if (match) out.push(match)
    }
    return out
  }, [derived.list, tokens, filters.topic, grades])

  const counts = useMemo(() => {
    const out = {} as Record<StatusFilter, number>
    for (const { value } of STATUS_OPTIONS) out[value] = base.filter((m) => passesStatus(m.view, value)).length
    return out
  }, [base])

  // A word that is exactly a problem's number puts that problem first, so Enter opens it.
  const matches = useMemo(() => {
    const sorted = sortMatches(base.filter((m) => passesStatus(m.view, filters.status)), filters.sort)
    return tokens.length > 0 ? [...sorted.filter((m) => m.exact), ...sorted.filter((m) => !m.exact)] : sorted
  }, [base, tokens.length, filters.status, filters.sort])
  const rows = useMemo(() => matches.map((m) => m.view), [matches])

  const cursor = useListCursor(rows, { onOpen: (view) => sheet.open(view.problem.slug) })

  useHotkeys({
    '/': () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    },
  })

  // The shell sends "/" from other screens here with focusSearch set.
  const wantsSearch = (location.state as { focusSearch?: boolean } | null)?.focusSearch === true
  useEffect(() => {
    if (wantsSearch) inputRef.current?.focus()
  }, [wantsSearch])

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (text) setText('')
      else event.currentTarget.blur()
    } else if (event.key === 'ArrowDown' && rows.length) {
      event.preventDefault()
      event.currentTarget.blur()
      cursor.setIndex(0)
    } else if (event.key === 'Enter' && rows.length) {
      event.preventDefault()
      sheet.open(rows[0].problem.slug)
    }
  }

  const total = derived.list.length
  const { counts: overall } = derived
  const sortPhrase = SORT_OPTIONS.find((o) => o.value === filters.sort)?.phrase ?? ''

  const title = !filtered ? (
    <>
      All <em>{total}</em>, {sortPhrase}.
    </>
  ) : matches.length === 0 ? (
    <>
      Nothing <em>matches</em>.
    </>
  ) : (
    <>
      {matches.length} {matches.length === 1 ? 'problem' : 'problems'} <em>{matches.length === 1 ? 'matches' : 'match'}</em>.
    </>
  )

  const lede = filtered ? null : overall.solved === 0 ? (
    <>All {total} are still to do, which is how a climb starts. Open any waypoint, or begin at the first camp.</>
  ) : (
    <>
      <span className="num">{overall.solved}</span> solved, <span className="num">{overall.due}</span> ready to revise,{' '}
      <span className="num">{overall.mastered}</span> mastered. <span className="num">{overall.todo}</span> still to do.
    </>
  )

  return (
    <div className="page">
      <PageHeader sheet="03" name="Problems" terrain={3} meta={`${matches.length} of ${total}`} title={title} lede={lede} />

      <Toolbar
        text={text}
        onText={setText}
        onSearchKey={onSearchKey}
        inputRef={inputRef}
        filters={filters}
        counts={counts}
        filtered={filtered}
        onChange={update}
        onClear={clear}
      />

      <p className="sr-only" role="status">
        {matches.length} of {total} problems shown
      </p>

      <div className={s.body}>
        {matches.length === 0 ? (
          <Empty
            seed={23}
            title={tokens.length ? 'No problem on this route' : emptyTitle(filters.status)}
            body={emptyBody(filters, query.trim())}
            action={
              <Button onClick={clear} variant="secondary">
                Clear filters
              </Button>
            }
          />
        ) : (
          <Results
            matches={matches}
            sort={filters.sort}
            tokens={tokens}
            filtered={filtered}
            cursor={cursor}
            topics={derived.topics}
            today={derived.today}
            onOpen={(slug) => sheet.open(slug)}
          />
        )}
      </div>
    </div>
  )
}

function emptyTitle(status: StatusFilter): string {
  switch (status) {
    case 'solved':
      return 'Nothing solved here yet'
    case 'due':
      return 'Nothing is ready to revise'
    case 'mastered':
      return 'No summit reached here yet'
    case 'notes':
      return 'No notes written here yet'
    case 'todo':
      return 'Nothing left to do here'
    default:
      return 'No problem on this route'
  }
}

function emptyBody(filters: Filters, query: string): string {
  if (query) return `No title, topic, tag or note matches \u201c${query}\u201d with these filters. Try fewer words.`
  switch (filters.status) {
    case 'solved':
      return 'Solved problems appear here once you log an attempt.'
    case 'due':
      return 'A problem comes up for revision on its scheduled day. Today, none is waiting.'
    case 'mastered':
      return 'A problem is mastered after five revisions are cleared.'
    case 'notes':
      return 'Insights, complexities and pitfalls you write on a problem appear here.'
    case 'todo':
      return 'Every problem in this selection has been attempted.'
    default:
      return 'No problem fits these filters. Loosen one of them.'
  }
}

