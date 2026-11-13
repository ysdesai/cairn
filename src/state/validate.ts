/**
 * Reading a document that came from outside the running app: storage on load, or an imported
 * file. Tolerant by design: a hand-edited or slightly damaged export should still load.
 *
 * parseAppData
 *   - rejects anything that is not an object with app === 'cairn' and a numeric version
 *     (a clear error message says what is wrong);
 *   - rejects versions newer than SCHEMA_VERSION ("made by a newer version of Cairn");
 *   - migrates older versions forward (none exist yet; keep the switch in place);
 *   - then sanitises field by field: unknown problem slugs, malformed attempts, unknown ratings,
 *     mistake tags or pattern ids, and invalid dates are dropped and counted in `warnings`;
 *     settings are filled from defaults and clamped; a running mock or timer for an unknown
 *     slug is discarded. Every repair is counted, so the import preview is the owner's one chance to
 *     notice a damaged file: a record whose attempts are not a list counts as a damaged record, and
 *     notes that are not an object as damaged notes.
 *   - folds drill results beyond the newest DRILL_KEEP into `drillArchive` (see schema.ts).
 *   - a missing `onboarded` flag reads as true when the file holds any history (a restored backup is
 *     never a first run) and false for an empty document; an explicit value is kept.
 * The result is always a complete, internally consistent AppData.
 */
import { getProblem } from '../data'
import type { Difficulty } from '../data/types'
import { addDays, isISODate } from '../domain/dates'
import {
  clampSetting,
  createEmptyData,
  foldDrills,
  isBlankNotes,
  isMockMix,
  isMockPool,
  isOutcome,
  isPatternId,
  isRating,
  sanitizeMinutes,
  sanitizeMistakes,
  sanitizeRecall,
  sanitizeTopics,
  SETTINGS_LIMITS,
} from './reducers'
import { APP_ID, DEFAULT_PLAN_DAYS, EMPTY_NOTES, SCHEMA_VERSION } from './schema'
import { TOPIC_BY_ID } from '../data'
import type {
  AppData,
  Attempt,
  DrillBucket,
  DrillResult,
  ISODate,
  MockConfig,
  MockResult,
  MockSession,
  Notes,
  ProblemRecord,
  SessionItem,
  SessionItemKind,
  SessionPlan,
  Settings,
  TimerState,
} from './schema'

export type ParseResult = { ok: true; data: AppData; warnings: string[] } | { ok: false; error: string }

type Obj = Record<string, unknown>

const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isText = (value: unknown): value is string => typeof value === 'string'

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const MOCK_STATUSES: readonly MockSession['status'][] = ['running', 'review', 'done', 'abandoned']
const SESSION_KINDS: readonly SessionItemKind[] = ['review', 'new', 'drill']

// --- warnings ----------------------------------------------------------------------------------

const plural = (n: number, noun: string, many = `${noun}s`) => `${n} ${n === 1 ? noun : many}`

const WARNINGS = {
  unknownProblems: (n: number) => `Dropped ${plural(n, 'record')} for unknown problems.`,
  badRecords: (n: number) => `Dropped ${plural(n, 'damaged problem record')}.`,
  badNotes: (n: number) => `Dropped ${plural(n, 'damaged set')} of notes.`,
  badAttempts: (n: number) => `Dropped ${plural(n, 'malformed attempt')}.`,
  badDates: (n: number) => `Dropped ${plural(n, 'attempt')} with invalid dates.`,
  futureDates: (n: number) => `Moved ${plural(n, 'entry', 'entries')} dated in the future to today.`,
  badRatings: (n: number) => `Dropped ${plural(n, 'attempt')} with unknown ratings.`,
  badMistakes: (n: number) => `Dropped ${plural(n, 'unknown or repeated mistake tag')}.`,
  badDrills: (n: number) => `Dropped ${plural(n, 'damaged drill result')}.`,
  badMocks: (n: number) => `Dropped ${plural(n, 'damaged mock interview')}.`,
  badSessionItems: (n: number) => `Dropped ${plural(n, 'damaged item')} from the session plan.`,
  settings: (n: number) =>
    `Repaired ${n} ${n === 1 ? 'setting that was' : 'settings that were'} missing or out of range.`,
  timer: () => 'Dropped the solve timer because it was damaged or pointed at an unknown problem.',
  session: () => 'Dropped the session plan because it was damaged.',
} satisfies Record<string, (n: number) => string>

type Tally = { [K in keyof typeof WARNINGS]: number } & { resetSections: string[] }

function newTally(): Tally {
  return {
    unknownProblems: 0,
    badRecords: 0,
    badNotes: 0,
    badAttempts: 0,
    badDates: 0,
    futureDates: 0,
    badRatings: 0,
    badMistakes: 0,
    badDrills: 0,
    badMocks: 0,
    badSessionItems: 0,
    settings: 0,
    timer: 0,
    session: 0,
    resetSections: [],
  }
}

function warningsFrom(tally: Tally): string[] {
  const out: string[] = []
  if (tally.resetSections.length) {
    out.push(`Some sections were missing or unreadable and start empty: ${tally.resetSections.join(', ')}.`)
  }
  for (const key of Object.keys(WARNINGS) as (keyof typeof WARNINGS)[]) {
    if (tally[key] > 0) out.push(WARNINGS[key](tally[key]))
  }
  return out
}

// --- the entry point ---------------------------------------------------------------------------

export function parseAppData(raw: unknown, today: ISODate, now: number): ParseResult {
  if (!isObject(raw)) {
    return { ok: false, error: 'This is not a Cairn backup: the file does not hold a JSON object.' }
  }
  if (raw.app !== APP_ID) {
    return { ok: false, error: 'This is not a Cairn backup: it was not made by this app.' }
  }
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'This Cairn backup has no valid version number, so it cannot be read.' }
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This backup was made by a newer version of Cairn (data version ${version}). Update Cairn, then try again.`,
    }
  }

  const tally = newTally()
  const data = sanitize(migrate(raw, version), today, now, tally)
  return { ok: true, data, warnings: warningsFrom(tally) }
}

/** Bring an older document up to SCHEMA_VERSION. */
function migrate(doc: Obj, version: number): Obj {
  switch (version) {
    // Each older version gets a case that upgrades it one step, falling through to the next.
    default:
      return doc
  }
}

function sanitize(doc: Obj, today: ISODate, now: number, tally: Tally): AppData {
  const updatedAt = isNumber(doc.updatedAt) ? doc.updatedAt : null
  const createdAt = isNumber(doc.createdAt) ? doc.createdAt : (updatedAt ?? now)
  const problems = parseProblems(doc.problems, today, tally)
  // Only the newest DRILL_KEEP results are kept one by one; a longer list (an old export) is folded.
  const drills = foldDrills(parseDrills(doc.drills, today, tally), parseDrillArchive(doc.drillArchive, tally))
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    settings: parseSettings(doc.settings, today, tally),
    problems,
    ...drills,
    mocks: parseMocks(doc.mocks, now, tally),
    timer: parseTimer(doc.timer, tally),
    session: parseSession(doc.session, tally),
    demo: doc.demo === true,
    // A backup that lost its flag is not a first run: with history in it the welcome must not
    // reopen over the restored data. Only an explicit false (or an empty document) is a first run.
    onboarded:
      doc.onboarded === true ||
      (doc.onboarded === undefined && (Object.keys(problems).length > 0 || drills.drills.length > 0)),
  }
}

// --- settings ----------------------------------------------------------------------------------

function parseSettings(raw: unknown, today: ISODate, tally: Tally): Settings {
  const defaults = createEmptyData(today, 0).settings
  if (!isObject(raw)) {
    tally.resetSections.push('settings')
    return defaults
  }
  let repaired = 0
  const pick = <T>(given: unknown, value: T | null, fallback: T): T => {
    if (value === null) {
      repaired++
      return fallback
    }
    if (value !== given) repaired++
    return value
  }
  const number = (given: unknown, limit: { min: number; max: number }, fallback: number) =>
    pick(given, clampSetting(given, limit), fallback)

  const startDate = pick(raw.startDate, isISODate(raw.startDate) ? raw.startDate : null, defaults.startDate)
  const earliestTarget = addDays(startDate, 1)
  const fallbackTarget = addDays(startDate, DEFAULT_PLAN_DAYS - 1)
  let targetDate = pick(raw.targetDate, isISODate(raw.targetDate) ? raw.targetDate : null, fallbackTarget)
  if (targetDate < earliestTarget) {
    targetDate = earliestTarget
    repaired++
  }

  const rawTargets = isObject(raw.targets) ? raw.targets : {}
  const targets = { ...defaults.targets }
  for (const difficulty of DIFFICULTIES) {
    targets[difficulty] = number(rawTargets[difficulty], SETTINGS_LIMITS.target, defaults.targets[difficulty])
  }

  const dailyReviewCap = number(raw.dailyReviewCap, SETTINGS_LIMITS.dailyReviewCap, defaults.dailyReviewCap)
  const mockMinutes = number(raw.mockMinutes, SETTINGS_LIMITS.mockMinutes, defaults.mockMinutes)
  const sessionMinutes = number(raw.sessionMinutes, SETTINGS_LIMITS.sessionMinutes, defaults.sessionMinutes)
  tally.settings += repaired
  return { startDate, targetDate, dailyReviewCap, targets, mockMinutes, sessionMinutes }
}

// --- problems and attempts ---------------------------------------------------------------------

function parseProblems(raw: unknown, today: ISODate, tally: Tally): AppData['problems'] {
  const out: AppData['problems'] = {}
  if (!isObject(raw)) {
    tally.resetSections.push('problems')
    return out
  }
  for (const [slug, value] of Object.entries(raw)) {
    if (!getProblem(slug)) {
      tally.unknownProblems++
      continue
    }
    if (!isObject(value)) {
      tally.badRecords++
      continue
    }
    // Attempts or notes of the wrong shape are damage, and the preview must say so.
    if (value.attempts !== undefined && !Array.isArray(value.attempts)) tally.badRecords++
    if (value.notes !== undefined && !isObject(value.notes)) tally.badNotes++
    const record: ProblemRecord = {
      attempts: parseAttempts(value.attempts, today, tally),
      notes: parseNotes(value.notes),
    }
    if (record.attempts.length > 0 || !isBlankNotes(record.notes)) out[slug] = record
  }
  return out
}

function parseNotes(raw: unknown): Notes {
  if (!isObject(raw)) return { ...EMPTY_NOTES }
  return {
    insight: isText(raw.insight) ? raw.insight : '',
    time: isText(raw.time) ? raw.time : '',
    space: isText(raw.space) ? raw.space : '',
    pitfalls: isText(raw.pitfalls) ? raw.pitfalls : '',
    updatedAt: isNumber(raw.updatedAt) ? raw.updatedAt : null,
  }
}

function parseAttempts(raw: unknown, today: ISODate, tally: Tally): Attempt[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Attempt[] = []
  for (const item of raw) {
    const attempt = parseAttempt(item, today, tally)
    if (!attempt) continue
    // A repeated id would make edits and deletes ambiguous.
    if (seen.has(attempt.id)) {
      tally.badAttempts++
      continue
    }
    seen.add(attempt.id)
    out.push(attempt)
  }
  return out
}

function parseAttempt(raw: unknown, today: ISODate, tally: Tally): Attempt | null {
  if (!isObject(raw) || !isText(raw.id) || raw.id === '' || !isNumber(raw.at)) {
    tally.badAttempts++
    return null
  }
  if (!isISODate(raw.date)) {
    tally.badDates++
    return null
  }
  if (!isRating(raw.rating)) {
    tally.badRatings++
    return null
  }
  const mistakes = sanitizeMistakes(raw.mistakes)
  if (Array.isArray(raw.mistakes)) tally.badMistakes += raw.mistakes.length - mistakes.length

  const attempt: Attempt = {
    id: raw.id,
    date: clampToToday(raw.date, today, tally),
    at: raw.at,
    rating: raw.rating,
    minutes: sanitizeMinutes(raw.minutes),
    mistakes,
    source: raw.source === 'mock' ? 'mock' : 'manual',
  }
  const recall = sanitizeRecall(raw.recall)
  if (recall) attempt.recall = recall
  return attempt
}

/** A date after today would count toward streaks and plans that have not happened yet. */
function clampToToday(date: ISODate, today: ISODate, tally: Tally): ISODate {
  if (date <= today) return date
  tally.futureDates++
  return today
}

// --- drills ------------------------------------------------------------------------------------

function parseDrills(raw: unknown, today: ISODate, tally: Tally): DrillResult[] {
  if (!Array.isArray(raw)) {
    tally.resetSections.push('drills')
    return []
  }
  const out: DrillResult[] = []
  for (const item of raw) {
    if (
      !isObject(item) ||
      !isNumber(item.at) ||
      !isISODate(item.date) ||
      !isText(item.slug) ||
      !getProblem(item.slug) ||
      !isPatternId(item.answer) ||
      !isPatternId(item.picked) ||
      typeof item.correct !== 'boolean' ||
      !isNumber(item.ms) ||
      item.ms < 0
    ) {
      tally.badDrills++
      continue
    }
    out.push({
      at: item.at,
      date: clampToToday(item.date, today, tally),
      slug: item.slug,
      answer: item.answer,
      picked: item.picked,
      correct: item.correct,
      ms: item.ms,
    })
  }
  return out
}

function parseDrillArchive(raw: unknown, tally: Tally): DrillBucket[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    tally.badDrills++
    return []
  }
  const out: DrillBucket[] = []
  for (const item of raw) {
    if (
      !isObject(item) ||
      !isText(item.topic) ||
      !Object.hasOwn(TOPIC_BY_ID, item.topic) ||
      !isPatternId(item.answer) ||
      !isPatternId(item.picked) ||
      typeof item.correct !== 'boolean' ||
      !isNumber(item.count) ||
      !Number.isInteger(item.count) ||
      item.count < 1
    ) {
      tally.badDrills++
      continue
    }
    out.push({
      topic: item.topic as DrillBucket['topic'],
      answer: item.answer,
      picked: item.picked,
      correct: item.correct,
      count: item.count,
    })
  }
  return out
}

// --- mocks -------------------------------------------------------------------------------------

function parseMocks(raw: unknown, now: number, tally: Tally): MockSession[] {
  if (!Array.isArray(raw)) {
    tally.resetSections.push('mocks')
    return []
  }
  const mocks: MockSession[] = []
  for (const item of raw) {
    const mock = parseMock(item, now)
    if (mock) mocks.push(mock)
    else tally.badMocks++
  }
  // Starting a mock abandons the live one, so only the last mock can still be live.
  return mocks.map((m, i) =>
    i < mocks.length - 1 && (m.status === 'running' || m.status === 'review')
      ? { ...m, status: 'abandoned', endedAt: m.endedAt ?? now }
      : m,
  )
}

function parseMock(raw: unknown, now: number): MockSession | null {
  if (!isObject(raw) || !isText(raw.id) || raw.id === '' || !isNumber(raw.startedAt)) return null
  if (!MOCK_STATUSES.includes(raw.status as MockSession['status'])) return null
  const config = parseMockConfig(raw.config)
  if (!config) return null

  const slugs = raw.slugs
  if (!Array.isArray(slugs) || slugs.length === 0) return null
  if (!slugs.every((slug) => isText(slug) && getProblem(slug)) || new Set(slugs).size !== slugs.length) {
    return null
  }
  const members = new Set<string>(slugs)

  const marks: Record<string, number> = {}
  if (isObject(raw.marks)) {
    for (const [slug, ms] of Object.entries(raw.marks)) {
      if (members.has(slug) && isNumber(ms) && ms >= 0) marks[slug] = ms
    }
  }
  const results: Record<string, MockResult> = {}
  if (isObject(raw.results)) {
    for (const [slug, value] of Object.entries(raw.results)) {
      if (!members.has(slug) || !isObject(value) || !isOutcome(value.outcome)) continue
      results[slug] = {
        outcome: value.outcome,
        minutes: sanitizeMinutes(value.minutes),
        mistakes: sanitizeMistakes(value.mistakes),
      }
    }
  }
  return {
    id: raw.id,
    startedAt: raw.startedAt,
    config,
    slugs: slugs as string[],
    status: raw.status as MockSession['status'],
    // The clock is live only while running; every other state has stopped it.
    endedAt: raw.status === 'running' ? null : isNumber(raw.endedAt) ? raw.endedAt : now,
    marks,
    results,
  }
}

function parseMockConfig(raw: unknown): MockConfig | null {
  if (!isObject(raw)) return null
  if (!isMockMix(raw.mix) || !isMockPool(raw.pool)) return null
  const minutes = clampSetting(raw.minutes, SETTINGS_LIMITS.mockMinutes)
  if (minutes === null) return null
  return {
    mix: raw.mix,
    pool: raw.pool,
    topics: sanitizeTopics(raw.topics),
    minutes,
  }
}

// --- timer and session -------------------------------------------------------------------------

function parseTimer(raw: unknown, tally: Tally): TimerState | null {
  if (raw === null || raw === undefined) return null
  if (
    !isObject(raw) ||
    !isText(raw.slug) ||
    !getProblem(raw.slug) ||
    !isNumber(raw.elapsedMs) ||
    raw.elapsedMs < 0 ||
    (raw.runningSince !== null && !isNumber(raw.runningSince))
  ) {
    tally.timer++
    return null
  }
  return { slug: raw.slug, runningSince: raw.runningSince, elapsedMs: raw.elapsedMs }
}

function parseSession(raw: unknown, tally: Tally): SessionPlan | null {
  if (raw === null || raw === undefined) return null
  if (
    !isObject(raw) ||
    !isISODate(raw.date) ||
    !isNumber(raw.budget) ||
    raw.budget < 0 ||
    !isNumber(raw.createdAt) ||
    !Array.isArray(raw.items)
  ) {
    tally.session++
    return null
  }
  const items: SessionItem[] = []
  for (const item of raw.items) {
    const parsed = parseSessionItem(item)
    if (parsed) items.push(parsed)
    else tally.badSessionItems++
  }
  return { date: raw.date, budget: raw.budget, items, createdAt: raw.createdAt }
}

function parseSessionItem(raw: unknown): SessionItem | null {
  if (!isObject(raw) || !SESSION_KINDS.includes(raw.kind as SessionItemKind)) return null
  if (!isNumber(raw.minutes) || raw.minutes < 0 || !isText(raw.reason)) return null
  const kind = raw.kind as SessionItemKind
  const item: SessionItem = { kind, minutes: raw.minutes, reason: raw.reason }
  if (raw.slug !== undefined) {
    if (!isText(raw.slug) || !getProblem(raw.slug)) return null
    item.slug = raw.slug
  } else if (kind !== 'drill') {
    return null
  }
  return item
}

// --- summary -----------------------------------------------------------------------------------

export interface DataSummary {
  solved: number
  attempts: number
  notes: number
  drills: number
  mocks: number
  firstDate: ISODate | null
  lastDate: ISODate | null
}

/** A few numbers describing a document, for the import confirmation and the settings screen. */
export function summarize(data: AppData): DataSummary {
  let solved = 0
  let attempts = 0
  let notes = 0
  let firstDate: ISODate | null = null
  let lastDate: ISODate | null = null
  for (const record of Object.values(data.problems)) {
    if (record.attempts.length > 0) solved++
    if (!isBlankNotes(record.notes)) notes++
    attempts += record.attempts.length
    for (const { date } of record.attempts) {
      if (firstDate === null || date < firstDate) firstDate = date
      if (lastDate === null || date > lastDate) lastDate = date
    }
  }
  return {
    solved,
    attempts,
    notes,
    drills: data.drills.length + (data.drillArchive ?? []).reduce((n, b) => n + b.count, 0),
    mocks: data.mocks.filter((m) => m.status === 'done').length,
    firstDate,
    lastDate,
  }
}
