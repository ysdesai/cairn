import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayISO } from '../domain/dates'
import { createEmptyData, logAttempt } from './reducers'
import type { MockConfig } from './schema'
import { MemoryAdapter, STORAGE_KEYS, type StorageAdapter } from './storage'
import { actions, setStorageAdapter, useStore, VOLATILE_STORAGE_MESSAGE } from './store'

// Local noon, so the local date is the same in every time zone.
const NOW = new Date(2026, 10, 12, 12, 0, 0).getTime()
const TODAY = todayISO(new Date(NOW))
const DAY = 24 * 60 * 60 * 1000
const UNREADABLE_KEY = `${STORAGE_KEYS.data}:unreadable`
const TWO_SUM = 'two-sum'
const ANAGRAM = 'valid-anagram'

const state = () => useStore.getState()
const dayOffset = (days: number) => todayISO(new Date(NOW + days * DAY))

/** Let the debounced save fire and its write finish. */
const settle = () => vi.advanceTimersByTimeAsync(500)

async function stored(adapter: StorageAdapter) {
  const raw = await adapter.get(STORAGE_KEYS.data)
  return raw === null ? null : JSON.parse(raw)
}

/** Back to a store that has not been initialized, on the given adapter. */
function resetStore(adapter: StorageAdapter) {
  setStorageAdapter(adapter)
  useStore.setState({
    status: 'loading',
    data: createEmptyData(TODAY, NOW),
    undoStack: [],
    events: [],
    storageError: null,
    loadError: null,
  })
}

let adapter: MemoryAdapter

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  adapter = new MemoryAdapter()
  resetStore(adapter)
})

afterEach(async () => {
  await vi.runAllTimersAsync()
  vi.useRealTimers()
})

describe('init', () => {
  it('starts an empty document when nothing is stored', async () => {
    await actions.init()
    expect(state().status).toBe('ready')
    expect(state().loadError).toBeNull()
    expect(state().data.problems).toEqual({})
    expect(state().data.settings.startDate).toBe(TODAY)
    expect(state().data.onboarded).toBe(false)
    expect(state().undoStack).toEqual([])
    // Opening the app alone writes nothing.
    await settle()
    expect(await adapter.get(STORAGE_KEYS.data)).toBeNull()
  })

  it('does nothing the second time it is called', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await actions.init()
    expect(Object.keys(state().data.problems)).toEqual([TWO_SUM])
  })

  it('starts empty with a storageError when the adapter cannot read, instead of hanging', async () => {
    const broken: StorageAdapter = {
      get: () => Promise.reject(new Error('Network down')),
      set: (key, value) => adapter.set(key, value),
      remove: (key) => adapter.remove(key),
    }
    resetStore(broken)
    await actions.init()
    expect(state().status).toBe('ready')
    expect(state().storageError).toBeTruthy()
    expect(state().loadError).toBeNull()
    expect(state().data.problems).toEqual({})
  })

  it('also copes with an adapter that throws before returning a promise', async () => {
    const broken: StorageAdapter = {
      get: () => {
        throw new Error('Not connected')
      },
      set: (key, value) => adapter.set(key, value),
      remove: (key) => adapter.remove(key),
    }
    resetStore(broken)
    await actions.init()
    expect(state().status).toBe('ready')
    expect(state().storageError).toBeTruthy()
  })

  it('shares one load between concurrent calls', async () => {
    const get = vi.spyOn(adapter, 'get')
    const first = actions.init()
    const second = actions.init()
    expect(second).toBe(first)
    await Promise.all([first, second])
    expect(get).toHaveBeenCalledTimes(1)
    expect(state().status).toBe('ready')
  })

  it('sets loadError and keeps a copy when the stored text is not JSON', async () => {
    await adapter.set(STORAGE_KEYS.data, '{"app": "cairn", oops')
    await actions.init()
    expect(state().status).toBe('ready')
    expect(state().loadError).toMatch(/not valid JSON/)
    expect(state().data.problems).toEqual({})
    expect(await adapter.get(UNREADABLE_KEY)).toBe('{"app": "cairn", oops')
  })

  it('sets loadError and keeps a copy when the JSON is not a Cairn document', async () => {
    const raw = JSON.stringify({ app: 'something-else', version: 1 })
    await adapter.set(STORAGE_KEYS.data, raw)
    await actions.init()
    expect(state().loadError).toBeTruthy()
    expect(state().data.problems).toEqual({})
    expect(await adapter.get(UNREADABLE_KEY)).toBe(raw)
  })

  it('leaves the parked copy alone when the user carries on and saves', async () => {
    await adapter.set(STORAGE_KEYS.data, 'garbage')
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    expect((await stored(adapter)).problems[TWO_SUM].attempts).toHaveLength(1)
    expect(await adapter.get(UNREADABLE_KEY)).toBe('garbage')
  })
})

describe('saving', () => {
  it('saves a logged attempt after a short delay, and a second init reads it back', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'struggled', minutes: 22, mistakes: ['edge-case'] })
    const [logged] = state().data.problems[TWO_SUM].attempts
    expect(logged).toMatchObject({ rating: 'struggled', minutes: 22, date: TODAY, at: NOW })

    // Changes are batched: nothing is written yet.
    expect(await adapter.get(STORAGE_KEYS.data)).toBeNull()
    await settle()
    expect((await stored(adapter)).problems[TWO_SUM].attempts).toEqual([logged])

    resetStore(adapter)
    await actions.init()
    expect(state().data.problems[TWO_SUM].attempts).toEqual([logged])
    expect(state().loadError).toBeNull()
    expect(state().undoStack).toEqual([])
  })

  it('writes pending changes at once on flush', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.flush()
    await vi.advanceTimersByTimeAsync(0)
    expect((await stored(adapter)).problems[TWO_SUM].attempts).toHaveLength(1)
    // The timer was spent by the flush; there is nothing left to write.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('batches several changes into one write', async () => {
    const set = vi.spyOn(adapter, 'set')
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.logAttempt(ANAGRAM, { rating: 'easy' })
    actions.setNotes(TWO_SUM, { insight: 'Complement lookup.' })
    await settle()
    expect(set).toHaveBeenCalledTimes(1)
    expect((await stored(adapter)).problems[TWO_SUM].notes.insight).toBe('Complement lookup.')
  })

  it('neither changes nor saves anything for a change that does nothing', async () => {
    await actions.init()
    const before = state().data
    actions.logAttempt('no-such-problem', { rating: 'easy' })
    actions.deleteAttempt(TWO_SUM, 'missing')
    actions.markUnsolved(TWO_SUM)
    actions.setOnboarded(false)
    expect(state().data).toBe(before)
    expect(state().undoStack).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    await settle()
    expect(await adapter.get(STORAGE_KEYS.data)).toBeNull()
  })

  it('reports a storage failure and clears it once a write works again', async () => {
    let failing = true
    const flaky: StorageAdapter = {
      get: (key) => adapter.get(key),
      set: async (key, value) => {
        if (failing) throw new Error('Quota exceeded')
        await adapter.set(key, value)
      },
      remove: (key) => adapter.remove(key),
    }
    resetStore(flaky)
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    expect(state().storageError).toBe('Quota exceeded')

    failing = false
    actions.logAttempt(ANAGRAM, { rating: 'easy' })
    await settle()
    expect(state().storageError).toBeNull()
    expect(Object.keys((await stored(adapter)).problems).sort()).toEqual([TWO_SUM, ANAGRAM])
  })
})

describe('undo', () => {
  it('steps back one attempt at a time and saves the result', async () => {
    await actions.init()
    expect(actions.undo()).toBe(false)

    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.logAttempt(TWO_SUM, { rating: 'help' })
    expect(state().data.problems[TWO_SUM].attempts).toHaveLength(2)

    expect(actions.undo()).toBe(true)
    expect(state().data.problems[TWO_SUM].attempts.map((a) => a.rating)).toEqual(['easy'])
    await settle()
    expect((await stored(adapter)).problems[TWO_SUM].attempts).toHaveLength(1)

    expect(actions.undo()).toBe(true)
    expect(state().data.problems).toEqual({})
    expect(actions.undo()).toBe(false)
    expect(state().undoStack).toEqual([])
  })

  it('keeps notes, settings and drill results made after the attempt', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.setNotes(TWO_SUM, { insight: 'Hash the complement.' })
    actions.setNotes(ANAGRAM, { insight: 'Count letters.' })
    actions.updateSettings({ dailyReviewCap: 9 })
    actions.recordDrill({ slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: 900 })

    expect(actions.undo()).toBe(true)
    const { data } = state()
    expect(data.problems[TWO_SUM].attempts).toEqual([])
    expect(data.problems[TWO_SUM].notes.insight).toBe('Hash the complement.')
    expect(data.problems[ANAGRAM].notes.insight).toBe('Count letters.')
    expect(data.settings.dailyReviewCap).toBe(9)
    expect(data.drills).toHaveLength(1)
  })

  it('is newer than the document it replaced, so other tabs accept it', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    const logged = state().data.updatedAt
    await vi.advanceTimersByTimeAsync(1000)
    actions.undo()
    expect(state().data.updatedAt).toBeGreaterThan(logged)
  })

  it('does not record changes that are not meant to be undone', async () => {
    await actions.init()
    actions.setNotes(TWO_SUM, { insight: 'x' })
    actions.updateSettings({ dailyReviewCap: 8 })
    actions.startTimer(TWO_SUM)
    expect(state().undoStack).toEqual([])
  })

  it('keeps at most twenty steps', async () => {
    await actions.init()
    for (let i = 0; i < 25; i++) actions.logAttempt(TWO_SUM, { rating: 'easy' })
    expect(state().undoStack).toHaveLength(20)
  })
})

describe('events', () => {
  it('raises "mastered" when an attempt clears the ladder, and nothing before that', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: '2026-06-01' })
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: '2026-07-01' })
    expect(state().events).toEqual([])
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: '2026-09-01' })
    expect(state().events).toMatchObject([{ type: 'mastered', slug: TWO_SUM }])

    const [event] = state().events
    actions.dismissEvent(event.id)
    expect(state().events).toEqual([])
  })

  it('raises a streak event at a milestone, once', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: dayOffset(-2) })
    actions.logAttempt(ANAGRAM, { rating: 'easy', date: dayOffset(-1) })
    expect(state().events).toEqual([])
    actions.logAttempt('contains-duplicate', { rating: 'easy' })
    expect(state().events).toMatchObject([{ type: 'streak', days: 3 }])
    // Another attempt on the same day does not extend the streak.
    actions.logAttempt('group-anagrams', { rating: 'easy' })
    expect(state().events).toHaveLength(1)
  })

  it('raises "topic-complete" when the last problem of a topic is solved', async () => {
    await actions.init()
    const topic = ['contains-duplicate', 'valid-anagram', 'two-sum', 'group-anagrams', 'top-k-frequent-elements',
      'product-of-array-except-self', 'valid-sudoku', 'encode-and-decode-strings', 'longest-consecutive-sequence']
    topic.forEach((slug) => actions.logAttempt(slug, { rating: 'easy', date: '2026-10-01' }))
    const types = state().events.map((e) => e.type)
    expect(types.filter((t) => t === 'topic-complete')).toHaveLength(1)
    expect(state().events.find((e) => e.type === 'topic-complete')).toMatchObject({ topic: 'arrays-hashing' })
  })

  it('does not celebrate edits to old attempts', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: '2026-06-01' })
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: '2026-07-01' })
    actions.logAttempt(TWO_SUM, { rating: 'help', date: '2026-09-01' })
    expect(state().events).toEqual([])
    const id = state().data.problems[TWO_SUM].attempts[2].id
    actions.updateAttempt(TWO_SUM, id, { rating: 'easy' })
    // The edit made it mastered, but only logging marks an achievement.
    expect(state().data.problems[TWO_SUM].attempts[2].rating).toBe('easy')
    expect(state().events).toEqual([])
  })
})

describe('importData', () => {
  it('replaces the document, drops undo history, clears the parked demo and saves', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await adapter.set(STORAGE_KEYS.stash, 'parked')

    const incoming = logAttempt(createEmptyData('2026-09-01', NOW - DAY), ANAGRAM, { rating: 'help' }, TODAY, NOW - DAY)
    await actions.importData({ ...incoming, demo: true, onboarded: true })

    const { data } = state()
    expect(Object.keys(data.problems)).toEqual([ANAGRAM])
    expect(data.settings.startDate).toBe('2026-09-01')
    expect(data.onboarded).toBe(true)
    expect(data.demo).toBe(false)
    expect(data.updatedAt).toBe(NOW)
    expect(state().undoStack).toEqual([])
    expect(await adapter.get(STORAGE_KEYS.stash)).toBeNull()
    expect(Object.keys((await stored(adapter)).problems)).toEqual([ANAGRAM])
  })

  it('clears an earlier load error', async () => {
    await adapter.set(STORAGE_KEYS.data, 'garbage')
    await actions.init()
    expect(state().loadError).not.toBeNull()
    await actions.importData(createEmptyData(TODAY, NOW))
    expect(state().loadError).toBeNull()
  })
})

describe('resetAll', () => {
  it('erases everything, starts a plan today and skips the welcome', async () => {
    await actions.init()
    actions.updateSettings({ startDate: '2026-01-01', dailyReviewCap: 12 })
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.recordDrill({ slug: TWO_SUM, answer: 'hashing', picked: 'hashing', correct: true, ms: 900 })
    await adapter.set(STORAGE_KEYS.stash, 'parked')

    await actions.resetAll()

    const { data } = state()
    expect(data.problems).toEqual({})
    expect(data.drills).toEqual([])
    expect(data.settings.startDate).toBe(TODAY)
    expect(data.settings.dailyReviewCap).toBe(5)
    expect(data.onboarded).toBe(true)
    expect(state().undoStack).toEqual([])
    expect(actions.undo()).toBe(false)
    expect(await adapter.get(STORAGE_KEYS.stash)).toBeNull()
    const saved = await stored(adapter)
    expect(saved.problems).toEqual({})
    expect(saved.onboarded).toBe(true)

    resetStore(adapter)
    await actions.init()
    expect(state().data.problems).toEqual({})
  })

  it('clears an earlier load error', async () => {
    await adapter.set(STORAGE_KEYS.data, 'garbage')
    await actions.init()
    await actions.resetAll()
    expect(state().loadError).toBeNull()
  })
})

// --- undo and mocks ----------------------------------------------------------------------------

const MOCK_CONFIG: MockConfig = { mix: 'medium-medium', pool: 'any', topics: [], minutes: 45 }

describe('undo and a mock', () => {
  it('never cancels a mock that started after the attempt', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.startMock(MOCK_CONFIG, [ANAGRAM, 'group-anagrams'])
    expect(state().data.mocks).toHaveLength(1)

    expect(actions.undo()).toBe(true)
    // The attempt is undone; the mock in progress is exactly as it was.
    expect(state().data.problems[TWO_SUM]).toBeUndefined()
    expect(state().data.mocks).toHaveLength(1)
    expect(state().data.mocks[0]).toMatchObject({ status: 'running', slugs: [ANAGRAM, 'group-anagrams'] })
  })

  it('leaves a mock waiting for ratings, and one that was abandoned, as they are', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    actions.startMock(MOCK_CONFIG, [ANAGRAM])
    actions.endMock()
    expect(state().data.mocks[0].status).toBe('review')
    actions.undo()
    expect(state().data.mocks[0].status).toBe('review')
    actions.abandonMock()
    actions.logAttempt(TWO_SUM, { rating: 'help' })
    actions.undo()
    expect(state().data.mocks[0].status).toBe('abandoned')
  })

  it('undoes the ratings of a mock it rated: attempts gone, the mock back to waiting', async () => {
    await actions.init()
    actions.startMock(MOCK_CONFIG, [ANAGRAM, 'group-anagrams'])
    actions.endMock()
    actions.rateMock({
      [ANAGRAM]: { outcome: 'easy', minutes: 12, mistakes: [] },
      'group-anagrams': { outcome: 'unfinished', minutes: null, mistakes: ['out-of-time'] },
    })
    expect(state().data.mocks[0].status).toBe('done')
    expect(state().data.problems[ANAGRAM].attempts).toHaveLength(1)

    expect(actions.undo()).toBe(true)
    expect(state().data.mocks[0]).toMatchObject({ status: 'review', results: {} })
    expect(state().data.problems[ANAGRAM]).toBeUndefined()
  })

  it('keeps a mock that started later while undoing an earlier rated one', async () => {
    await actions.init()
    actions.startMock(MOCK_CONFIG, [ANAGRAM])
    actions.endMock()
    actions.rateMock({ [ANAGRAM]: { outcome: 'easy', minutes: 12, mistakes: [] } })
    actions.startMock(MOCK_CONFIG, [TWO_SUM])
    actions.undo()
    expect(state().data.mocks.map((m) => m.status)).toEqual(['review', 'running'])
  })
})

// --- demo and celebrations ---------------------------------------------------------------------

describe('the demo', () => {
  it('celebrates in demo mode too, since events are never stored: mastered is raised', async () => {
    await actions.init()
    // A document flagged as demo with a problem one Easy away from mastery.
    const base = createEmptyData(TODAY, NOW)
    let doc = logAttempt(base, TWO_SUM, { rating: 'easy', date: '2026-06-01' }, TODAY, NOW - 3)
    doc = logAttempt(doc, TWO_SUM, { rating: 'easy', date: '2026-07-01' }, TODAY, NOW - 2)
    await actions.importData({ ...doc, onboarded: true })
    useStore.setState({ data: { ...state().data, demo: true } })
    actions.logAttempt(TWO_SUM, { rating: 'easy', date: '2026-09-01' })
    expect(state().events).toMatchObject([{ type: 'mastered', slug: TWO_SUM }])
  })

  it('does not load when the user\'s own data cannot be set aside, and says why', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    const own = state().data
    const failing: StorageAdapter = {
      get: (key) => adapter.get(key),
      set: (key, value) =>
        key === STORAGE_KEYS.stash ? Promise.reject(new Error('QuotaExceededError')) : adapter.set(key, value),
      remove: (key) => adapter.remove(key),
    }
    setStorageAdapter(failing)
    await actions.loadDemo()
    expect(state().data).toBe(own)
    expect(state().data.demo).toBe(false)
    expect(state().storageError).toMatch(/set aside/)
    await settle()
    // Nothing was overwritten: the stored document is still the user's own.
    expect((await stored(adapter)).demo).toBe(false)
    expect(Object.keys((await stored(adapter)).problems)).toEqual([TWO_SUM])
  })

  it('parks the user\'s data and brings it back on exit, newer than the demo it replaces', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    await actions.loadDemo()
    const demoStamp = state().data.updatedAt
    await vi.advanceTimersByTimeAsync(2000)
    await actions.clearDemo()
    expect(state().data.demo).toBe(false)
    expect(Object.keys(state().data.problems)).toEqual([TWO_SUM])
    expect(state().data.updatedAt).toBeGreaterThan(demoStamp)
    expect(await adapter.get(STORAGE_KEYS.stash)).toBeNull()
  })
})

// --- several tabs ------------------------------------------------------------------------------

/** An adapter on shared memory whose `subscribe` listener can be fed what another tab wrote. */
function sharedAdapter(shared: MemoryAdapter) {
  const listeners = new Set<(value: string | null) => void>()
  const tab: StorageAdapter = {
    get: (key) => shared.get(key),
    set: (key, value) => shared.set(key, value),
    remove: (key) => shared.remove(key),
    subscribe: (key, listener) => {
      if (key !== STORAGE_KEYS.data) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return { tab, emit: (value: string | null) => listeners.forEach((fn) => fn(value)), listeners }
}

describe('another tab', () => {
  it('subscribes once, for the data key, after loading', async () => {
    const { tab, listeners } = sharedAdapter(adapter)
    resetStore(tab)
    expect(listeners.size).toBe(0)
    await actions.init()
    expect(listeners.size).toBe(1)
  })

  it('takes a newer document and ignores an older one', async () => {
    const { tab, emit } = sharedAdapter(adapter)
    resetStore(tab)
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    const mine = state().data

    const newer = logAttempt(mine, ANAGRAM, { rating: 'easy' }, TODAY, NOW + 5000)
    emit(JSON.stringify(newer))
    expect(Object.keys(state().data.problems).sort()).toEqual([ANAGRAM, TWO_SUM].sort())

    const older = { ...createEmptyData(TODAY, NOW - 9000), onboarded: true }
    emit(JSON.stringify(older))
    expect(Object.keys(state().data.problems).sort()).toEqual([ANAGRAM, TWO_SUM].sort())
    emit(null)
    emit('{ half a docum')
    expect(Object.keys(state().data.problems)).toHaveLength(2)
  })

  it('takes a document whose demo flag differs, even with an older stamp', async () => {
    const { tab, emit } = sharedAdapter(adapter)
    resetStore(tab)
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    const swapped = { ...createEmptyData(TODAY, NOW - 9000), onboarded: true, demo: true }
    emit(JSON.stringify(swapped))
    expect(state().data.demo).toBe(true)
    expect(state().data.problems).toEqual({})
  })

  it('exits the demo in one tab and the other follows, keeping the restored data', async () => {
    // Tab A has its own data and loads the demo; tab B (same storage) follows it.
    const own = logAttempt(createEmptyData(TODAY, NOW - DAY), TWO_SUM, { rating: 'easy' }, TODAY, NOW - DAY)
    await adapter.set(STORAGE_KEYS.data, JSON.stringify({ ...own, onboarded: true }))
    const { tab, emit } = sharedAdapter(adapter)
    resetStore(tab)
    await actions.init()
    await actions.loadDemo()
    const demoText = (await adapter.get(STORAGE_KEYS.data))!
    expect(state().data.demo).toBe(true)

    // Tab B receives the demo, then tab A exits it.
    await vi.advanceTimersByTimeAsync(1000)
    await actions.clearDemo()
    const restoredText = (await adapter.get(STORAGE_KEYS.data))!
    expect(JSON.parse(restoredText).demo).toBe(false)
    expect(JSON.parse(restoredText).updatedAt).toBeGreaterThan(JSON.parse(demoText).updatedAt)

    // Tab B's side of it: it holds the demo, and gets the restored document.
    useStore.setState({ data: { ...JSON.parse(demoText) } })
    emit(restoredText)
    expect(state().data.demo).toBe(false)
    expect(Object.keys(state().data.problems)).toEqual([TWO_SUM])
  })

  it('does not write a stale tab\'s demo over a document another tab swapped in', async () => {
    const own = { ...logAttempt(createEmptyData(TODAY, NOW - DAY), TWO_SUM, { rating: 'easy' }, TODAY, NOW - DAY), onboarded: true }
    await adapter.set(STORAGE_KEYS.data, JSON.stringify(own))
    // This tab loaded the demo state and has not heard that another tab left it.
    await actions.init()
    await actions.loadDemo()
    await settle()
    await vi.advanceTimersByTimeAsync(5000)
    // Another tab exits the demo: the stored document is the user's own, and newer.
    const restored = { ...own, updatedAt: Date.now() }
    await adapter.set(STORAGE_KEYS.data, JSON.stringify(restored))
    await vi.advanceTimersByTimeAsync(1000)
    // A note typed here must not bring the demo back.
    actions.setNotes(TWO_SUM, { insight: 'typed in the stale tab' })
    await settle()
    const saved = await stored(adapter)
    expect(saved.demo).toBe(false)
    expect(Object.keys(saved.problems)).toEqual([TWO_SUM])
    expect(state().data.demo).toBe(false)
  })

  it('still saves normally when nobody else wrote', async () => {
    await actions.init()
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    actions.logAttempt(ANAGRAM, { rating: 'easy' })
    await settle()
    expect(Object.keys((await stored(adapter)).problems).sort()).toEqual([ANAGRAM, TWO_SUM].sort())
  })
})

// --- storage that is not there -----------------------------------------------------------------

describe('storage that does not keep anything', () => {
  it('warns from the start with a volatile adapter, and keeps warning after saves', async () => {
    resetStore(new MemoryAdapter({ volatile: true }))
    await actions.init()
    expect(state().storageError).toBe(VOLATILE_STORAGE_MESSAGE)
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    expect(state().storageError).toBe(VOLATILE_STORAGE_MESSAGE)
    expect(state().data.problems[TWO_SUM].attempts).toHaveLength(1)
  })

  it('does not warn on an ordinary adapter', async () => {
    await actions.init()
    expect(state().storageError).toBeNull()
  })

  it('takes the adapter given to init, without touching the default one', async () => {
    const given = new MemoryAdapter()
    await given.set(STORAGE_KEYS.data, JSON.stringify({ ...createEmptyData(TODAY, NOW), onboarded: true, demo: false }))
    useStore.setState({ status: 'loading' })
    await actions.init(given)
    expect(state().status).toBe('ready')
    expect(state().data.onboarded).toBe(true)
    actions.logAttempt(TWO_SUM, { rating: 'easy' })
    await settle()
    expect(Object.keys(JSON.parse((await given.get(STORAGE_KEYS.data))!).problems)).toEqual([TWO_SUM])
    expect(await adapter.get(STORAGE_KEYS.data)).toBeNull()
  })
})

describe('importData and a backup without the flag', () => {
  it('keeps the plan and never reopens the welcome', async () => {
    await actions.init()
    const incoming = logAttempt(createEmptyData('2026-09-01', NOW - DAY), ANAGRAM, { rating: 'help' }, TODAY, NOW - DAY)
    const withPlan = { ...incoming, settings: { ...incoming.settings, targetDate: '2027-01-31' }, onboarded: false }
    await actions.importData(withPlan)
    expect(state().data.onboarded).toBe(true)
    expect(state().data.settings).toMatchObject({ startDate: '2026-09-01', targetDate: '2027-01-31' })
    expect((await stored(adapter)).onboarded).toBe(true)
  })
})
