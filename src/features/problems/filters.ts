/** The Problems screen's query: what lives in the URL, how rows are matched, and how they are ordered. */
import { PATTERN_BY_ID, ROADMAP_ORDER, TOPIC_BY_ID, isTopicId } from '../../data'
import type { Difficulty, TopicId } from '../../data/types'
import type { ProblemView } from '../../domain/types'

export type StatusFilter = 'all' | 'todo' | 'solved' | 'due' | 'mastered' | 'notes'
export type SortKey = 'roadmap' | 'number' | 'difficulty' | 'revision' | 'attempted' | 'title'

export interface Filters {
  q: string
  status: StatusFilter
  d: Difficulty[]
  topic: TopicId | 'all'
  sort: SortKey
}

export const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'solved', label: 'Solved' },
  { value: 'due', label: 'Due' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'notes', label: 'Has notes' },
]

export const SORT_OPTIONS: readonly { value: SortKey; label: string; phrase: string }[] = [
  { value: 'roadmap', label: 'Roadmap order', phrase: 'in the order of the climb' },
  { value: 'number', label: 'Number', phrase: 'by number' },
  { value: 'difficulty', label: 'Difficulty', phrase: 'by difficulty' },
  { value: 'revision', label: 'Next revision', phrase: 'by next revision' },
  { value: 'attempted', label: 'Last attempted', phrase: 'by last attempt' },
  { value: 'title', label: 'Title', phrase: 'A to Z' },
]

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

const STATUSES = new Set<string>(STATUS_OPTIONS.map((o) => o.value))
const SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value))

export function readFilters(params: URLSearchParams): Filters {
  const status = params.get('status') ?? ''
  const sort = params.get('sort') ?? ''
  const topic = params.get('topic') ?? ''
  const d = (params.get('d') ?? '').split(',').filter((x): x is Difficulty => (DIFFICULTIES as readonly string[]).includes(x))
  return {
    q: params.get('q') ?? '',
    status: STATUSES.has(status) ? (status as StatusFilter) : 'all',
    d: DIFFICULTIES.filter((x) => d.includes(x)),
    topic: isTopicId(topic) ? topic : 'all',
    sort: SORTS.has(sort) ? (sort as SortKey) : 'roadmap',
  }
}

/** Write one change into the params, dropping anything at its default and leaving other params (the sheet's "p") alone. */
export function withFilters(current: URLSearchParams, patch: Partial<Filters>): URLSearchParams {
  const next = { ...readFilters(current), ...patch }
  const out = new URLSearchParams(current)
  const set = (key: string, value: string, fallback: string) => {
    if (value && value !== fallback) out.set(key, value)
    else out.delete(key)
  }
  set('q', next.q, '')
  set('status', next.status, 'all')
  set('d', next.d.join(','), '')
  set('topic', next.topic, 'all')
  set('sort', next.sort, 'roadmap')
  return out
}

// ---------------------------------------------------------------------------------------------
// Search

export type Snippet =
  | { kind: 'notes'; label: string; text: string }
  | { kind: 'tag'; text: string }
  /** The match is on a pattern tag of a problem not yet solved: say so, never print the tag. */
  | { kind: 'hidden-tag' }

export interface Match {
  view: ProblemView
  snippet: Snippet | null
  /** A word of the query is exactly this problem's number. */
  exact: boolean
}

/** Words of the query. "and" is dropped when it joins other words, so "arrays and hashing" reads like "arrays & hashing". */
export function tokenize(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/#/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const rest = words.filter((w) => w !== 'and' && w !== '&')
  return rest.length > 0 ? rest : words
}

/** Letters and digits only, one space between words, "&" read as "and": "1-D Dynamic Programming" becomes "1 d dynamic programming". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The normalized form plus the way people type dimensions: "1 d dynamic programming" also reads "1d dynamic programming". */
function haystack(text: string): { spaced: string; joined: string } {
  const spaced = normalize(text)
  return { spaced, joined: spaced.replace(/(\d) ([a-z])\b/g, '$1$2') }
}

type Plain = { lower: string; spaced: string; joined: string }

function plain(text: string): Plain {
  const { spaced, joined } = haystack(text)
  return { lower: text.toLowerCase(), spaced, joined }
}

/** Does a query word hit this text, as typed or with punctuation and spacing ignored ("binary-search", "1d")? */
function hit(text: Plain, token: string, word: string): boolean {
  return text.lower.includes(token) || text.spaced.includes(word) || text.joined.includes(word)
}

/** A regular expression source that finds a query word however its punctuation is written. */
export function wordPattern(word: string): string {
  const letters = normalize(word).replace(/ /g, '')
  if (!letters) return ''
  return [...letters].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9]{0,2}')
}

const NOTE_FIELDS = [
  { key: 'insight', label: 'Insight' },
  { key: 'time', label: 'Time' },
  { key: 'space', label: 'Space' },
  { key: 'pitfalls', label: 'Pitfalls' },
] as const

const HEAD = 28
const TAIL = 56

function excerpt(text: string, at: number, length: number): string {
  const start = Math.max(0, at - HEAD)
  const end = Math.min(text.length, at + length + TAIL)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

function problemTags(view: ProblemView): string[] {
  const { problem } = view
  const out = [...problem.tags]
  const pattern = PATTERN_BY_ID[problem.pattern]?.name
  if (pattern && !out.some((t) => t.toLowerCase() === pattern.toLowerCase())) out.push(pattern)
  return out
}

/** Does every word of the query hit this problem somewhere? If a word lands only in tags or notes, say where. */
export function matchSearch(view: ProblemView, tokens: string[]): Match | null {
  if (tokens.length === 0) return { view, snippet: null, exact: false }
  const { problem, record } = view
  const title = plain(problem.title)
  const number = String(problem.number)
  const topic = plain(`${TOPIC_BY_ID[problem.topic].name} ${TOPIC_BY_ID[problem.topic].short}`)
  const tags = problemTags(view)
  const notes = record
    ? NOTE_FIELDS.map((f) => ({ label: f.label, text: record.notes[f.key].replace(/\s+/g, ' ').trim() })).filter((f) => f.text)
    : []

  // A word that lands on a title, topic or number needs no explanation; the others get a snippet.
  let fromTag: Snippet | null = null
  let fromNotes: Snippet | null = null
  let exact = false
  for (const token of tokens) {
    const digits = /^\d+$/.test(token)
    if (digits && number === token) exact = true
    const word = normalize(token)
    if (!word) continue
    if (hit(title, token, word) || hit(topic, token, word) || (digits && number.startsWith(token))) continue
    const found = tags.filter((t) => hit(plain(t), token, word))
    if (found.length) {
      fromTag ??= view.solved ? { kind: 'tag', text: found.join(' \u00b7 ') } : { kind: 'hidden-tag' }
      continue
    }
    const field = notes.find((f) => f.text.toLowerCase().includes(token))
    if (!field) return null
    fromNotes ??= { kind: 'notes', label: field.label, text: excerpt(field.text, field.text.toLowerCase().indexOf(token), token.length) }
  }
  // Notes are the user's own words, so they can always be quoted; a tag of an unsolved problem never is.
  const snippet = fromNotes ?? fromTag
  return { view, snippet, exact }
}

// ---------------------------------------------------------------------------------------------
// Status, sort

export function passesStatus(view: ProblemView, status: StatusFilter): boolean {
  switch (status) {
    case 'all':
      return true
    case 'todo':
      return view.status === 'todo'
    case 'solved':
      return view.status !== 'todo'
    case 'due':
      return view.status === 'due'
    case 'mastered':
      return view.status === 'mastered'
    case 'notes':
      return view.hasNotes
  }
}

const GRADE: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }
const ROADMAP_RANK = Object.fromEntries(ROADMAP_ORDER.map((id, i) => [id, i])) as Record<TopicId, number>

/** The camp number (1-based) of a topic along the roadmap. */
export function campNumber(id: TopicId): number {
  return ROADMAP_RANK[id] + 1
}

const roadmapOrder = (a: ProblemView, b: ProblemView) =>
  ROADMAP_RANK[a.problem.topic] - ROADMAP_RANK[b.problem.topic] || a.problem.indexInTopic - b.problem.indexInTopic

export function sortMatches(matches: Match[], sort: SortKey): Match[] {
  const out = [...matches]
  switch (sort) {
    case 'roadmap':
      return out.sort((a, b) => roadmapOrder(a.view, b.view))
    case 'number':
      return out.sort((a, b) => a.view.problem.number - b.view.problem.number)
    case 'difficulty':
      return out.sort((a, b) => GRADE[a.view.problem.difficulty] - GRADE[b.view.problem.difficulty] || roadmapOrder(a.view, b.view))
    case 'title':
      return out.sort((a, b) => a.view.problem.title.localeCompare(b.view.problem.title))
    case 'revision':
      // Soonest first; problems with nothing scheduled (to do, mastered) go last.
      return out.sort((a, b) => {
        const x = a.view.srs?.due ?? '9999'
        const y = b.view.srs?.due ?? '9999'
        return x < y ? -1 : x > y ? 1 : roadmapOrder(a.view, b.view)
      })
    case 'attempted':
      return out.sort((a, b) => {
        const x = a.view.srs?.lastOn ?? ''
        const y = b.view.srs?.lastOn ?? ''
        return x < y ? 1 : x > y ? -1 : roadmapOrder(a.view, b.view)
      })
  }
}
