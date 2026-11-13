/**
 * The derived view of the stored document: everything the screens read.
 * `derive(data, today)` in derive.ts builds one `Derived` object from an `AppData`;
 * the functions that fill each part live in the sibling modules.
 */
import type { Difficulty, Pattern, PatternId, Problem, Topic, TopicId } from '../data/types'
import type { Attempt, ISODate, MistakeTag, MockSession, ProblemRecord, Rating, SessionItem } from '../state/schema'

// ---------------------------------------------------------------------------------------------
// Problems and spaced repetition

/**
 * todo: never attempted.
 * learning: solved, next revision is in the future.
 * due: next revision is today or already waiting (past its date).
 * mastered: cleared the whole ladder; never comes back on its own.
 */
export type ProblemStatus = 'todo' | 'learning' | 'due' | 'mastered'

export interface SrsState {
  /** Rungs of the ladder cleared: 0 … LADDER.length. LADDER.length means mastered. */
  step: number
  /** Per-problem interval multiplier. Starts at 1, drifts with how revisions go. */
  ease: number
  /** Days from the last attempt to `due`. null once mastered. */
  interval: number | null
  /** When the next revision is due. null once mastered. */
  due: ISODate | null
  mastered: boolean
  /** Revisions rated "Needed help". */
  lapses: number
  /** Attempts after the first one. */
  reviews: number
  /** Date of the first attempt (the solve). */
  firstOn: ISODate
  /** Date of the latest attempt. */
  lastOn: ISODate
  lastRating: Rating
}

/** What a rating would do if logged on a given day. Shown on the rating buttons. */
export interface SrsPreview {
  step: number
  interval: number | null
  due: ISODate | null
  mastered: boolean
}

export interface ProblemView {
  problem: Problem
  /** The stored record, or null if nothing has been logged or noted. */
  record: ProblemRecord | null
  /** Attempts in chronological order (date, then time logged). */
  attempts: Attempt[]
  status: ProblemStatus
  solved: boolean
  srs: SrsState | null
  /** Days until the next revision: 0 = today, negative = waiting (past its date). null for todo and mastered. */
  dueIn: number | null
  hasNotes: boolean
  /** Minutes on the most recent timed attempt. */
  lastMinutes: number | null
  /** Fastest timed attempt. */
  bestMinutes: number | null
  /** Distinct mistake tags across all attempts. */
  mistakes: MistakeTag[]
  /** An attempt is dated today. */
  touchedToday: boolean
}

// ---------------------------------------------------------------------------------------------
// Topics

/**
 * complete: every problem solved.
 * active: some solved.
 * ready: none solved, prerequisites far enough along (or it has none).
 * ahead: none solved and a prerequisite still needs work. Still openable; this is advice, not a lock.
 */
export type TopicState = 'complete' | 'active' | 'ready' | 'ahead'

/** The four ingredients of a strength score, each 0…1, or null when there is no data for it. */
export interface StrengthParts {
  /** How attempts were rated, recent ones weighted more. */
  ratings: number | null
  /** Solve times against the target for the difficulty. */
  pace: number | null
  /** How revisions hold up: few lapses, far up the ladder. */
  retention: number | null
  /** Pattern-drill accuracy on this topic's problems. May be reported while the topic's strength is null (nothing solved). */
  drill: number | null
}

export interface TopicView {
  topic: Topic
  /** The topic's problems in order. */
  problems: ProblemView[]
  total: number
  solved: number
  mastered: number
  due: number
  /** solved / total, 0…1. */
  progress: number
  state: TopicState
  /** One of the topics the roadmap suggests working on now. */
  recommended: boolean
  /** 0…100. null until at least one problem in the topic is solved (drill answers alone never score a topic). */
  strength: number | null
  parts: StrengthParts
  /** How much evidence is behind the score. 'none' while strength is null. */
  confidence: 'none' | 'low' | 'medium' | 'high'
  /** A short phrase naming the weakest ingredient, e.g. "two lapses in revision". null if nothing stands out or strength is null. */
  weakness: string | null
  /** The first unsolved problem. */
  next: Problem | null
}

// ---------------------------------------------------------------------------------------------
// What to do

export interface ReviewQueue {
  /** The daily cap from settings. */
  cap: number
  /** Revisions already logged today. They count against the cap. */
  doneToday: number
  /** Revise these today: most urgent and weakest first. Never longer than the cap allows. */
  today: ProblemView[]
  /** Due, but beyond today's cap. They roll forward; nothing is "late". */
  waiting: ProblemView[]
  /** today.length + waiting.length */
  totalDue: number
}

export type RecommendReason = 'continue' | 'weak-area' | 'new-topic' | 'explore'

export interface Recommendation {
  problem: Problem
  reason: RecommendReason
  /** A few words for the UI: "Continue Two Pointers · 3 of 5". */
  note: string
}

export type SuggestionKind = 'start' | 'revise' | 'shore-up' | 'advance' | 'drill' | 'summit'

/** The single clearest "work on this next" call, shown on Today and in Insights. */
export interface Suggestion {
  kind: SuggestionKind
  topic: TopicId | null
  problem: Problem | null
  /** One short sentence. */
  headline: string
  /** One sentence of reasoning with the numbers behind it. */
  detail: string
}

/** A built session with completion worked out from today's log. */
export interface SessionView {
  budget: number
  items: (SessionItem & { done: boolean; problem: Problem | null })[]
  plannedMinutes: number
  doneCount: number
  /** Index of the first item not done, or -1 when the session is finished. */
  nextIndex: number
}

// ---------------------------------------------------------------------------------------------
// Standing

export interface Counts {
  total: number
  solved: number
  mastered: number
  learning: number
  due: number
  todo: number
}

export type PaceStatus = 'not-started' | 'ahead' | 'on-pace' | 'behind' | 'done'

export interface PlanPoint {
  date: ISODate
  /** Cumulative problems solved by the end of this day. null for days after today. */
  actual: number | null
  /** Where the straight-line plan says you should be by the end of this day. */
  planned: number
}

export interface PlanStats {
  startDate: ISODate
  targetDate: ISODate
  /** Days in the plan, start and target inclusive. */
  totalDays: number
  /** 1-based day of the plan today falls on (may exceed totalDays once past the target). */
  dayNumber: number
  /** Days left including today. 0 once past the target. */
  daysLeft: number
  total: number
  solved: number
  remaining: number
  /** Planned cumulative count for today. */
  expected: number
  /** solved − expected. Positive means ahead. */
  delta: number
  status: PaceStatus
  /** Problems per day needed from today to finish on the target date. */
  neededPerDay: number
  /** Problems per day over the last 14 days. */
  recentPerDay: number
  /** Problems per day since the start date. */
  overallPerDay: number
  /** When the remaining problems run out at the recent pace. null if the pace is zero. */
  projectedFinish: ISODate | null
  /** One point per day from startDate to the later of targetDate and today. */
  series: PlanPoint[]
}

export interface StreakStats {
  /** Consecutive active days ending today, or ending yesterday if today is not active yet. */
  current: number
  best: number
  activeToday: boolean
  lastActive: ISODate | null
  /** The last 14 days, oldest first; true where there was a solve or revision. */
  recent: boolean[]
}

export interface ActivityDay {
  date: ISODate
  solves: number
  reviews: number
  /** solves + reviews */
  total: number
  /** Minutes logged that day. */
  minutes: number
}

export interface ActivityStats {
  /** Only days with activity. */
  days: Record<ISODate, ActivityDay>
  /** The busiest day's total, at least 1. */
  max: number
  activeDays: number
  totalMinutes: number
}

export interface ForecastDay {
  date: ISODate
  /** 0 = today. */
  offset: number
  /** Revisions the cap lets through that day. */
  scheduled: number
  /** Still waiting at the end of that day: due, but held back by the cap. The same problem is counted on each day it waits, so never sum this across days. */
  carried: number
}

export interface MistakeStats {
  /** Total tags logged. */
  total: number
  /** Every tag, most frequent first (zero counts included). */
  byTag: { tag: MistakeTag; count: number }[]
  /** Topics with at least one tagged mistake, most first. */
  byTopic: { topic: TopicId; total: number; byTag: Partial<Record<MistakeTag, number>> }[]
}

export interface DifficultyStat {
  difficulty: Difficulty
  total: number
  solved: number
  mastered: number
  /** Mean minutes of timed first solves. */
  avgMinutes: number | null
  /** The target from settings. */
  target: number
}

export interface PatternStat {
  pattern: Pattern
  seen: number
  correct: number
  /** correct / seen. null when unseen. */
  accuracy: number | null
  /** Most common wrong picks when this pattern was the answer. */
  confusedWith: { pattern: PatternId; count: number }[]
}

export interface DrillStats {
  total: number
  correct: number
  accuracy: number | null
  /** Cards answered today. */
  today: number
  /** In PATTERNS order. */
  byPattern: PatternStat[]
  /** Seen at least 3 times and under 80% right, lowest accuracy first. Up to 5. Empty while no pattern is both tested and missed. */
  weakest: PatternStat[]
  byTopic: Record<TopicId, { seen: number; correct: number }>
}

// ---------------------------------------------------------------------------------------------
// The whole picture

export interface Derived {
  today: ISODate
  /** Every problem, keyed by slug. */
  problems: Record<string, ProblemView>
  /** All 150 in order. */
  list: ProblemView[]
  topics: Record<TopicId, TopicView>
  /** In listing order. */
  topicList: TopicView[]
  counts: Counts
  queue: ReviewQueue
  /** New problems to attempt next, best first. Up to 6. */
  recommendations: Recommendation[]
  suggestion: Suggestion
  /** The stored session for today, if one was built today. */
  session: SessionView | null
  plan: PlanStats
  streak: StreakStats
  activity: ActivityStats
  /** 14 days starting today. */
  forecast: ForecastDay[]
  mistakes: MistakeStats
  /** easy, medium, hard. */
  difficulty: DifficultyStat[]
  drill: DrillStats
  /** A mock that is running or waiting to be rated. */
  activeMock: MockSession | null
}
