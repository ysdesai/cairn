/**
 * The one store. It holds the document, applies reducers, saves through the storage adapter,
 * keeps an undo stack, and raises the events the celebrations listen for.
 */
import { create } from 'zustand'
import { TOPICS } from '../data'
import type { TopicId } from '../data/types'
import { derive } from '../domain/derive'
import { getToday, now } from './clock'
import * as R from './reducers'
import type { AttemptInput, AttemptPatch } from './reducers'
import type {
  AppData,
  DrillResult,
  MockConfig,
  MockResult,
  Notes,
  SessionPlan,
  Settings,
} from './schema'
import { defaultAdapter, STORAGE_KEYS, type StorageAdapter } from './storage'
import { parseAppData } from './validate'

/** Something worth marking. Rendered by app/Celebrations.tsx, then dismissed. */
export type AppEvent =
  | { id: string; type: 'mastered'; slug: string }
  | { id: string; type: 'topic-complete'; topic: TopicId }
  | { id: string; type: 'streak'; days: number }
  | { id: string; type: 'summit' }

export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365]

interface StoreState {
  status: 'loading' | 'ready'
  data: AppData
  /** Earlier documents, newest last. In memory only. */
  undoStack: AppData[]
  events: AppEvent[]
  /** Set when the browser would not keep the data (private window, quota). */
  storageError: string | null
  /** Set when stored data existed but could not be read. */
  loadError: string | null
}

const UNDO_DEPTH = 20
const SAVE_DELAY_MS = 250

let adapter: StorageAdapter = defaultAdapter()

/** Swap the storage backend (remote sync, tests). Call before `actions.init()`. */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next
}

export const useStore = create<StoreState>(() => ({
  status: 'loading',
  data: R.createEmptyData(getToday(), now()),
  undoStack: [],
  events: [],
  storageError: null,
  loadError: null,
}))

// --- saving ----------------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function saveNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const { data, status } = useStore.getState()
  if (status !== 'ready') return
  try {
    await adapter.set(STORAGE_KEYS.data, JSON.stringify(data))
    if (useStore.getState().storageError) useStore.setState({ storageError: null })
  } catch (err) {
    useStore.setState({ storageError: err instanceof Error ? err.message : 'Could not save' })
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), SAVE_DELAY_MS)
}

// --- events ----------------------------------------------------------------------------------

let eventSeq = 0
const eventId = () => `e${now().toString(36)}${(eventSeq++).toString(36)}`

/** Compare before and after an attempt was logged, and name what was achieved. */
function eventsBetween(prev: AppData, next: AppData): AppEvent[] {
  const today = getToday()
  const a = derive(prev, today)
  const b = derive(next, today)
  const out: AppEvent[] = []

  if (b.counts.solved === b.counts.total && a.counts.solved < a.counts.total) {
    out.push({ id: eventId(), type: 'summit' })
  }
  for (const topic of TOPICS) {
    if (b.topics[topic.id].state === 'complete' && a.topics[topic.id].state !== 'complete') {
      out.push({ id: eventId(), type: 'topic-complete', topic: topic.id })
    }
  }
  for (const view of b.list) {
    if (view.status === 'mastered' && a.problems[view.problem.slug].status !== 'mastered') {
      out.push({ id: eventId(), type: 'mastered', slug: view.problem.slug })
    }
  }
  if (b.streak.current > a.streak.current && STREAK_MILESTONES.includes(b.streak.current)) {
    out.push({ id: eventId(), type: 'streak', days: b.streak.current })
  }
  return out
}

// --- committing ------------------------------------------------------------------------------

interface CommitOptions {
  /** Push the previous document on the undo stack. Default true. */
  undoable?: boolean
  /** Look for achievements between the old and new document. Default false. */
  celebrate?: boolean
}

function commit(next: AppData, options: CommitOptions = {}): void {
  const state = useStore.getState()
  const prev = state.data
  if (next === prev) return
  const events = options.celebrate && !next.demo ? eventsBetween(prev, next) : []
  useStore.setState({
    data: next,
    undoStack: options.undoable === false ? state.undoStack : [...state.undoStack.slice(-(UNDO_DEPTH - 1)), prev],
    events: events.length ? [...state.events, ...events] : state.events,
  })
  scheduleSave()
}

const data = () => useStore.getState().data

/** Swap in a whole new document: nothing from the old one (history, events, a load error) carries over. */
function replaceDocument(next: AppData): void {
  useStore.setState({ data: next, undoStack: [], events: [], loadError: null })
}

/**
 * The document with the attempts, and any finished mock, of an earlier snapshot. Everything
 * else (notes, settings, drill results, the timer) stays as it is now, so undoing an attempt
 * never throws away what was done since.
 */
function rewindAttempts(current: AppData, previous: AppData): AppData {
  const problems: AppData['problems'] = {}
  for (const slug of new Set([...Object.keys(previous.problems), ...Object.keys(current.problems)])) {
    const attempts = previous.problems[slug]?.attempts ?? []
    const notes = (current.problems[slug] ?? previous.problems[slug]).notes
    if (attempts.length > 0 || !R.isBlankNotes(notes)) problems[slug] = { attempts, notes }
  }
  return { ...current, problems, mocks: previous.mocks, updatedAt: now() }
}

let initInFlight: Promise<void> | null = null

async function loadDocument(): Promise<void> {
  const today = getToday()
  let loaded: AppData | null = null
  let loadError: string | null = null
  let storageError: string | null = null
  let raw: string | null = null
  try {
    raw = await adapter.get(STORAGE_KEYS.data)
  } catch {
    // A remote adapter can fail; open an empty document rather than hang on the loading screen.
    storageError = 'Could not load your saved data.'
  }
  if (raw) {
    try {
      const parsed = parseAppData(JSON.parse(raw), today, now())
      if (parsed.ok) loaded = parsed.data
      else loadError = parsed.error
    } catch {
      loadError = 'The stored data is not valid JSON.'
    }
    if (loadError) {
      // Never silently lose a document: park the unreadable copy next to the live one.
      try {
        await adapter.set(`${STORAGE_KEYS.data}:unreadable`, raw)
      } catch {
        // Best effort.
      }
    }
  }
  useStore.setState({
    status: 'ready',
    data: loaded ?? R.createEmptyData(today, now()),
    undoStack: [],
    loadError,
    storageError,
  })
}

// --- actions ---------------------------------------------------------------------------------

export const actions = {
  /** Load the stored document. Call once at startup; a concurrent call shares the same load. */
  init(): Promise<void> {
    if (useStore.getState().status === 'ready') return Promise.resolve()
    initInFlight ??= loadDocument().finally(() => {
      initInFlight = null
    })
    return initInFlight
  },

  // attempts and notes
  logAttempt(slug: string, input: AttemptInput): void {
    commit(R.logAttempt(data(), slug, input, getToday(), now()), { celebrate: true })
  },
  updateAttempt(slug: string, attemptId: string, patch: AttemptPatch): void {
    commit(R.updateAttempt(data(), slug, attemptId, patch, getToday(), now()))
  },
  deleteAttempt(slug: string, attemptId: string): void {
    commit(R.deleteAttempt(data(), slug, attemptId, now()))
  },
  markUnsolved(slug: string): void {
    commit(R.markUnsolved(data(), slug, now()))
  },
  setNotes(slug: string, patch: Partial<Omit<Notes, 'updatedAt'>>): void {
    commit(R.setNotes(data(), slug, patch, now()), { undoable: false })
  },

  // settings
  updateSettings(patch: Parameters<typeof R.updateSettings>[1]): void {
    commit(R.updateSettings(data(), patch, now()), { undoable: false })
  },
  setOnboarded(onboarded: boolean): void {
    commit(R.setOnboarded(data(), onboarded, now()), { undoable: false })
  },

  // drill
  recordDrill(result: Omit<DrillResult, 'at' | 'date'>): void {
    commit(R.recordDrill(data(), result, getToday(), now()), { undoable: false })
  },

  // solve timer
  startTimer(slug: string): void {
    commit(R.startTimer(data(), slug, now()), { undoable: false })
  },
  pauseTimer(): void {
    commit(R.pauseTimer(data(), now()), { undoable: false })
  },
  resetTimer(): void {
    commit(R.resetTimer(data(), now()), { undoable: false })
  },
  clearTimer(): void {
    commit(R.clearTimer(data(), now()), { undoable: false })
  },

  // mock interviews
  startMock(config: MockConfig, slugs: string[]): void {
    commit(R.startMock(data(), config, slugs, now()), { undoable: false })
  },
  markMockProblem(slug: string): void {
    commit(R.markMockProblem(data(), slug, now()), { undoable: false })
  },
  endMock(): void {
    commit(R.endMock(data(), now()), { undoable: false })
  },
  rateMock(results: Record<string, MockResult>): void {
    commit(R.rateMock(data(), results, getToday(), now()), { celebrate: true })
  },
  abandonMock(): void {
    commit(R.abandonMock(data(), now()), { undoable: false })
  },

  // session
  setSession(plan: SessionPlan | null): void {
    commit(R.setSession(data(), plan, now()), { undoable: false })
  },

  /** Step back one undoable change. Returns false when there is nothing to undo. */
  undo(): boolean {
    const { undoStack } = useStore.getState()
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return false
    useStore.setState({ data: rewindAttempts(data(), previous), undoStack: undoStack.slice(0, -1) })
    scheduleSave()
    return true
  },

  dismissEvent(id: string): void {
    useStore.setState((s) => ({ events: s.events.filter((e) => e.id !== id) }))
  },

  // whole-document operations
  /** Replace everything with an imported document. */
  async importData(imported: AppData): Promise<void> {
    await adapter.remove(STORAGE_KEYS.stash)
    replaceDocument({ ...imported, demo: false, updatedAt: now() })
    await saveNow()
  },

  /** Erase everything and start a fresh plan from today. */
  async resetAll(): Promise<void> {
    await adapter.remove(STORAGE_KEYS.stash)
    const fresh = R.createEmptyData(getToday(), now())
    replaceDocument({ ...fresh, onboarded: true })
    await saveNow()
  },

  /** Load the generated demo history. The user's own document is parked and comes back on clearDemo. */
  async loadDemo(): Promise<void> {
    const current = data()
    if (!current.demo) {
      await adapter.set(STORAGE_KEYS.stash, JSON.stringify(current)).catch(() => undefined)
    }
    const { generateDemoData } = await import('../domain/demo')
    replaceDocument(generateDemoData(getToday(), now()))
    await saveNow()
  },

  /** Leave the demo: restore the parked document, or start empty if there was none. */
  async clearDemo(): Promise<void> {
    const today = getToday()
    let restored: AppData | null = null
    const raw = await adapter.get(STORAGE_KEYS.stash)
    if (raw) {
      try {
        const parsed = parseAppData(JSON.parse(raw), today, now())
        if (parsed.ok) restored = parsed.data
      } catch {
        restored = null
      }
    }
    await adapter.remove(STORAGE_KEYS.stash)
    replaceDocument(restored ?? { ...R.createEmptyData(today, now()), onboarded: true })
    await saveNow()
  },

  /** Write pending changes immediately (used when the page is being hidden). */
  flush(): void {
    if (saveTimer) void saveNow()
  },
}

export type Actions = typeof actions

// Save before the tab goes away, and pick up changes made in another tab.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => actions.flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') actions.flush()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEYS.data || !event.newValue) return
    if (useStore.getState().status !== 'ready') return
    try {
      const parsed = parseAppData(JSON.parse(event.newValue), getToday(), now())
      if (parsed.ok && parsed.data.updatedAt > data().updatedAt) {
        useStore.setState({ data: parsed.data, undoStack: [] })
      }
    } catch {
      // Ignore a half-written value; the next event will carry the whole document.
    }
  })
}

export type { AttemptInput, AttemptPatch, Settings }
