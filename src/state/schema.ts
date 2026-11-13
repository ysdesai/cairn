/**
 * Everything the app persists. One JSON document, versioned, small enough to export by hand.
 * Anything that can be computed from it (statuses, due dates, streaks, scores) is NOT stored:
 * see domain/derive.ts.
 */
import type { Difficulty, PatternId, TopicId } from '../data/types'

export const APP_ID = 'cairn'
export const SCHEMA_VERSION = 1

/** A local calendar date, 'YYYY-MM-DD'. Never a UTC timestamp. */
export type ISODate = string

// ---------------------------------------------------------------------------------------------
// Attempts

/** How an attempt went. The three choices the brief asks for. */
export type Rating = 'easy' | 'struggled' | 'help'

export const RATINGS: readonly Rating[] = ['easy', 'struggled', 'help']

export const RATING_META: Record<Rating, { label: string; hint: string; hotkey: string }> = {
  easy: { label: 'Easy', hint: 'Solved alone, quickly', hotkey: '1' },
  struggled: { label: 'Struggled', hint: 'Solved alone, slowly', hotkey: '2' },
  help: { label: 'Needed help', hint: 'Used a hint, video or solution', hotkey: '3' },
}

export type MistakeTag =
  | 'wrong-pattern'
  | 'edge-case'
  | 'off-by-one'
  | 'complexity'
  | 'bug'
  | 'out-of-time'
  | 'misread'
  | 'blanked'

export const MISTAKE_TAGS: readonly { id: MistakeTag; label: string; hint: string }[] = [
  { id: 'wrong-pattern', label: 'Wrong pattern', hint: 'Reached for the wrong technique first' },
  { id: 'edge-case', label: 'Missed edge case', hint: 'Empty input, duplicates, single element, overflow' },
  { id: 'off-by-one', label: 'Off-by-one', hint: 'Boundaries, loop ends, inclusive vs exclusive' },
  { id: 'complexity', label: 'Wrong complexity', hint: 'Too slow, or misjudged the time or space' },
  { id: 'bug', label: 'Implementation bug', hint: 'Right idea, wrong code' },
  { id: 'out-of-time', label: 'Ran out of time', hint: 'Could not finish inside the target' },
  { id: 'misread', label: 'Misread the problem', hint: 'Solved a different question' },
  { id: 'blanked', label: 'Blanked', hint: 'Did not know where to start' },
]

export const MISTAKE_LABEL: Record<MistakeTag, string> = Object.fromEntries(
  MISTAKE_TAGS.map((m) => [m.id, m.label]),
) as Record<MistakeTag, string>

export type AttemptSource = 'manual' | 'mock'

/**
 * One logged attempt at a problem. The chronologically first attempt is "the solve";
 * every later one is a revision. That is derived from order, not stored, so backdating
 * or deleting an attempt can never leave the history inconsistent.
 */
export interface Attempt {
  id: string
  /** The day it counts for. May be backdated. */
  date: ISODate
  /** When it was logged (epoch ms). Breaks ties between attempts on the same date. */
  at: number
  rating: Rating
  /** Time spent, in minutes. null when skipped. */
  minutes: number | null
  mistakes: MistakeTag[]
  source: AttemptSource
  /** Revisions only: what was typed from memory before the notes were revealed. */
  recall?: string
}

export interface Notes {
  /** The key insight. */
  insight: string
  /** Time complexity, free text, e.g. "O(n log n)". */
  time: string
  /** Space complexity. */
  space: string
  /** Mistakes and things to watch for. */
  pitfalls: string
  updatedAt: number | null
}

export const EMPTY_NOTES: Notes = { insight: '', time: '', space: '', pitfalls: '', updatedAt: null }

export interface ProblemRecord {
  attempts: Attempt[]
  notes: Notes
}

// ---------------------------------------------------------------------------------------------
// Pattern drill

export interface DrillResult {
  at: number
  date: ISODate
  /** The problem shown. */
  slug: string
  /** The correct pattern. */
  answer: PatternId
  /** What was picked. */
  picked: PatternId
  correct: boolean
  /** Time to answer, ms. */
  ms: number
}

// ---------------------------------------------------------------------------------------------
// Mock interviews

export type MockPool = 'any' | 'solved' | 'unsolved'
export type MockMix = 'any' | 'easy-medium' | 'medium-medium' | 'medium-hard'

export const MOCK_MIX_META: Record<MockMix, { label: string; hint: string }> = {
  any: { label: 'Surprise me', hint: 'Any two difficulties' },
  'easy-medium': { label: 'Easy + Medium', hint: 'A warm-up, then the real one' },
  'medium-medium': { label: 'Medium + Medium', hint: 'The typical phone screen' },
  'medium-hard': { label: 'Medium + Hard', hint: 'A tough onsite round' },
}

export interface MockConfig {
  mix: MockMix
  pool: MockPool
  /** Empty means every topic. */
  topics: TopicId[]
  minutes: number
}

export type MockOutcome = Rating | 'unfinished'

export interface MockResult {
  outcome: MockOutcome
  minutes: number | null
  mistakes: MistakeTag[]
}

export interface MockSession {
  id: string
  startedAt: number
  config: MockConfig
  slugs: string[]
  /** running: clock is live. review: time is up or ended early, waiting for ratings. */
  status: 'running' | 'review' | 'done' | 'abandoned'
  endedAt: number | null
  /** Elapsed ms at which each problem was marked finished during the mock. */
  marks: Record<string, number>
  /** Filled in when the mock is rated. */
  results: Record<string, MockResult>
}

// ---------------------------------------------------------------------------------------------
// Timer and session

/** The solve timer. At most one runs at a time; it survives reloads. */
export interface TimerState {
  slug: string
  /** Epoch ms the current run started, or null while paused. */
  runningSince: number | null
  /** Time banked before the current run, ms. */
  elapsedMs: number
}

export type SessionItemKind = 'review' | 'new' | 'drill'

export interface SessionItem {
  kind: SessionItemKind
  /** Absent for a drill block. */
  slug?: string
  /** Estimated minutes. */
  minutes: number
  /** Why it is in the queue, in a few words. */
  reason: string
}

/** A queue built for a time budget. Completion is derived from what gets logged that day. */
export interface SessionPlan {
  date: ISODate
  budget: number
  items: SessionItem[]
  createdAt: number
}

// ---------------------------------------------------------------------------------------------
// Settings and the document

export interface Settings {
  startDate: ISODate
  targetDate: ISODate
  /** Most revisions the app will put in front of you per day. */
  dailyReviewCap: number
  /** Solve-timer targets, minutes. */
  targets: Record<Difficulty, number>
  /** Mock interview length, minutes. */
  mockMinutes: number
  /** The last time budget chosen in the session builder, minutes. */
  sessionMinutes: number
}

export const DEFAULT_TARGETS: Record<Difficulty, number> = { easy: 15, medium: 25, hard: 40 }
export const DEFAULT_REVIEW_CAP = 5
export const DEFAULT_MOCK_MINUTES = 45
export const DEFAULT_SESSION_MINUTES = 60
/** A new plan runs twelve weeks unless told otherwise. */
export const DEFAULT_PLAN_DAYS = 84

export interface AppData {
  app: typeof APP_ID
  version: number
  createdAt: number
  updatedAt: number
  settings: Settings
  /** Keyed by problem slug. Only problems that have an attempt or notes appear. */
  problems: Record<string, ProblemRecord>
  drills: DrillResult[]
  mocks: MockSession[]
  timer: TimerState | null
  session: SessionPlan | null
  /** True while the generated demo history is loaded. */
  demo: boolean
  /** False until the first-run welcome has been dismissed. */
  onboarded: boolean
}

/** Theme is a per-device preference, kept outside the exported document. */
export type ThemeChoice = 'system' | 'light' | 'dark'
