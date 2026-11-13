import { describe, expect, it } from 'vitest'
import {
  endMock,
  createEmptyData,
  logAttempt,
  markMockProblem,
  rateMock,
  recordDrill,
  setNotes,
  setOnboarded,
  setSession,
  startMock,
  startTimer,
  updateSettings,
} from './reducers'
import { SCHEMA_VERSION } from './schema'
import type { AppData } from './schema'
import { parseAppData, summarize } from './validate'

const TODAY = '2026-11-12'
const T0 = Date.UTC(2026, 10, 12, 15, 0, 0)
const NOW = T0 + 60_000

/** A document that uses every part of the schema, built only through the reducers. */
function fullDocument(): AppData {
  let d = createEmptyData(TODAY, T0)
  d = updateSettings(d, { dailyReviewCap: 8, targets: { hard: 55 }, mockMinutes: 60, targetDate: '2027-03-01' }, T0 + 1)
  d = logAttempt(d, 'two-sum', { rating: 'help', date: '2026-10-20', minutes: 41, mistakes: ['wrong-pattern', 'bug'] }, TODAY, T0 + 2)
  d = logAttempt(d, 'two-sum', { rating: 'easy', date: '2026-10-27', minutes: 9, recall: '  map of complements  ' }, TODAY, T0 + 3)
  d = logAttempt(d, 'valid-anagram', { rating: 'struggled', date: TODAY }, TODAY, T0 + 4)
  d = setNotes(d, 'two-sum', { insight: ' keep   the spacing\n', time: 'O(n)', space: 'O(n)', pitfalls: 'duplicates' }, T0 + 5)
  d = setNotes(d, 'group-anagrams', { insight: 'notes without attempts' }, T0 + 6)
  d = recordDrill(d, { slug: 'two-sum', answer: 'hashing', picked: 'hashing', correct: true, ms: 3100 }, TODAY, T0 + 7)
  d = recordDrill(d, { slug: 'valid-anagram', answer: 'hashing', picked: 'two-pointers', correct: false, ms: 8900 }, TODAY, T0 + 8)
  // One mock rated and finished, then a second one left running.
  d = startMock(d, { mix: 'easy-medium', pool: 'any', topics: ['arrays-hashing', 'trees'], minutes: 45 }, ['contains-duplicate', 'two-sum'], T0 + 9)
  d = markMockProblem(d, 'contains-duplicate', T0 + 600_000)
  d = endMock(d, T0 + 900_000)
  d = rateMock(
    d,
    {
      'contains-duplicate': { outcome: 'easy', minutes: 10, mistakes: [] },
      'two-sum': { outcome: 'unfinished', minutes: null, mistakes: ['out-of-time', 'blanked'] },
    },
    TODAY,
    T0 + 910_000,
  )
  d = startMock(d, { mix: 'any', pool: 'unsolved', topics: [], minutes: 45 }, ['valid-palindrome', 'trapping-rain-water'], T0 + 920_000)
  d = startTimer(d, 'valid-palindrome', T0 + 930_000)
  d = setSession(
    d,
    {
      date: TODAY,
      budget: 60,
      createdAt: T0 + 940_000,
      items: [
        { kind: 'review', slug: 'two-sum', minutes: 10, reason: 'Due today' },
        { kind: 'new', slug: 'group-anagrams', minutes: 25, reason: 'Next in your roadmap' },
        { kind: 'drill', minutes: 5, reason: 'Pattern warm-up' },
      ],
    },
    T0 + 940_000,
  )
  return setOnboarded(d, true, T0 + 950_000)
}

/** Built once: ids are random, so two builds are never equal. */
const DOC = fullDocument()

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown

/** A valid document as plain JSON, for the tests that damage one part of it. */
const base = () => roundTrip(DOC) as Record<string, any>

function parse(raw: unknown) {
  return parseAppData(raw, TODAY, NOW)
}

function parseOk(raw: unknown) {
  const result = parse(raw)
  if (!result.ok) throw new Error(result.error)
  return result
}

function parseError(raw: unknown) {
  const result = parse(raw)
  if (result.ok) throw new Error('expected the document to be rejected')
  return result.error
}

describe('round trip', () => {
  it('parses a JSON round-trip of a full document back to the same document', () => {
    const doc = DOC
    const result = parseOk(roundTrip(doc))
    expect(result.data).toEqual(doc)
    expect(result.warnings).toEqual([])
  })

  it('round-trips a document built from hostile reducer inputs', () => {
    let d = createEmptyData(TODAY, T0)
    d = logAttempt(d, 'two-sum', { rating: 'easy', date: '2099-01-01', minutes: Number.NaN, source: 'x' as never }, TODAY, T0 + 1)
    d = logAttempt(d, 'two-sum', { rating: 'help', mistakes: ['bug', 'bug', 'zzz' as never], recall: '   ' }, TODAY, T0 + 2)
    d = logAttempt(d, 'two-sum', { rating: 'nope' as never }, TODAY, T0 + 3)
    d = recordDrill(d, { slug: 'nope', answer: 'hashing', picked: 'hashing', correct: true, ms: 1 }, TODAY, T0 + 4)
    d = recordDrill(d, { slug: 'two-sum', answer: 'hashing', picked: 'hashing', correct: 1 as never, ms: Infinity, extra: 1 } as never, TODAY, T0 + 5)
    d = startMock(d, { mix: 'x', pool: 'y', topics: ['trees', 'trees', 'constructor'], minutes: Number.NaN } as never, ['two-sum', 'nope'], T0 + 6)
    d = updateSettings(d, { dailyReviewCap: 1e9, startDate: '2030-01-01' }, T0 + 7)
    const result = parseOk(roundTrip(d))
    expect(result.data).toEqual(d)
    expect(result.warnings).toEqual([])
  })

  it('is stable when parsed twice', () => {
    const once = parseOk(roundTrip(DOC)).data
    expect(parseOk(roundTrip(once)).data).toEqual(once)
  })

  it('round-trips a fresh document', () => {
    const doc = createEmptyData(TODAY, T0)
    const result = parseOk(roundTrip(doc))
    expect(result.data).toEqual(doc)
    expect(result.warnings).toEqual([])
  })

  it('keeps whitespace in notes and trimmed recall, and leaves no undefined fields behind', () => {
    const data = parseOk(roundTrip(DOC)).data
    expect(data.problems['two-sum'].notes.insight).toBe(' keep   the spacing\n')
    expect(data.problems['two-sum'].attempts[1].recall).toBe('map of complements')
    expect('recall' in data.problems['two-sum'].attempts[0]).toBe(false)
    expect('slug' in data.session!.items[2]).toBe(false)
  })

  it('accepts the extra exportedAt field and does not carry it over', () => {
    const raw = { ...(roundTrip(DOC) as object), exportedAt: '2026-11-12T15:00:00.000Z' }
    const result = parseOk(raw)
    expect(result.data).toEqual(DOC)
    expect('exportedAt' in result.data).toBe(false)
  })
})

describe('rejected documents', () => {
  it.each([
    ['null', null],
    ['a number', 42],
    ['a string', 'cairn'],
    ['an array', []],
    ['undefined', undefined],
  ])('rejects %s', (_name, raw) => {
    expect(parseError(raw)).toMatch(/not a Cairn backup/)
  })

  it('rejects a different app id', () => {
    expect(parseError({ ...base(), app: 'other-app' })).toMatch(/not a Cairn backup/)
    const { app: _app, ...withoutApp } = base()
    expect(parseError(withoutApp)).toMatch(/not a Cairn backup/)
  })

  it('rejects a missing or invalid version', () => {
    const { version: _version, ...withoutVersion } = base()
    expect(parseError(withoutVersion)).toMatch(/version/)
    expect(parseError({ ...base(), version: '1' })).toMatch(/version/)
    expect(parseError({ ...base(), version: 1.5 })).toMatch(/version/)
    expect(parseError({ ...base(), version: 0 })).toMatch(/version/)
    expect(parseError({ ...base(), version: null })).toMatch(/version/)
  })

  it('rejects a newer version and says to update', () => {
    const error = parseError({ ...base(), version: SCHEMA_VERSION + 1 })
    expect(error).toMatch(/newer version of Cairn/)
  })
})

describe('missing fields', () => {
  it('fills everything from defaults when only the identity fields are present', () => {
    const result = parseOk({ app: 'cairn', version: 1 })
    const empty = createEmptyData(TODAY, NOW)
    expect(result.data).toEqual(empty)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/missing or unreadable/)
    expect(result.warnings[0]).toContain('settings')
    expect(result.warnings[0]).toContain('problems')
  })

  it('takes missing timestamps from the other one, then from now', () => {
    expect(parseOk({ app: 'cairn', version: 1, updatedAt: 500 }).data).toMatchObject({ createdAt: 500, updatedAt: 500 })
    expect(parseOk({ app: 'cairn', version: 1, createdAt: 400 }).data).toMatchObject({ createdAt: 400, updatedAt: 400 })
    expect(parseOk({ app: 'cairn', version: 1 }).data).toMatchObject({ createdAt: NOW, updatedAt: NOW })
  })

  it('treats a record without notes as having empty notes', () => {
    const raw = base()
    delete raw.problems['valid-anagram'].notes
    const data = parseOk(raw).data
    expect(data.problems['valid-anagram'].notes).toEqual({ insight: '', time: '', space: '', pitfalls: '', updatedAt: null })
  })

  it('treats flags other than true as false', () => {
    const raw = { ...base(), demo: 'yes', onboarded: 1 }
    expect(parseOk(raw).data).toMatchObject({ demo: false, onboarded: false })
  })

  it('reads a missing onboarded flag as true when the file holds history: a backup is not a first run', () => {
    const raw = base()
    delete raw.onboarded
    expect(parseOk(raw).data.onboarded).toBe(true)
    // History in drills alone counts too.
    const drillsOnly = { ...createEmptyData(TODAY, T0), drills: DOC.drills } as Record<string, unknown>
    delete drillsOnly.onboarded
    expect(parseOk(roundTrip(drillsOnly)).data.onboarded).toBe(true)
  })

  it('leaves a missing flag false for an empty document, and an explicit false alone', () => {
    const empty = roundTrip(createEmptyData(TODAY, T0)) as Record<string, unknown>
    delete empty.onboarded
    expect(parseOk(empty).data.onboarded).toBe(false)
    expect(parseOk({ ...base(), onboarded: false }).data.onboarded).toBe(false)
  })
})

describe('problems and attempts', () => {
  it('drops records for unknown slugs and says so', () => {
    const raw = base()
    raw.problems['not-a-real-problem'] = raw.problems['two-sum']
    raw.problems.constructor = raw.problems['two-sum']
    const result = parseOk(raw)
    expect(Object.keys(result.data.problems).sort()).toEqual(Object.keys(DOC.problems).sort())
    expect(result.warnings).toEqual(['Dropped 2 records for unknown problems.'])
  })

  it('drops attempts with a bad date and says so', () => {
    const raw = base()
    raw.problems['two-sum'].attempts[0].date = '2026-02-30'
    raw.problems['two-sum'].attempts[1].date = 'yesterday'
    const result = parseOk(raw)
    // Both of two-sum's attempts are gone, but its notes keep the record.
    expect(result.data.problems['two-sum'].attempts).toEqual([])
    expect(result.warnings).toEqual(['Dropped 2 attempts with invalid dates.'])
  })

  it('drops attempts with a bad rating', () => {
    const raw = base()
    raw.problems['two-sum'].attempts[0].rating = 'perfect'
    const result = parseOk(raw)
    expect(result.data.problems['two-sum'].attempts).toHaveLength(1)
    expect(result.warnings).toEqual(['Dropped 1 attempt with unknown ratings.'])
  })

  it('drops malformed attempts', () => {
    const raw = base()
    const attempts = raw.problems['two-sum'].attempts
    attempts.push(null, 'text', { rating: 'easy', date: TODAY, at: 1 }, { id: 'x', rating: 'easy', date: TODAY })
    attempts.push({ ...attempts[0] })
    const result = parseOk(raw)
    expect(result.data.problems['two-sum'].attempts).toHaveLength(2)
    expect(result.warnings).toEqual(['Dropped 5 malformed attempts.'])
  })

  it('moves attempts and drills dated after today to today, and says so', () => {
    const raw = base()
    raw.problems['two-sum'].attempts[0].date = '2026-11-13'
    raw.problems['valid-anagram'].attempts[0].date = '2099-01-01'
    raw.drills[0].date = '2026-12-01'
    const result = parseOk(raw)
    expect(result.data.problems['two-sum'].attempts[0].date).toBe(TODAY)
    expect(result.data.problems['valid-anagram'].attempts[0].date).toBe(TODAY)
    expect(result.data.drills[0].date).toBe(TODAY)
    expect(result.warnings).toEqual(['Moved 3 entries dated in the future to today.'])
  })

  it('keeps an attempt dated today or earlier as it is', () => {
    const raw = base()
    raw.problems['two-sum'].attempts[0].date = TODAY
    expect(parseOk(raw).warnings).toEqual([])
  })

  it('removes unknown and repeated mistake tags', () => {
    const raw = base()
    raw.problems['two-sum'].attempts[0].mistakes = ['bug', 'bug', 'telepathy', 'edge-case']
    const result = parseOk(raw)
    expect(result.data.problems['two-sum'].attempts[0].mistakes).toEqual(['bug', 'edge-case'])
    expect(result.warnings).toEqual(['Dropped 2 unknown or repeated mistake tags.'])
  })

  it('repairs minutes, source and recall without complaint', () => {
    const raw = base()
    const [first, second] = raw.problems['two-sum'].attempts
    first.minutes = 9999
    first.source = 'carrier pigeon'
    second.minutes = 12.4
    second.recall = '   '
    const result = parseOk(raw)
    const [a, b] = result.data.problems['two-sum'].attempts
    expect(a).toMatchObject({ minutes: null, source: 'manual' })
    expect(b.minutes).toBe(12)
    expect('recall' in b).toBe(false)
    expect(result.warnings).toEqual([])
  })

  it('drops a record that ends up with no attempts and blank notes', () => {
    const raw = base()
    raw.problems['valid-anagram'].attempts[0].rating = 'nope'
    const result = parseOk(raw)
    expect(result.data.problems['valid-anagram']).toBeUndefined()
  })

  it('counts a record that is not an object', () => {
    const raw = base()
    raw.problems['valid-anagram'] = 'oops'
    expect(parseOk(raw).warnings).toEqual(['Dropped 1 damaged problem record.'])
  })

  it('counts a record whose attempts are not a list, so the preview shows the loss', () => {
    const raw = base()
    const lost = raw.problems['two-sum'].attempts.length
    raw.problems['two-sum'].attempts = 'oops'
    const result = parseOk(raw)
    expect(result.warnings).toEqual(['Dropped 1 damaged problem record.'])
    // Its notes survive, and the summary shows exactly what was lost.
    expect(result.data.problems['two-sum'].attempts).toEqual([])
    expect(summarize(result.data).attempts).toBe(summarize(DOC).attempts - lost)
    for (const bad of [{}, 7, null, true]) {
      const again = base()
      again.problems['two-sum'].attempts = bad
      expect(parseOk(again).warnings, JSON.stringify(bad)).toEqual(['Dropped 1 damaged problem record.'])
    }
  })

  it('counts notes that are not an object, and says nothing for a record that simply has none', () => {
    const raw = base()
    raw.problems['two-sum'].notes = 'oops'
    expect(parseOk(raw).warnings).toEqual(['Dropped 1 damaged set of notes.'])
    const none = base()
    delete none.problems['valid-anagram'].notes
    expect(parseOk(none).warnings).toEqual([])
  })

  it('does not mutate its input', () => {
    const raw = base()
    raw.problems['nope'] = {}
    raw.problems['two-sum'].attempts[0].date = 'bad'
    const copy = JSON.stringify(raw)
    parse(raw)
    expect(JSON.stringify(raw)).toBe(copy)
  })
})

describe('settings', () => {
  it('clamps numbers that are out of range and counts them', () => {
    const raw = base()
    raw.settings.dailyReviewCap = 500
    raw.settings.mockMinutes = 1
    raw.settings.targets.easy = 0
    raw.settings.sessionMinutes = 61.4
    const result = parseOk(raw)
    expect(result.data.settings).toMatchObject({ dailyReviewCap: 30, mockMinutes: 15, sessionMinutes: 61 })
    expect(result.data.settings.targets.easy).toBe(5)
    expect(result.warnings).toEqual(['Repaired 4 settings that were missing or out of range.'])
  })

  it('fills invalid fields from defaults', () => {
    const raw = base()
    raw.settings.dailyReviewCap = 'many'
    raw.settings.startDate = '2026-13-45'
    raw.settings.targetDate = null
    delete raw.settings.targets
    const result = parseOk(raw)
    expect(result.data.settings.dailyReviewCap).toBe(5)
    expect(result.data.settings.startDate).toBe(TODAY)
    expect(result.data.settings.targetDate).toBe('2027-02-03')
    expect(result.data.settings.targets).toEqual({ easy: 15, medium: 25, hard: 40 })
    expect(result.warnings).toEqual(['Repaired 6 settings that were missing or out of range.'])
  })

  it('keeps the target date after the start date', () => {
    const raw = base()
    raw.settings.startDate = '2026-11-12'
    raw.settings.targetDate = '2026-11-01'
    expect(parseOk(raw).data.settings.targetDate).toBe('2026-11-13')
  })

  it('replaces settings that are not an object', () => {
    const raw = { ...base(), settings: 'big' }
    const result = parseOk(raw)
    expect(result.data.settings).toEqual(createEmptyData(TODAY, NOW).settings)
    expect(result.warnings[0]).toContain('settings')
  })
})

describe('drills', () => {
  it('drops drills with unknown slugs, unknown patterns or bad numbers', () => {
    const raw = base()
    const good = raw.drills[0]
    raw.drills.push(
      { ...good, slug: 'nope' },
      { ...good, answer: 'sorcery' },
      { ...good, picked: 'constructor' },
      { ...good, date: 'later' },
      { ...good, ms: -1 },
      { ...good, correct: 'yes' },
      { ...good, at: null },
      7,
    )
    const result = parseOk(raw)
    expect(result.data.drills).toEqual(DOC.drills)
    expect(result.warnings).toEqual(['Dropped 8 damaged drill results.'])
  })

  it('folds results beyond the newest 5,000 into per-pattern counts, keeping every total', () => {
    const raw = base()
    const good = raw.drills[0] // right: hashing
    const miss = raw.drills[1] // wrong: picked two-pointers
    raw.drills = Array.from({ length: 5003 }, (_, i) => ({ ...(i % 3 === 0 ? miss : good), at: i }))
    const result = parseOk(raw)
    expect(result.warnings).toEqual([])
    expect(result.data.drills).toHaveLength(5000)
    expect(result.data.drills[0].at).toBe(3)
    const archive = result.data.drillArchive!
    expect(archive.reduce((n, b) => n + b.count, 0)).toBe(3)
    expect(archive).toContainEqual({ topic: 'arrays-hashing', answer: 'hashing', picked: 'two-pointers', correct: false, count: 1 })
    expect(archive).toContainEqual({ topic: 'arrays-hashing', answer: 'hashing', picked: 'hashing', correct: true, count: 2 })
    expect(summarize(result.data).drills).toBe(5003)
  })

  it('reads a stored archive back, dropping and counting damaged buckets', () => {
    const raw = base()
    const bucket = { topic: 'trees', answer: 'tree-dfs', picked: 'tree-bfs', correct: false, count: 4 }
    raw.drillArchive = [
      bucket,
      { ...bucket, topic: 'nowhere' },
      { ...bucket, answer: 'sorcery' },
      { ...bucket, count: 0 },
      { ...bucket, count: 1.5 },
      { ...bucket, correct: 'no' },
      3,
    ]
    const result = parseOk(raw)
    expect(result.data.drillArchive).toEqual([bucket])
    expect(result.warnings).toEqual(['Dropped 6 damaged drill results.'])
    expect(summarize(result.data).drills).toBe(DOC.drills.length + 4)
    expect(parseOk({ ...base(), drillArchive: 'x' }).warnings).toEqual(['Dropped 1 damaged drill result.'])
  })

  it('has no archive when there is nothing to fold', () => {
    expect(parseOk(base()).data.drillArchive).toBeUndefined()
  })

  it('starts empty when drills are not a list', () => {
    const result = parseOk({ ...base(), drills: {} })
    expect(result.data.drills).toEqual([])
    expect(result.warnings[0]).toContain('drills')
  })
})

describe('mocks', () => {
  const lastMock = (raw: Record<string, any>) => raw.mocks[raw.mocks.length - 1]

  it('discards a mock that names an unknown problem', () => {
    const raw = base()
    lastMock(raw).slugs = ['valid-palindrome', 'not-a-problem']
    const result = parseOk(raw)
    expect(result.data.mocks).toHaveLength(1)
    expect(result.data.mocks[0].status).toBe('done')
    expect(result.warnings).toEqual(['Dropped 1 damaged mock interview.'])
  })

  it.each([
    ['an unknown status', (m: any) => (m.status = 'paused')],
    ['no id', (m: any) => delete m.id],
    ['no config', (m: any) => delete m.config],
    ['an unknown mix', (m: any) => (m.config.mix = 'hard-hard')],
    ['an unknown pool', (m: any) => (m.config.pool = 'everything')],
    ['no problems', (m: any) => (m.slugs = [])],
    ['a repeated problem', (m: any) => (m.slugs = ['two-sum', 'two-sum'])],
    ['no start time', (m: any) => (m.startedAt = 'now')],
  ])('discards a mock with %s', (_name, damage) => {
    const raw = base()
    damage(lastMock(raw))
    const result = parseOk(raw)
    expect(result.data.mocks).toHaveLength(1)
    expect(result.warnings).toEqual(['Dropped 1 damaged mock interview.'])
  })

  it('cleans the config, marks and results quietly', () => {
    const raw = base()
    const mock = raw.mocks[0]
    mock.config.topics = ['trees', 'trees', 'bogus', 'constructor']
    mock.config.minutes = 5000
    mock.marks['not-in-mock'] = 5
    mock.marks['two-sum'] = -3
    mock.results['not-in-mock'] = { outcome: 'easy', minutes: 5, mistakes: [] }
    mock.results['two-sum'].outcome = 'flawless'
    const result = parseOk(raw)
    const parsed = result.data.mocks[0]
    expect(parsed.config.topics).toEqual(['trees'])
    expect(parsed.config.minutes).toBe(120)
    expect(parsed.marks).toEqual({ 'contains-duplicate': 600_000 - 9 })
    expect(Object.keys(parsed.results)).toEqual(['contains-duplicate'])
  })

  it('leaves only the latest mock active', () => {
    const raw = base()
    raw.mocks[0].status = 'review'
    raw.mocks[0].endedAt = null
    const result = parseOk(raw)
    expect(result.data.mocks.map((m) => m.status)).toEqual(['abandoned', 'running'])
    expect(result.data.mocks[0].endedAt).toBe(NOW)
  })

  it('abandons an earlier mock that claims to be live even when a later one is finished', () => {
    const raw = base()
    raw.mocks.reverse()
    const result = parseOk(raw)
    expect(result.data.mocks.map((m) => m.status)).toEqual(['abandoned', 'done'])
  })

  it('stops the clock of a running mock and gives every other mock an end time', () => {
    const raw = base()
    lastMock(raw).endedAt = T0 + 5
    raw.mocks[0].endedAt = null
    const result = parseOk(raw)
    expect(result.data.mocks[1].endedAt).toBeNull()
    expect(result.data.mocks[0].endedAt).toBe(NOW)
  })

  it('starts empty when mocks are not a list', () => {
    const result = parseOk({ ...base(), mocks: 'none' })
    expect(result.data.mocks).toEqual([])
    expect(result.warnings[0]).toContain('mocks')
  })
})

describe('timer and session', () => {
  it('discards a timer for an unknown problem', () => {
    const raw = base()
    raw.timer.slug = 'not-a-problem'
    const result = parseOk(raw)
    expect(result.data.timer).toBeNull()
    expect(result.warnings).toEqual(['Dropped the solve timer because it was damaged or pointed at an unknown problem.'])
  })

  it.each([
    ['text', 'running'],
    ['a negative elapsed time', { slug: 'two-sum', runningSince: null, elapsedMs: -5 }],
    ['a bad start time', { slug: 'two-sum', runningSince: 'noon', elapsedMs: 0 }],
    ['a missing start time', { slug: 'two-sum', elapsedMs: 0 }],
  ])('discards a timer with %s', (_name, timer) => {
    const result = parseOk({ ...base(), timer })
    expect(result.data.timer).toBeNull()
    expect(result.warnings).toHaveLength(1)
  })

  it('keeps a paused timer and treats null or missing as no timer', () => {
    const timer = { slug: 'two-sum', runningSince: null, elapsedMs: 4000 }
    expect(parseOk({ ...base(), timer }).data.timer).toEqual(timer)
    expect(parseOk({ ...base(), timer: null }).warnings).toEqual([])
    const raw = base()
    delete raw.timer
    expect(parseOk(raw).data.timer).toBeNull()
  })

  it('drops damaged session items and a damaged session', () => {
    const raw = base()
    raw.session.items.push(
      { kind: 'review', minutes: 5, reason: 'no slug' },
      { kind: 'new', slug: 'nope', minutes: 5, reason: 'unknown slug' },
      { kind: 'cram', slug: 'two-sum', minutes: 5, reason: 'unknown kind' },
      { kind: 'drill', minutes: 'ten', reason: 'bad minutes' },
    )
    const result = parseOk(raw)
    expect(result.data.session?.items).toEqual(DOC.session?.items)
    expect(result.warnings).toEqual(['Dropped 4 damaged items from the session plan.'])

    const negative = base()
    negative.session.items = [{ kind: 'review', slug: 'two-sum', minutes: -10, reason: 'x' }]
    negative.session.budget = -5
    expect(parseOk(negative).data.session).toBeNull()

    const broken = parseOk({ ...base(), session: { date: 'today', budget: 60, items: [], createdAt: 1 } })
    expect(broken.data.session).toBeNull()
    expect(broken.warnings).toEqual(['Dropped the session plan because it was damaged.'])
  })
})

describe('summarize', () => {
  it('counts what a document holds', () => {
    expect(summarize(DOC)).toEqual({
      solved: 3,
      attempts: 4,
      notes: 2,
      drills: 2,
      mocks: 1,
      firstDate: '2026-10-20',
      lastDate: TODAY,
    })
  })

  it('reports nothing for an empty document', () => {
    expect(summarize(createEmptyData(TODAY, T0))).toEqual({
      solved: 0,
      attempts: 0,
      notes: 0,
      drills: 0,
      mocks: 0,
      firstDate: null,
      lastDate: null,
    })
  })

  it('does not count notes-only problems as solved, or blank notes as notes', () => {
    const data = setNotes(createEmptyData(TODAY, T0), 'two-sum', { insight: 'x' }, T0 + 1)
    expect(summarize(data)).toMatchObject({ solved: 0, notes: 1 })
    const attempted = logAttempt(createEmptyData(TODAY, T0), 'two-sum', { rating: 'easy' }, TODAY, T0 + 1)
    expect(summarize(attempted)).toMatchObject({ solved: 1, notes: 0 })
  })
})

describe('hostile input', () => {
  const HUGE = 'x'.repeat(2_000_000)
  const HOSTILE: readonly unknown[] = [
    null,
    undefined,
    true,
    0,
    -1,
    1.5,
    1e308,
    Number.NaN,
    Infinity,
    '',
    'x',
    HUGE,
    [],
    [null, 1, 'x'],
    {},
    { __proto__: { polluted: true } },
    JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'),
  ]

  /** Every place in the document, as key paths. Containers come before their children. */
  function pathsOf(value: unknown, path: string[] = []): string[][] {
    if (typeof value !== 'object' || value === null) return [path]
    const here = path.length > 0 ? [path] : []
    return [...here, ...Object.entries(value).flatMap(([key, child]) => pathsOf(child, [...path, key]))]
  }

  function withValueAt(doc: Record<string, any>, path: string[], value: unknown): Record<string, any> {
    const copy = roundTrip(doc) as Record<string, any>
    let target: any = copy
    for (const key of path.slice(0, -1)) target = target[key]
    target[path[path.length - 1]] = value
    return copy
  }

  it('never throws, and anything it accepts is stable and clean, whichever field is damaged', () => {
    const doc = base()
    for (const path of pathsOf(doc)) {
      for (const hostile of HOSTILE) {
        const damaged = withValueAt(doc, path, hostile)
        const label = `${path.join('.')} = ${typeof hostile === 'string' ? hostile.slice(0, 20) : JSON.stringify(hostile)}`
        let result: ReturnType<typeof parse>
        try {
          result = parse(damaged)
        } catch (error) {
          throw new Error(`threw for ${label}: ${String(error)}`)
        }
        if (!result.ok) continue
        const again = parse(roundTrip(result.data))
        expect(again, label).toEqual({ ok: true, data: result.data, warnings: [] })
      }
    }
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
  })

  it.each([
    ['null', null],
    ['a number', 5],
    ['a string', 'cairn'],
    ['an array', [{ app: 'cairn', version: 1 }]],
    ['a 2 MB string', HUGE],
    ['an object with a huge app id', { app: HUGE, version: 1 }],
    ['an object with a huge version', { app: 'cairn', version: HUGE }],
    ['an object with an infinite version', { app: 'cairn', version: Infinity }],
  ])('rejects %s without throwing', (_name, raw) => {
    expect(parse(raw)).toMatchObject({ ok: false })
  })

  it('does not let a "__proto__" key reach the document', () => {
    const raw = JSON.parse(
      '{"app":"cairn","version":1,"problems":{"__proto__":{"attempts":[],"notes":{"insight":"x"}},"two-sum":{"attempts":[],"notes":{"insight":"kept"}}}}',
    )
    const result = parseOk(raw)
    expect(Object.keys(result.data.problems)).toEqual(['two-sum'])
    expect(Object.getPrototypeOf(result.data.problems)).toBe(Object.prototype)
    expect(result.warnings).toContain('Dropped 1 record for unknown problems.')
  })

  it('does not accept inherited names as slugs, patterns or topics', () => {
    const raw = base()
    raw.problems.constructor = { attempts: [], notes: { insight: 'x' } }
    raw.problems.toString = { attempts: [], notes: { insight: 'x' } }
    raw.drills.push({ ...raw.drills[0], answer: 'toString' })
    expect(parseOk(raw).warnings).toEqual([
      'Dropped 2 records for unknown problems.',
      'Dropped 1 damaged drill result.',
    ])
  })
})
