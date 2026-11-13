/**
 * Every change to the stored document, as pure functions: (data, …input) → new data.
 * Nothing here mutates its input, reads the clock, or touches storage; `now` (epoch ms) and
 * `today` are passed in. Each returns a new object with `updatedAt = now`, or the SAME
 * object when the change is a no-op (so callers can skip saving).
 */
import { getProblem, PATTERN_BY_ID, TOPIC_BY_ID } from '../data'
import type { Difficulty, PatternId, TopicId } from '../data/types'
import { addDays, isISODate } from '../domain/dates'
import {
  APP_ID,
  DEFAULT_MOCK_MINUTES,
  DEFAULT_PLAN_DAYS,
  DEFAULT_REVIEW_CAP,
  DEFAULT_SESSION_MINUTES,
  DEFAULT_TARGETS,
  DRILL_KEEP,
  EMPTY_NOTES,
  MISTAKE_TAGS,
  MOCK_MIX_META,
  RATINGS,
  SCHEMA_VERSION,
} from './schema'
import type {
  AppData,
  Attempt,
  AttemptSource,
  DrillBucket,
  DrillResult,
  ISODate,
  MistakeTag,
  MockConfig,
  MockOutcome,
  MockPool,
  MockResult,
  MockSession,
  Notes,
  ProblemRecord,
  Rating,
  SessionPlan,
  Settings,
  TimerState,
} from './schema'

export interface AttemptInput {
  rating: Rating
  /** Defaults to today. May be in the past (backdating); a future date is clamped to today. */
  date?: ISODate
  /** Minutes spent. Rounded to a whole number, 1…600; anything else becomes null. */
  minutes?: number | null
  mistakes?: MistakeTag[]
  source?: AttemptSource
  recall?: string
}

export type AttemptPatch = Partial<Pick<Attempt, 'date' | 'rating' | 'minutes' | 'mistakes' | 'recall'>>

export const SETTINGS_LIMITS = {
  dailyReviewCap: { min: 1, max: 30 },
  target: { min: 5, max: 120 },
  mockMinutes: { min: 15, max: 120 },
  sessionMinutes: { min: 10, max: 240 },
} as const

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const MISTAKE_IDS: ReadonlySet<unknown> = new Set(MISTAKE_TAGS.map((m) => m.id))
const MAX_ATTEMPT_MINUTES = 600

// --- shared sanitisers (validate.ts reads documents with the same rules) -----------------------

/** Round to a whole number and clamp into the limits. null when the value is not a finite number. */
export function clampSetting(value: unknown, limit: { min: number; max: number }): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)))
}

/** Attempt minutes: whole numbers from 1 to 600, otherwise null. */
export function sanitizeMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded >= 1 && rounded <= MAX_ATTEMPT_MINUTES ? rounded : null
}

/** Known mistake tags only, each once, in the order given. */
export function sanitizeMistakes(value: unknown): MistakeTag[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((tag) => MISTAKE_IDS.has(tag)))] as MistakeTag[]
}

/** The trimmed recall text, or undefined when there is none. */
export function sanitizeRecall(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

/** Known topic ids only, each once. Checks own keys so names like "constructor" do not pass. */
export function sanitizeTopics(value: unknown): TopicId[] {
  if (!Array.isArray(value)) return []
  const known = value.filter((id) => typeof id === 'string' && Object.hasOwn(TOPIC_BY_ID, id))
  return [...new Set(known)] as TopicId[]
}

export function isRating(value: unknown): value is Rating {
  return RATINGS.includes(value as Rating)
}

export function isOutcome(value: unknown): value is MockOutcome {
  return value === 'unfinished' || isRating(value)
}

/** Own keys only, so a name like "toString" is not taken for a pattern. */
export function isPatternId(value: unknown): value is PatternId {
  return typeof value === 'string' && Object.hasOwn(PATTERN_BY_ID, value)
}

const MOCK_POOLS: readonly MockPool[] = ['any', 'solved', 'unsolved']

export function isMockMix(value: unknown): value is MockConfig['mix'] {
  return typeof value === 'string' && Object.hasOwn(MOCK_MIX_META, value)
}

export function isMockPool(value: unknown): value is MockPool {
  return MOCK_POOLS.includes(value as MockPool)
}

export function isBlankNotes(notes: Notes): boolean {
  return [notes.insight, notes.time, notes.space, notes.pitfalls].every((text) => text.trim() === '')
}

function sanitizeDate(value: unknown, today: ISODate): ISODate {
  if (!isISODate(value)) return today
  return value > today ? today : value
}

/** A unique id for attempts and mocks. */
export function makeId(): string {
  // randomUUID only exists in secure contexts; plain-http pages need the fallback.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
  }
  // padEnd: Math.random() can print fewer digits, which would shrink the random part.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8).padEnd(6, '0')
}

function touch(data: AppData, now: number, changes: Partial<AppData>): AppData {
  return { ...data, ...changes, updatedAt: now }
}

/** A fresh document: default settings, a twelve-week plan starting today, nothing logged. */
export function createEmptyData(today: ISODate, now: number): AppData {
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: {
      startDate: today,
      targetDate: addDays(today, DEFAULT_PLAN_DAYS - 1),
      dailyReviewCap: DEFAULT_REVIEW_CAP,
      targets: { ...DEFAULT_TARGETS },
      mockMinutes: DEFAULT_MOCK_MINUTES,
      sessionMinutes: DEFAULT_SESSION_MINUTES,
    },
    problems: {},
    drills: [],
    mocks: [],
    timer: null,
    session: null,
    demo: false,
    onboarded: false,
  }
}

// --- attempts and notes ------------------------------------------------------------------------

/** Sets or drops a problem's record: one with no attempts and blank notes is not kept. */
function putRecord(
  problems: AppData['problems'],
  slug: string,
  record: ProblemRecord,
): AppData['problems'] {
  const next = { ...problems }
  if (record.attempts.length === 0 && isBlankNotes(record.notes)) delete next[slug]
  else next[slug] = record
  return next
}

/** Own keys only, so a slug like "constructor" never finds an inherited member. */
function recordOf(problems: AppData['problems'], slug: string): ProblemRecord | undefined {
  return Object.hasOwn(problems, slug) ? problems[slug] : undefined
}

function appendAttempt(problems: AppData['problems'], slug: string, attempt: Attempt): AppData['problems'] {
  const record = recordOf(problems, slug) ?? { attempts: [], notes: { ...EMPTY_NOTES } }
  return putRecord(problems, slug, { ...record, attempts: [...record.attempts, attempt] })
}

function buildAttempt(input: AttemptInput, today: ISODate, now: number): Attempt {
  const attempt: Attempt = {
    id: makeId(),
    date: sanitizeDate(input.date, today),
    at: now,
    rating: input.rating,
    minutes: sanitizeMinutes(input.minutes),
    mistakes: sanitizeMistakes(input.mistakes),
    source: input.source === 'mock' ? 'mock' : 'manual',
  }
  const recall = sanitizeRecall(input.recall)
  if (recall) attempt.recall = recall
  return attempt
}

function clearTimerFor(timer: TimerState | null, slugs: readonly string[]): TimerState | null {
  return timer && slugs.includes(timer.slug) ? null : timer
}

/** Append an attempt. If the solve timer is on this problem, it is cleared. */
export function logAttempt(
  data: AppData,
  slug: string,
  input: AttemptInput,
  today: ISODate,
  now: number,
): AppData {
  if (!getProblem(slug) || !isRating(input.rating)) return data
  return touch(data, now, {
    problems: appendAttempt(data.problems, slug, buildAttempt(input, today, now)),
    timer: clearTimerFor(data.timer, [slug]),
  })
}

function sameAttempt(a: Attempt, b: Attempt): boolean {
  return (
    a.date === b.date &&
    a.rating === b.rating &&
    a.minutes === b.minutes &&
    a.recall === b.recall &&
    a.mistakes.length === b.mistakes.length &&
    a.mistakes.every((tag, i) => tag === b.mistakes[i])
  )
}

export function updateAttempt(
  data: AppData,
  slug: string,
  attemptId: string,
  patch: AttemptPatch,
  today: ISODate,
  now: number,
): AppData {
  const record = recordOf(data.problems, slug)
  const current = record?.attempts.find((a) => a.id === attemptId)
  if (!record || !current) return data

  const next: Attempt = { ...current }
  if (patch.date !== undefined) next.date = sanitizeDate(patch.date, today)
  if (isRating(patch.rating)) next.rating = patch.rating
  if (patch.minutes !== undefined) next.minutes = sanitizeMinutes(patch.minutes)
  if (patch.mistakes !== undefined) next.mistakes = sanitizeMistakes(patch.mistakes)
  if (patch.recall !== undefined) {
    const recall = sanitizeRecall(patch.recall)
    if (recall) next.recall = recall
    else delete next.recall
  }
  if (sameAttempt(current, next)) return data

  const attempts = record.attempts.map((a) => (a.id === attemptId ? next : a))
  return touch(data, now, { problems: putRecord(data.problems, slug, { ...record, attempts }) })
}

export function deleteAttempt(data: AppData, slug: string, attemptId: string, now: number): AppData {
  const record = recordOf(data.problems, slug)
  if (!record || !record.attempts.some((a) => a.id === attemptId)) return data
  const attempts = record.attempts.filter((a) => a.id !== attemptId)
  return touch(data, now, { problems: putRecord(data.problems, slug, { ...record, attempts }) })
}

/** Remove every attempt for the problem (it becomes "to do" again). Notes are kept. */
export function markUnsolved(data: AppData, slug: string, now: number): AppData {
  const record = recordOf(data.problems, slug)
  if (!record || record.attempts.length === 0) return data
  return touch(data, now, { problems: putRecord(data.problems, slug, { ...record, attempts: [] }) })
}

/** Merge into the problem's notes. A record with no attempts and blank notes is dropped. */
export function setNotes(
  data: AppData,
  slug: string,
  patch: Partial<Omit<Notes, 'updatedAt'>>,
  now: number,
): AppData {
  if (!getProblem(slug)) return data
  const existing = recordOf(data.problems, slug)
  const record = existing ?? { attempts: [], notes: { ...EMPTY_NOTES } }
  const text = (given: unknown, kept: string) => (typeof given === 'string' ? given : kept)
  const notes: Notes = {
    insight: text(patch.insight, record.notes.insight),
    time: text(patch.time, record.notes.time),
    space: text(patch.space, record.notes.space),
    pitfalls: text(patch.pitfalls, record.notes.pitfalls),
    updatedAt: now,
  }
  const changed =
    notes.insight !== record.notes.insight ||
    notes.time !== record.notes.time ||
    notes.space !== record.notes.space ||
    notes.pitfalls !== record.notes.pitfalls
  if (!changed) return data
  const problems = putRecord(data.problems, slug, { ...record, notes })
  // Blank text for a problem with no record leaves the document as it was.
  if (!existing && !Object.hasOwn(problems, slug)) return data
  return touch(data, now, { problems })
}

// --- settings ----------------------------------------------------------------------------------

function sameSettings(a: Settings, b: Settings): boolean {
  return (
    a.startDate === b.startDate &&
    a.targetDate === b.targetDate &&
    a.dailyReviewCap === b.dailyReviewCap &&
    a.mockMinutes === b.mockMinutes &&
    a.sessionMinutes === b.sessionMinutes &&
    DIFFICULTIES.every((d) => a.targets[d] === b.targets[d])
  )
}

/**
 * Merge and sanitise: numbers are rounded and clamped to SETTINGS_LIMITS, dates must be valid,
 * and targetDate is kept at least one day after startDate. Invalid fields are ignored.
 */
export function updateSettings(
  data: AppData,
  patch: Partial<Omit<Settings, 'targets'>> & { targets?: Partial<Record<Difficulty, number>> },
  now: number,
): AppData {
  const current = data.settings
  const startDate = isISODate(patch.startDate) ? patch.startDate : current.startDate
  const targetDate = isISODate(patch.targetDate) ? patch.targetDate : current.targetDate
  const earliestTarget = addDays(startDate, 1)

  const targets = { ...current.targets }
  for (const difficulty of DIFFICULTIES) {
    targets[difficulty] = clampSetting(patch.targets?.[difficulty], SETTINGS_LIMITS.target) ?? targets[difficulty]
  }

  const settings: Settings = {
    startDate,
    targetDate: targetDate < earliestTarget ? earliestTarget : targetDate,
    dailyReviewCap:
      clampSetting(patch.dailyReviewCap, SETTINGS_LIMITS.dailyReviewCap) ?? current.dailyReviewCap,
    targets,
    mockMinutes: clampSetting(patch.mockMinutes, SETTINGS_LIMITS.mockMinutes) ?? current.mockMinutes,
    sessionMinutes:
      clampSetting(patch.sessionMinutes, SETTINGS_LIMITS.sessionMinutes) ?? current.sessionMinutes,
  }
  if (sameSettings(current, settings)) return data
  return touch(data, now, { settings })
}

// --- drill -------------------------------------------------------------------------------------

export function recordDrill(
  data: AppData,
  result: Omit<DrillResult, 'at' | 'date'>,
  today: ISODate,
  now: number,
): AppData {
  if (!getProblem(result.slug) || !isPatternId(result.answer) || !isPatternId(result.picked)) return data
  const ms = Number.isFinite(result.ms) ? Math.max(0, Math.round(result.ms)) : 0
  const drill: DrillResult = {
    at: now,
    date: today,
    slug: result.slug,
    answer: result.answer,
    picked: result.picked,
    correct: result.correct === true,
    ms,
  }
  return touch(data, now, foldDrills([...data.drills, drill], data.drillArchive))
}

/**
 * Keep the newest DRILL_KEEP results as they are and fold the older ones into per-topic,
 * per-pattern, per-pick tallies. Returns the changes to put on the document: `drills`, and
 * `drillArchive` only when there is one. Under the cap it changes nothing.
 */
export function foldDrills(
  drills: DrillResult[],
  archive: readonly DrillBucket[] | undefined,
): Pick<AppData, 'drills' | 'drillArchive'> {
  const excess = drills.length - DRILL_KEEP
  if (excess <= 0) return archive && archive.length > 0 ? { drills, drillArchive: [...archive] } : { drills }
  const buckets = new Map<string, DrillBucket>()
  const add = (bucket: DrillBucket) => {
    const key = `${bucket.topic}|${bucket.answer}|${bucket.picked}|${bucket.correct}`
    const known = buckets.get(key)
    if (known) known.count += bucket.count
    else buckets.set(key, { ...bucket })
  }
  for (const bucket of archive ?? []) add(bucket)
  for (const d of drills.slice(0, excess)) {
    // The topic a card counted toward: its problem's, else its pattern's home topic.
    const topic = getProblem(d.slug)?.topic ?? PATTERN_BY_ID[d.answer]?.topic
    if (topic) add({ topic, answer: d.answer, picked: d.picked, correct: d.correct, count: 1 })
  }
  return { drills: drills.slice(excess), drillArchive: [...buckets.values()] }
}

// --- solve timer -------------------------------------------------------------------------------

/** Total elapsed ms for a timer at `now`, running or paused. 0 for null. */
export function timerElapsed(timer: TimerState | null, now: number): number {
  if (!timer) return 0
  return timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince))
}

/**
 * Start or resume the timer on `slug`. If the timer was on a different problem it is replaced
 * (its time is discarded).
 */
export function startTimer(data: AppData, slug: string, now: number): AppData {
  if (!getProblem(slug)) return data
  const { timer } = data
  if (timer?.slug === slug) {
    if (timer.runningSince !== null) return data
    return touch(data, now, { timer: { ...timer, runningSince: now } })
  }
  return touch(data, now, { timer: { slug, runningSince: now, elapsedMs: 0 } })
}

/** Pause the running timer, banking its time. */
export function pauseTimer(data: AppData, now: number): AppData {
  const { timer } = data
  if (!timer || timer.runningSince === null) return data
  return touch(data, now, { timer: { slug: timer.slug, runningSince: null, elapsedMs: timerElapsed(timer, now) } })
}

/** Back to 00:00, paused, same problem. */
export function resetTimer(data: AppData, now: number): AppData {
  const { timer } = data
  if (!timer || (timer.runningSince === null && timer.elapsedMs === 0)) return data
  return touch(data, now, { timer: { slug: timer.slug, runningSince: null, elapsedMs: 0 } })
}

/** Remove the timer entirely. */
export function clearTimer(data: AppData, now: number): AppData {
  if (!data.timer) return data
  return touch(data, now, { timer: null })
}

// --- mock interviews ---------------------------------------------------------------------------

const isActive = (mock: MockSession) => mock.status === 'running' || mock.status === 'review'

/** Begin a mock. Any mock still running or awaiting ratings is marked abandoned first. */
export function startMock(data: AppData, config: MockConfig, slugs: string[], now: number): AppData {
  const known = [...new Set(slugs.filter((slug) => getProblem(slug)))]
  if (known.length === 0) return data
  const mock: MockSession = {
    id: makeId(),
    startedAt: now,
    config: {
      mix: isMockMix(config.mix) ? config.mix : 'any',
      pool: isMockPool(config.pool) ? config.pool : 'any',
      topics: sanitizeTopics(config.topics),
      minutes: clampSetting(config.minutes, SETTINGS_LIMITS.mockMinutes) ?? DEFAULT_MOCK_MINUTES,
    },
    slugs: known,
    status: 'running',
    endedAt: null,
    marks: {},
    results: {},
  }
  return touch(data, now, { mocks: [...abandonActive(data.mocks, now), mock] })
}

function abandonActive(mocks: MockSession[], now: number): MockSession[] {
  return mocks.map((m) => (isActive(m) ? { ...m, status: 'abandoned', endedAt: m.endedAt ?? now } : m))
}

function replaceMock(data: AppData, index: number, mock: MockSession, now: number): AppData {
  return touch(data, now, { mocks: data.mocks.map((m, i) => (i === index ? mock : m)) })
}

/** Toggle "finished" on one problem of the running mock, recording the elapsed ms. */
export function markMockProblem(data: AppData, slug: string, now: number): AppData {
  const index = data.mocks.findLastIndex((m) => m.status === 'running')
  const mock = data.mocks[index]
  if (!mock || !mock.slugs.includes(slug)) return data
  const marks = { ...mock.marks }
  if (Object.hasOwn(marks, slug)) delete marks[slug]
  else marks[slug] = Math.max(0, now - mock.startedAt)
  return replaceMock(data, index, { ...mock, marks }, now)
}

/** Stop the clock on the running mock (time up, or ended early): status becomes 'review'. */
export function endMock(data: AppData, now: number): AppData {
  const index = data.mocks.findLastIndex((m) => m.status === 'running')
  const mock = data.mocks[index]
  if (!mock) return data
  // A mock that ran out while the tab was closed ended when its clock did, not when the person came back.
  const endedAt = Math.min(now, mock.startedAt + mock.config.minutes * 60_000)
  return replaceMock(data, index, { ...mock, status: 'review', endedAt }, now)
}

/**
 * Save the ratings for the mock awaiting review and mark it done. Every problem whose outcome
 * is a Rating is also logged as an ordinary attempt (source 'mock', dated today); 'unfinished'
 * logs nothing.
 */
export function rateMock(
  data: AppData,
  results: Record<string, MockResult>,
  today: ISODate,
  now: number,
): AppData {
  const index = data.mocks.findLastIndex((m) => m.status === 'review')
  const mock = data.mocks[index]
  if (!mock) return data

  const saved: Record<string, MockResult> = {}
  let problems = data.problems
  for (const slug of mock.slugs) {
    const given = Object.hasOwn(results, slug) ? results[slug] : undefined
    if (!given || !isOutcome(given.outcome)) continue
    const result: MockResult = {
      outcome: given.outcome,
      minutes: sanitizeMinutes(given.minutes),
      mistakes: sanitizeMistakes(given.mistakes),
    }
    saved[slug] = result
    if (result.outcome !== 'unfinished') {
      const attempt = buildAttempt(
        { rating: result.outcome, minutes: result.minutes, mistakes: result.mistakes, source: 'mock' },
        today,
        now,
      )
      problems = appendAttempt(problems, slug, attempt)
    }
  }

  const mocks = data.mocks.map((m, i) => (i === index ? { ...mock, status: 'done' as const, results: saved } : m))
  return touch(data, now, { mocks, problems, timer: clearTimerFor(data.timer, mock.slugs) })
}

export function abandonMock(data: AppData, now: number): AppData {
  if (!data.mocks.some(isActive)) return data
  return touch(data, now, { mocks: abandonActive(data.mocks, now) })
}

// --- session and flags -------------------------------------------------------------------------

export function setSession(data: AppData, plan: SessionPlan | null, now: number): AppData {
  if (plan === data.session) return data
  return touch(data, now, { session: plan })
}

export function setOnboarded(data: AppData, onboarded: boolean, now: number): AppData {
  if (data.onboarded === onboarded) return data
  return touch(data, now, { onboarded })
}
