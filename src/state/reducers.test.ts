import { afterEach, describe, expect, it, vi } from 'vitest'
import { diffDays } from '../domain/dates'
import {
  abandonMock,
  clearTimer,
  createEmptyData,
  deleteAttempt,
  endMock,
  logAttempt,
  makeId,
  markMockProblem,
  markUnsolved,
  pauseTimer,
  rateMock,
  recordDrill,
  resetTimer,
  setNotes,
  setOnboarded,
  setSession,
  startMock,
  startTimer,
  timerElapsed,
  updateAttempt,
  updateSettings,
} from './reducers'
import type { AttemptInput } from './reducers'
import { DEFAULT_PLAN_DAYS, SCHEMA_VERSION } from './schema'
import type { AppData, MockConfig, MockResult, SessionPlan } from './schema'

const TODAY = '2026-11-12'
const T0 = Date.UTC(2026, 10, 12, 15, 0, 0)
const TWO_SUM = 'two-sum'
const ANAGRAM = 'valid-anagram'
const DUPLICATE = 'contains-duplicate'

/** Freezing every document proves no reducer mutates what it was given. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const empty = () => deepFreeze(createEmptyData(TODAY, T0))
const frozen = (data: AppData) => deepFreeze(data)

function log(data: AppData, slug: string, input: AttemptInput, now = T0 + 1): AppData {
  return frozen(logAttempt(data, slug, input, TODAY, now))
}

const attemptsOf = (data: AppData, slug: string) => data.problems[slug]?.attempts ?? []

const MOCK_CONFIG: MockConfig = { mix: 'medium-medium', pool: 'any', topics: [], minutes: 45 }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('makeId', () => {
  it('is short, URL-safe and unique', () => {
    const ids = new Set(Array.from({ length: 2000 }, makeId))
    expect(ids.size).toBe(2000)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{6,20}$/)
  })

  it('keeps a fixed-width random part when Math.random prints few digits', () => {
    vi.stubGlobal('crypto', undefined)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(makeId()).toMatch(/^[a-z0-9]+i00000$/)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(makeId()).toMatch(/^[a-z0-9]+000000$/)
  })

  it('falls back to Math.random when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = new Set(Array.from({ length: 500 }, makeId))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{6,20}$/)
  })
})

describe('createEmptyData', () => {
  it('builds a complete, empty document with a plan that is exactly twelve weeks inclusive', () => {
    const data = createEmptyData(TODAY, T0)
    expect(data.app).toBe('cairn')
    expect(data.version).toBe(SCHEMA_VERSION)
    expect(data.createdAt).toBe(T0)
    expect(data.updatedAt).toBe(T0)
    expect(data.settings.startDate).toBe(TODAY)
    expect(diffDays(data.settings.startDate, data.settings.targetDate) + 1).toBe(DEFAULT_PLAN_DAYS)
    expect(data.settings.targets).toEqual({ easy: 15, medium: 25, hard: 40 })
    expect(data.settings.dailyReviewCap).toBe(5)
    expect(data.settings.mockMinutes).toBe(45)
    expect(data.settings.sessionMinutes).toBe(60)
    expect(data.problems).toEqual({})
    expect(data.drills).toEqual([])
    expect(data.mocks).toEqual([])
    expect(data.timer).toBeNull()
    expect(data.session).toBeNull()
    expect(data.demo).toBe(false)
    expect(data.onboarded).toBe(false)
  })

  it('does not share its target table between documents', () => {
    const a = createEmptyData(TODAY, T0)
    a.settings.targets.easy = 99
    expect(createEmptyData(TODAY, T0).settings.targets.easy).toBe(15)
  })
})

describe('logAttempt', () => {
  it('appends an attempt with defaults and stamps updatedAt', () => {
    const start = empty()
    const next = log(start, TWO_SUM, { rating: 'easy' }, T0 + 5)
    expect(next).not.toBe(start)
    expect(next.updatedAt).toBe(T0 + 5)
    const [attempt] = attemptsOf(next, TWO_SUM)
    expect(attempt).toMatchObject({
      date: TODAY,
      at: T0 + 5,
      rating: 'easy',
      minutes: null,
      mistakes: [],
      source: 'manual',
    })
    expect(attempt.id).toBeTruthy()
    expect('recall' in attempt).toBe(false)
    expect(next.problems[TWO_SUM].notes.insight).toBe('')
  })

  it('returns the same object for an unknown slug', () => {
    const start = empty()
    expect(logAttempt(start, 'not-a-problem', { rating: 'easy' }, TODAY, T0 + 1)).toBe(start)
    expect(logAttempt(start, 'constructor', { rating: 'easy' }, TODAY, T0 + 1)).toBe(start)
  })

  it('returns the same object for a rating that does not exist', () => {
    const start = empty()
    expect(logAttempt(start, TWO_SUM, { rating: 'great' as never }, TODAY, T0 + 1)).toBe(start)
    expect(logAttempt(start, TWO_SUM, { rating: undefined as never }, TODAY, T0 + 1)).toBe(start)
    expect(logAttempt(start, TWO_SUM, { rating: 'toString' as never }, TODAY, T0 + 1)).toBe(start)
  })

  it('keeps attempts in the order they were logged, with distinct ids', () => {
    let data = log(empty(), TWO_SUM, { rating: 'help' }, T0 + 1)
    data = log(data, TWO_SUM, { rating: 'easy' }, T0 + 2)
    const attempts = attemptsOf(data, TWO_SUM)
    expect(attempts.map((a) => a.rating)).toEqual(['help', 'easy'])
    expect(attempts[0].id).not.toBe(attempts[1].id)
  })

  it('keeps a backdated date and clamps a future date to today', () => {
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', date: '2026-11-01' }), TWO_SUM)[0].date).toBe(
      '2026-11-01',
    )
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', date: '2026-11-13' }), TWO_SUM)[0].date).toBe(TODAY)
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', date: '2030-01-01' }), TWO_SUM)[0].date).toBe(TODAY)
  })

  it('falls back to today for a malformed date', () => {
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', date: '2026-02-30' }), TWO_SUM)[0].date).toBe(TODAY)
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', date: 'soon' }), TWO_SUM)[0].date).toBe(TODAY)
  })

  it('rounds minutes and turns anything outside 1 to 600 into null', () => {
    const minutes = (value: number | null | undefined) =>
      attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', minutes: value }), TWO_SUM)[0].minutes
    expect(minutes(25.4)).toBe(25)
    expect(minutes(24.6)).toBe(25)
    expect(minutes(1)).toBe(1)
    expect(minutes(600)).toBe(600)
    expect(minutes(0)).toBeNull()
    expect(minutes(0.3)).toBeNull()
    expect(minutes(-5)).toBeNull()
    expect(minutes(601)).toBeNull()
    expect(minutes(Number.NaN)).toBeNull()
    expect(minutes(Number.POSITIVE_INFINITY)).toBeNull()
    expect(minutes(null)).toBeNull()
    expect(minutes(undefined)).toBeNull()
  })

  it('de-duplicates mistake tags and drops unknown ones', () => {
    const data = log(empty(), TWO_SUM, {
      rating: 'struggled',
      mistakes: ['bug', 'edge-case', 'bug', 'nonsense' as never, 'edge-case'],
    })
    expect(attemptsOf(data, TWO_SUM)[0].mistakes).toEqual(['bug', 'edge-case'])
  })

  it('trims recall and omits it when empty', () => {
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', recall: '  hash the complements \n' }), TWO_SUM)[0].recall).toBe(
      'hash the complements',
    )
    const blank = attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', recall: '   ' }), TWO_SUM)[0]
    expect('recall' in blank).toBe(false)
  })

  it('records the source, and treats an unknown one as manual', () => {
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', source: 'mock' }), TWO_SUM)[0].source).toBe('mock')
    expect(attemptsOf(log(empty(), TWO_SUM, { rating: 'easy', source: 'import' as never }), TWO_SUM)[0].source).toBe(
      'manual',
    )
  })

  it('ignores non-string recall and non-array mistakes', () => {
    const attempt = attemptsOf(
      log(empty(), TWO_SUM, { rating: 'easy', recall: 5 as never, mistakes: 'bug' as never, minutes: '9' as never }),
      TWO_SUM,
    )[0]
    expect('recall' in attempt).toBe(false)
    expect(attempt.mistakes).toEqual([])
    expect(attempt.minutes).toBeNull()
  })

  it('clears the solve timer when it is on this problem, and only then', () => {
    const timed = frozen(startTimer(empty(), TWO_SUM, T0))
    expect(log(timed, TWO_SUM, { rating: 'easy' }).timer).toBeNull()
    expect(log(timed, ANAGRAM, { rating: 'easy' }).timer).toEqual(timed.timer)
  })

  it('keeps existing notes when logging', () => {
    const noted = frozen(setNotes(empty(), TWO_SUM, { insight: 'complement map' }, T0 + 1))
    expect(log(noted, TWO_SUM, { rating: 'easy' }).problems[TWO_SUM].notes.insight).toBe('complement map')
  })
})

describe('updateAttempt', () => {
  const base = log(empty(), TWO_SUM, { rating: 'help', minutes: 30, mistakes: ['bug'], recall: 'something' })
  const id = attemptsOf(base, TWO_SUM)[0].id
  const update = (patch: Parameters<typeof updateAttempt>[3], now = T0 + 9) =>
    updateAttempt(base, TWO_SUM, id, patch, TODAY, now)

  it('applies the patched fields and leaves the rest', () => {
    const next = update({ rating: 'easy', minutes: 12 })
    expect(next.updatedAt).toBe(T0 + 9)
    expect(attemptsOf(next, TWO_SUM)[0]).toMatchObject({
      id,
      rating: 'easy',
      minutes: 12,
      mistakes: ['bug'],
      recall: 'something',
      source: 'manual',
    })
  })

  it('sanitises patched fields like logAttempt does', () => {
    const next = update({
      date: '2099-01-01',
      minutes: 9999,
      mistakes: ['misread', 'misread', 'zzz' as never],
      recall: '  new text  ',
    })
    expect(attemptsOf(next, TWO_SUM)[0]).toMatchObject({
      date: TODAY,
      minutes: null,
      mistakes: ['misread'],
      recall: 'new text',
    })
  })

  it('ignores a rating that does not exist', () => {
    expect(update({ rating: 'great' as never })).toBe(base)
    expect(attemptsOf(update({ rating: 'great' as never, minutes: 8 }), TWO_SUM)[0]).toMatchObject({
      rating: 'help',
      minutes: 8,
    })
  })

  it('backdates when the date is in the past', () => {
    expect(attemptsOf(update({ date: '2026-10-01' }), TWO_SUM)[0].date).toBe('2026-10-01')
  })

  it('can clear minutes and recall', () => {
    const next = update({ minutes: null, recall: ' ' })
    const attempt = attemptsOf(next, TWO_SUM)[0]
    expect(attempt.minutes).toBeNull()
    expect('recall' in attempt).toBe(false)
  })

  it('does not touch other attempts', () => {
    const two = log(base, TWO_SUM, { rating: 'easy' })
    const second = attemptsOf(two, TWO_SUM)[1]
    const next = updateAttempt(two, TWO_SUM, id, { rating: 'struggled' }, TODAY, T0 + 9)
    expect(attemptsOf(next, TWO_SUM)[1]).toBe(second)
  })

  it('returns the same object when nothing changes', () => {
    expect(update({})).toBe(base)
    expect(update({ rating: 'help', minutes: 30, mistakes: ['bug'] })).toBe(base)
    expect(update({ recall: ' something ' })).toBe(base)
    expect(update({ mistakes: ['bug', 'bug'] })).toBe(base)
  })

  it('returns the same object for an unknown problem or attempt', () => {
    expect(updateAttempt(base, ANAGRAM, id, { rating: 'easy' }, TODAY, T0 + 9)).toBe(base)
    expect(updateAttempt(base, TWO_SUM, 'nope', { rating: 'easy' }, TODAY, T0 + 9)).toBe(base)
    expect(updateAttempt(base, 'constructor', id, { rating: 'easy' }, TODAY, T0 + 9)).toBe(base)
  })
})

describe('deleteAttempt and markUnsolved', () => {
  const two = log(log(empty(), TWO_SUM, { rating: 'help' }, T0 + 1), TWO_SUM, { rating: 'easy' }, T0 + 2)
  const [first, second] = attemptsOf(two, TWO_SUM)

  it('removes one attempt', () => {
    const next = deleteAttempt(two, TWO_SUM, first.id, T0 + 3)
    expect(next.updatedAt).toBe(T0 + 3)
    expect(attemptsOf(next, TWO_SUM)).toEqual([second])
  })

  it('drops the record when the last attempt goes and the notes are blank', () => {
    const one = deleteAttempt(two, TWO_SUM, first.id, T0 + 3)
    const none = deleteAttempt(frozen(one), TWO_SUM, second.id, T0 + 4)
    expect(none.problems).toEqual({})
  })

  it('keeps the record when it still has notes', () => {
    const noted = frozen(setNotes(two, TWO_SUM, { pitfalls: 'duplicates' }, T0 + 3))
    const one = frozen(deleteAttempt(noted, TWO_SUM, first.id, T0 + 4))
    const none = deleteAttempt(one, TWO_SUM, second.id, T0 + 5)
    expect(none.problems[TWO_SUM].attempts).toEqual([])
    expect(none.problems[TWO_SUM].notes.pitfalls).toBe('duplicates')
  })

  it('is a no-op for unknown attempts and problems', () => {
    expect(deleteAttempt(two, TWO_SUM, 'nope', T0 + 3)).toBe(two)
    expect(deleteAttempt(two, ANAGRAM, first.id, T0 + 3)).toBe(two)
  })

  it('markUnsolved removes every attempt and keeps notes', () => {
    const noted = frozen(setNotes(two, TWO_SUM, { insight: 'map' }, T0 + 3))
    const next = markUnsolved(noted, TWO_SUM, T0 + 4)
    expect(next.updatedAt).toBe(T0 + 4)
    expect(next.problems[TWO_SUM].attempts).toEqual([])
    expect(next.problems[TWO_SUM].notes.insight).toBe('map')
  })

  it('markUnsolved drops a record that has nothing else', () => {
    expect(markUnsolved(two, TWO_SUM, T0 + 3).problems).toEqual({})
  })

  it('markUnsolved is a no-op when there is nothing to remove', () => {
    const start = empty()
    expect(markUnsolved(start, TWO_SUM, T0 + 3)).toBe(start)
    const notesOnly = frozen(setNotes(start, TWO_SUM, { insight: 'x' }, T0 + 1))
    expect(markUnsolved(notesOnly, TWO_SUM, T0 + 3)).toBe(notesOnly)
  })
})

describe('setNotes', () => {
  it('creates a record and stamps the notes', () => {
    const next = setNotes(empty(), TWO_SUM, { insight: 'complement map' }, T0 + 4)
    expect(next.updatedAt).toBe(T0 + 4)
    expect(next.problems[TWO_SUM]).toEqual({
      attempts: [],
      notes: { insight: 'complement map', time: '', space: '', pitfalls: '', updatedAt: T0 + 4 },
    })
  })

  it('merges fields without touching the others', () => {
    const one = frozen(setNotes(empty(), TWO_SUM, { insight: 'a', time: 'O(n)' }, T0 + 1))
    const two = setNotes(one, TWO_SUM, { space: 'O(n)' }, T0 + 2)
    expect(two.problems[TWO_SUM].notes).toEqual({
      insight: 'a',
      time: 'O(n)',
      space: 'O(n)',
      pitfalls: '',
      updatedAt: T0 + 2,
    })
  })

  it('keeps the text exactly as typed, spaces included', () => {
    const text = '  trailing space \n'
    const next = setNotes(empty(), TWO_SUM, { insight: text }, T0 + 1)
    expect(next.problems[TWO_SUM].notes.insight).toBe(text)
  })

  it('removes a record whose notes are all whitespace and which has no attempts', () => {
    const one = frozen(setNotes(empty(), TWO_SUM, { insight: 'a' }, T0 + 1))
    const cleared = setNotes(one, TWO_SUM, { insight: ' \n\t ' }, T0 + 2)
    expect(cleared.problems).toEqual({})
    expect(cleared.updatedAt).toBe(T0 + 2)
  })

  it('keeps whitespace-only notes on a record that has attempts', () => {
    const attempted = log(empty(), TWO_SUM, { rating: 'easy' })
    const next = setNotes(attempted, TWO_SUM, { insight: '   ' }, T0 + 2)
    expect(next.problems[TWO_SUM].notes.insight).toBe('   ')
    expect(next.problems[TWO_SUM].attempts).toHaveLength(1)
  })

  it('ignores values that are not text', () => {
    const one = frozen(setNotes(empty(), TWO_SUM, { insight: 'a' }, T0 + 1))
    const next = setNotes(one, TWO_SUM, { insight: 5 as never, time: null as never, space: 'O(1)' }, T0 + 2)
    expect(next.problems[TWO_SUM].notes).toMatchObject({ insight: 'a', time: '', space: 'O(1)' })
    const start = empty()
    expect(setNotes(start, TWO_SUM, { insight: 5 as never }, T0 + 1)).toBe(start)
  })

  it('is a no-op when nothing changes, for blank notes on no record, and for unknown slugs', () => {
    const start = empty()
    expect(setNotes(start, TWO_SUM, { insight: '  ' }, T0 + 1)).toBe(start)
    expect(setNotes(start, TWO_SUM, {}, T0 + 1)).toBe(start)
    expect(setNotes(start, 'not-a-problem', { insight: 'x' }, T0 + 1)).toBe(start)
    const one = frozen(setNotes(start, TWO_SUM, { insight: 'a' }, T0 + 1))
    expect(setNotes(one, TWO_SUM, { insight: 'a' }, T0 + 2)).toBe(one)
  })
})

describe('updateSettings', () => {
  it('rounds and clamps numbers into their limits', () => {
    const next = updateSettings(
      empty(),
      {
        dailyReviewCap: 100,
        mockMinutes: 3,
        sessionMinutes: 90.6,
        targets: { easy: 1, hard: 500, medium: 30.2 },
      },
      T0 + 1,
    )
    expect(next.updatedAt).toBe(T0 + 1)
    expect(next.settings.dailyReviewCap).toBe(30)
    expect(next.settings.mockMinutes).toBe(15)
    expect(next.settings.sessionMinutes).toBe(91)
    expect(next.settings.targets).toEqual({ easy: 5, medium: 30, hard: 120 })
  })

  it('merges partial targets', () => {
    const next = updateSettings(empty(), { targets: { hard: 50 } }, T0 + 1)
    expect(next.settings.targets).toEqual({ easy: 15, medium: 25, hard: 50 })
  })

  it('ignores invalid fields', () => {
    const start = empty()
    const next = updateSettings(
      start,
      {
        startDate: 'tomorrow',
        targetDate: '2026-13-01',
        dailyReviewCap: Number.NaN,
        mockMinutes: '60' as never,
        targets: { easy: Number.POSITIVE_INFINITY },
      },
      T0 + 1,
    )
    expect(next).toBe(start)
  })

  it('accepts valid dates', () => {
    const next = updateSettings(empty(), { startDate: '2026-11-01', targetDate: '2027-02-01' }, T0 + 1)
    expect(next.settings.startDate).toBe('2026-11-01')
    expect(next.settings.targetDate).toBe('2027-02-01')
  })

  it('keeps the target date at least one day after the start date', () => {
    const early = updateSettings(empty(), { targetDate: TODAY }, T0 + 1)
    expect(early.settings.targetDate).toBe('2026-11-13')
    const moved = updateSettings(empty(), { startDate: '2028-01-01' }, T0 + 1)
    expect(moved.settings.targetDate).toBe('2028-01-02')
  })

  it('returns the same object when nothing changes', () => {
    const start = empty()
    expect(updateSettings(start, {}, T0 + 1)).toBe(start)
    expect(updateSettings(start, { dailyReviewCap: 5, targets: { easy: 15 } }, T0 + 1)).toBe(start)
    expect(updateSettings(start, { dailyReviewCap: 5.2, mockMinutes: 45 }, T0 + 1)).toBe(start)
  })
})

describe('recordDrill', () => {
  it('appends a result stamped with now and today', () => {
    const next = recordDrill(
      empty(),
      { slug: TWO_SUM, answer: 'hashing', picked: 'two-pointers', correct: false, ms: 4200.4 },
      TODAY,
      T0 + 7,
    )
    expect(next.updatedAt).toBe(T0 + 7)
    expect(next.drills).toEqual([
      { slug: TWO_SUM, answer: 'hashing', picked: 'two-pointers', correct: false, ms: 4200, at: T0 + 7, date: TODAY },
    ])
  })

  it('keeps earlier results', () => {
    const result = { slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: 1000 } as const
    const one = frozen(recordDrill(empty(), result, TODAY, T0 + 1))
    expect(recordDrill(one, result, TODAY, T0 + 2).drills).toHaveLength(2)
  })

  it('returns the same object for an unknown problem or pattern', () => {
    const start = empty()
    const good = { slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: 1000 } as const
    expect(recordDrill(start, { ...good, slug: 'nope' }, TODAY, T0 + 1)).toBe(start)
    expect(recordDrill(start, { ...good, slug: 'constructor' }, TODAY, T0 + 1)).toBe(start)
    expect(recordDrill(start, { ...good, answer: 'sorcery' as never }, TODAY, T0 + 1)).toBe(start)
    expect(recordDrill(start, { ...good, picked: 'toString' as never }, TODAY, T0 + 1)).toBe(start)
  })

  it('stores only the fields of a result', () => {
    const result = { slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: 1000, extra: 1 }
    const [stored] = recordDrill(empty(), result as never, TODAY, T0 + 1).drills
    expect(Object.keys(stored).sort()).toEqual(['answer', 'at', 'correct', 'date', 'ms', 'picked', 'slug'])
  })

  it('stores a negative time as zero', () => {
    const result = { slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: -40 } as const
    expect(recordDrill(empty(), result, TODAY, T0 + 1).drills[0].ms).toBe(0)
  })

  it('stores a non-finite time as zero', () => {
    const next = recordDrill(
      empty(),
      { slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: Number.NaN },
      TODAY,
      T0 + 1,
    )
    expect(next.drills[0].ms).toBe(0)
  })
})

describe('solve timer', () => {
  it('reports elapsed time for null, paused and running timers', () => {
    expect(timerElapsed(null, T0)).toBe(0)
    expect(timerElapsed({ slug: TWO_SUM, runningSince: null, elapsedMs: 5000 }, T0)).toBe(5000)
    expect(timerElapsed({ slug: TWO_SUM, runningSince: T0, elapsedMs: 5000 }, T0 + 2500)).toBe(7500)
    expect(timerElapsed({ slug: TWO_SUM, runningSince: T0, elapsedMs: 5000 }, T0 - 10)).toBe(5000)
  })

  it('starts, pauses, resumes and resets', () => {
    const started = frozen(startTimer(empty(), TWO_SUM, T0 + 1000))
    expect(started.timer).toEqual({ slug: TWO_SUM, runningSince: T0 + 1000, elapsedMs: 0 })
    expect(started.updatedAt).toBe(T0 + 1000)

    const paused = frozen(pauseTimer(started, T0 + 4000))
    expect(paused.timer).toEqual({ slug: TWO_SUM, runningSince: null, elapsedMs: 3000 })

    const resumed = frozen(startTimer(paused, TWO_SUM, T0 + 10_000))
    expect(resumed.timer).toEqual({ slug: TWO_SUM, runningSince: T0 + 10_000, elapsedMs: 3000 })
    expect(timerElapsed(resumed.timer, T0 + 12_000)).toBe(5000)

    const reset = resetTimer(resumed, T0 + 13_000)
    expect(reset.timer).toEqual({ slug: TWO_SUM, runningSince: null, elapsedMs: 0 })
  })

  it('starting on another problem replaces the timer and discards its time', () => {
    const first = frozen(pauseTimer(frozen(startTimer(empty(), TWO_SUM, T0)), T0 + 9000))
    const second = startTimer(first, ANAGRAM, T0 + 10_000)
    expect(second.timer).toEqual({ slug: ANAGRAM, runningSince: T0 + 10_000, elapsedMs: 0 })
  })

  it('clears the timer', () => {
    const started = frozen(startTimer(empty(), TWO_SUM, T0))
    const cleared = clearTimer(started, T0 + 1)
    expect(cleared.timer).toBeNull()
    expect(cleared.updatedAt).toBe(T0 + 1)
  })

  it('is a no-op in every state that has nothing to do', () => {
    const none = empty()
    const running = frozen(startTimer(none, TWO_SUM, T0))
    const paused = frozen(pauseTimer(running, T0 + 1))
    expect(startTimer(none, 'not-a-problem', T0)).toBe(none)
    expect(startTimer(running, TWO_SUM, T0 + 5)).toBe(running)
    expect(pauseTimer(none, T0)).toBe(none)
    expect(pauseTimer(paused, T0 + 5)).toBe(paused)
    expect(resetTimer(none, T0)).toBe(none)
    expect(clearTimer(none, T0)).toBe(none)
    const fresh = frozen({ ...none, timer: { slug: TWO_SUM, runningSince: null, elapsedMs: 0 } })
    expect(resetTimer(fresh, T0 + 1)).toBe(fresh)
  })
})

describe('mock interviews', () => {
  const started = (data = empty(), at = T0) => frozen(startMock(data, MOCK_CONFIG, [DUPLICATE, TWO_SUM], at))
  const lastMock = (data: AppData) => data.mocks[data.mocks.length - 1]

  it('starts a running mock', () => {
    const data = started()
    expect(data.updatedAt).toBe(T0)
    expect(data.mocks).toHaveLength(1)
    expect(data.mocks[0]).toMatchObject({
      startedAt: T0,
      config: MOCK_CONFIG,
      slugs: [DUPLICATE, TWO_SUM],
      status: 'running',
      endedAt: null,
      marks: {},
      results: {},
    })
    expect(data.mocks[0].id).toBeTruthy()
  })

  it('does not share the config with the caller and cleans it', () => {
    const topics = ['trees', 'bogus', 'trees'] as never
    const data = frozen(startMock(empty(), { ...MOCK_CONFIG, topics, minutes: 500 }, [TWO_SUM], T0))
    expect(data.mocks[0].config.topics).toEqual(['trees'])
    expect(data.mocks[0].config.minutes).toBe(120)
  })

  it('falls back to any for a mix or pool that does not exist', () => {
    const config = { ...MOCK_CONFIG, mix: 'hard-hard', pool: 'everything', minutes: Number.NaN } as never
    const data = frozen(startMock(empty(), config, [TWO_SUM], T0))
    expect(data.mocks[0].config).toEqual({ mix: 'any', pool: 'any', topics: [], minutes: 45 })
  })

  it('ignores unknown and repeated slugs, and refuses a mock with none', () => {
    const data = frozen(startMock(empty(), MOCK_CONFIG, [TWO_SUM, 'nope', TWO_SUM], T0))
    expect(data.mocks[0].slugs).toEqual([TWO_SUM])
    const start = empty()
    expect(startMock(start, MOCK_CONFIG, ['nope'], T0)).toBe(start)
    expect(startMock(start, MOCK_CONFIG, [], T0)).toBe(start)
  })

  it('abandons a running mock and one awaiting ratings when another starts', () => {
    const first = started()
    const second = frozen(startMock(first, MOCK_CONFIG, [ANAGRAM], T0 + 1000))
    expect(second.mocks.map((m) => m.status)).toEqual(['abandoned', 'running'])
    expect(second.mocks[0].endedAt).toBe(T0 + 1000)

    const ended = frozen(endMock(second, T0 + 2000))
    const third = frozen(startMock(ended, MOCK_CONFIG, [ANAGRAM], T0 + 3000))
    expect(third.mocks.map((m) => m.status)).toEqual(['abandoned', 'abandoned', 'running'])
    expect(third.mocks[1].endedAt).toBe(T0 + 2000)
  })

  it('does not touch finished mocks when another starts', () => {
    const done = frozen(rateMock(frozen(endMock(started(), T0 + 1)), {}, TODAY, T0 + 2))
    const next = startMock(done, MOCK_CONFIG, [ANAGRAM], T0 + 3)
    expect(next.mocks[0].status).toBe('done')
  })

  it('toggles a problem as finished, recording elapsed ms', () => {
    const marked = frozen(markMockProblem(started(), TWO_SUM, T0 + 600_000))
    expect(lastMock(marked).marks).toEqual({ [TWO_SUM]: 600_000 })
    expect(marked.updatedAt).toBe(T0 + 600_000)
    const unmarked = markMockProblem(marked, TWO_SUM, T0 + 700_000)
    expect(lastMock(unmarked).marks).toEqual({})
  })

  it('ignores marks for a problem outside the mock or when no mock is running', () => {
    const data = started()
    expect(markMockProblem(data, ANAGRAM, T0 + 1)).toBe(data)
    const none = empty()
    expect(markMockProblem(none, TWO_SUM, T0 + 1)).toBe(none)
    const ended = frozen(endMock(data, T0 + 1))
    expect(markMockProblem(ended, TWO_SUM, T0 + 2)).toBe(ended)
  })

  it('ends a running mock into review, once', () => {
    const ended = frozen(endMock(started(), T0 + 5000))
    expect(lastMock(ended)).toMatchObject({ status: 'review', endedAt: T0 + 5000 })
    expect(endMock(ended, T0 + 6000)).toBe(ended)
    const none = empty()
    expect(endMock(none, T0)).toBe(none)
  })

  it('abandons an active mock', () => {
    const data = started()
    const abandoned = frozen(abandonMock(data, T0 + 10))
    expect(lastMock(abandoned)).toMatchObject({ status: 'abandoned', endedAt: T0 + 10 })
    expect(abandonMock(abandoned, T0 + 20)).toBe(abandoned)
    const review = frozen(endMock(data, T0 + 1))
    expect(lastMock(abandonMock(review, T0 + 2)).status).toBe('abandoned')
    const none = empty()
    expect(abandonMock(none, T0)).toBe(none)
  })

  describe('rateMock', () => {
    const review = () => frozen(endMock(started(), T0 + 1000))

    it('saves the ratings, marks the mock done and logs mock attempts dated today', () => {
      const data = rateMock(
        review(),
        {
          [DUPLICATE]: { outcome: 'easy', minutes: 9.6, mistakes: ['bug', 'bug'] },
          [TWO_SUM]: { outcome: 'help', minutes: null, mistakes: [] },
        },
        TODAY,
        T0 + 2000,
      )
      expect(data.updatedAt).toBe(T0 + 2000)
      expect(lastMock(data).status).toBe('done')
      expect(lastMock(data).endedAt).toBe(T0 + 1000)
      expect(lastMock(data).results).toEqual({
        [DUPLICATE]: { outcome: 'easy', minutes: 10, mistakes: ['bug'] },
        [TWO_SUM]: { outcome: 'help', minutes: null, mistakes: [] },
      })
      expect(attemptsOf(data, DUPLICATE)[0]).toMatchObject({
        rating: 'easy',
        minutes: 10,
        mistakes: ['bug'],
        source: 'mock',
        date: TODAY,
        at: T0 + 2000,
      })
      expect(attemptsOf(data, TWO_SUM)[0]).toMatchObject({ rating: 'help', minutes: null, source: 'mock' })
      expect(attemptsOf(data, DUPLICATE)[0].id).not.toBe(attemptsOf(data, TWO_SUM)[0].id)
    })

    it('logs nothing for an unfinished problem but still records the result', () => {
      const data = rateMock(
        review(),
        {
          [DUPLICATE]: { outcome: 'unfinished', minutes: 20, mistakes: ['out-of-time'] },
          [TWO_SUM]: { outcome: 'struggled', minutes: 30, mistakes: [] },
        },
        TODAY,
        T0 + 2000,
      )
      expect(data.problems[DUPLICATE]).toBeUndefined()
      expect(lastMock(data).results[DUPLICATE]).toEqual({
        outcome: 'unfinished',
        minutes: 20,
        mistakes: ['out-of-time'],
      })
      expect(attemptsOf(data, TWO_SUM)).toHaveLength(1)
    })

    it('adds to the history a problem already has', () => {
      const before = log(review(), TWO_SUM, { rating: 'help', date: '2026-11-01' })
      const data = rateMock(before, { [TWO_SUM]: { outcome: 'easy', minutes: 5, mistakes: [] } }, TODAY, T0 + 2000)
      expect(attemptsOf(data, TWO_SUM).map((a) => a.source)).toEqual(['manual', 'mock'])
    })

    it('ignores results for problems outside the mock and malformed outcomes', () => {
      const data = rateMock(
        review(),
        {
          [ANAGRAM]: { outcome: 'easy', minutes: 5, mistakes: [] },
          [TWO_SUM]: { outcome: 'great' as never, minutes: 5, mistakes: [] },
        },
        TODAY,
        T0 + 2000,
      )
      expect(lastMock(data).results).toEqual({})
      expect(data.problems).toEqual({})
      expect(lastMock(data).status).toBe('done')
    })

    it('clears the solve timer when it is on one of the mock problems', () => {
      const timed = frozen(startTimer(review(), TWO_SUM, T0 + 1500))
      const rated = rateMock(timed, { [TWO_SUM]: { outcome: 'easy', minutes: 5, mistakes: [] } }, TODAY, T0 + 2000)
      expect(rated.timer).toBeNull()
      const unfinished = rateMock(
        timed,
        { [TWO_SUM]: { outcome: 'unfinished', minutes: null, mistakes: [] } },
        TODAY,
        T0 + 2000,
      )
      expect(unfinished.timer).toBeNull()
    })

    it('keeps a solve timer that is on another problem', () => {
      const timed = frozen(startTimer(review(), ANAGRAM, T0 + 1500))
      const rated = rateMock(timed, { [TWO_SUM]: { outcome: 'easy', minutes: 5, mistakes: [] } }, TODAY, T0 + 2000)
      expect(rated.timer).toEqual(timed.timer)
    })

    it('is a no-op unless a mock is awaiting review', () => {
      const results: Record<string, MockResult> = { [TWO_SUM]: { outcome: 'easy', minutes: 5, mistakes: [] } }
      const none = empty()
      expect(rateMock(none, results, TODAY, T0)).toBe(none)
      const running = started()
      expect(rateMock(running, results, TODAY, T0)).toBe(running)
      const done = frozen(rateMock(review(), results, TODAY, T0 + 2000))
      expect(rateMock(done, results, TODAY, T0 + 3000)).toBe(done)
      const abandoned = frozen(abandonMock(review(), T0 + 2000))
      expect(rateMock(abandoned, results, TODAY, T0 + 3000)).toBe(abandoned)
    })

    it('cannot rate the same mock twice, and a second end changes nothing', () => {
      const results: Record<string, MockResult> = { [TWO_SUM]: { outcome: 'easy', minutes: 5, mistakes: [] } }
      const done = frozen(rateMock(review(), results, TODAY, T0 + 2000))
      expect(attemptsOf(done, TWO_SUM)).toHaveLength(1)
      const again = rateMock(done, results, TODAY, T0 + 3000)
      expect(again).toBe(done)
      expect(endMock(done, T0 + 4000)).toBe(done)
      expect(markMockProblem(done, TWO_SUM, T0 + 4000)).toBe(done)
    })

    it('ignores an outcome that names an inherited property', () => {
      const data = rateMock(
        review(),
        { [TWO_SUM]: { outcome: 'toString' as never, minutes: 5, mistakes: [] } },
        TODAY,
        T0 + 2000,
      )
      expect(lastMock(data).results).toEqual({})
      expect(data.problems).toEqual({})
    })

    it('runs the whole lifecycle: start, mark, end, rate', () => {
      let data = started()
      data = frozen(startTimer(data, DUPLICATE, T0 + 10))
      data = frozen(markMockProblem(data, DUPLICATE, T0 + 5 * 60_000))
      data = frozen(endMock(data, T0 + 30 * 60_000))
      data = frozen(
        rateMock(
          data,
          {
            [DUPLICATE]: { outcome: 'easy', minutes: 5, mistakes: [] },
            [TWO_SUM]: { outcome: 'unfinished', minutes: null, mistakes: ['blanked'] },
          },
          TODAY,
          T0 + 31 * 60_000,
        ),
      )
      expect(lastMock(data)).toMatchObject({ status: 'done', marks: { [DUPLICATE]: 5 * 60_000 } })
      expect(data.timer).toBeNull()
      expect(Object.keys(data.problems)).toEqual([DUPLICATE])
    })
  })
})

describe('session and flags', () => {
  const plan: SessionPlan = {
    date: TODAY,
    budget: 60,
    items: [{ kind: 'new', slug: TWO_SUM, minutes: 25, reason: 'Next in your roadmap' }],
    createdAt: T0,
  }

  it('sets and clears the session plan', () => {
    const set = frozen(setSession(empty(), plan, T0 + 1))
    expect(set.session).toEqual(plan)
    expect(set.updatedAt).toBe(T0 + 1)
    expect(setSession(set, null, T0 + 2).session).toBeNull()
  })

  it('is a no-op when the session is the same one', () => {
    const none = empty()
    expect(setSession(none, null, T0 + 1)).toBe(none)
    const set = frozen(setSession(none, plan, T0 + 1))
    expect(setSession(set, plan, T0 + 2)).toBe(set)
  })

  it('sets the onboarded flag, and only when it changes', () => {
    const none = empty()
    expect(setOnboarded(none, false, T0 + 1)).toBe(none)
    const done = setOnboarded(none, true, T0 + 1)
    expect(done.onboarded).toBe(true)
    expect(done.updatedAt).toBe(T0 + 1)
    expect(setOnboarded(frozen(done), true, T0 + 2)).toBe(done)
  })
})
