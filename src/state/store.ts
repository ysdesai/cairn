/**
 * The one store. It holds the document, applies reducers, saves through the storage adapter,
 * keeps an undo stack, and raises the events the celebrations listen for.
 *
 * Several tabs: the adapter's `subscribe` (localStorage: the `storage` event) delivers what other
 * tabs write. A document is taken over when it is newer than ours or when its demo flag differs
 * (the other tab swapped the whole document). Before a save, the stored copy is looked at: if
 * another tab replaced the document (its demo flag changed) since this tab last read or wrote it,
 * this tab's stale copy is dropped for the stored one rather than written over it.
 *
 * Undo reverts the attempts of the last undoable change only. Everything else (notes, settings,
 * drills, the timer, and any mock that started since) stays as it is now; a mock that the undone
 * change rated goes back to waiting for its ratings.
 *
 * Celebrations are raised for logged and rated attempts in the demo too. They are never stored,
 * so trying the reward moments on demo data costs nothing.
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
  /** Set when the browser would not keep the data (blocked storage, private window, quota). */
  storageError: string | null
  /** Set when stored data existed but could not be read. */
  loadError: string | null
}

const UNDO_DEPTH = 20
const SAVE_DELAY_MS = 250

/** Shown from the first moment when the browser keeps nothing between visits. */
export const VOLATILE_STORAGE_MESSAGE =
  'This browser is not keeping data between visits, so progress will be lost when the page closes. Export a backup from Settings to keep it.'
/** Shown when loading the demo was refused because the user's own data could not be set aside. */
export const STASH_FAILED_MESSAGE =
  'Your own data could not be set aside, so the demo was not loaded and nothing was changed. Export a backup from Settings, then try again.'

// Created on first use, never at import: nothing probes the browser's storage until the store needs it.
let adapter: StorageAdapter | null = null
const storage = (): StorageAdapter => (adapter ??= defaultAdapter())
let unsubscribe: (() => void) | null = null

/** Swap the storage backend (remote sync, tests). Call before `actions.init()`, or pass it to init. */
export function setStorageAdapter(next: StorageAdapter): void {
  unsubscribe?.()
  unsubscribe = null
  adapter = next
  synced = { updatedAt: 0, raw: null }
}

/** What this tab last read from or wrote to storage: the document's updatedAt and its exact text. */
let synced: { updatedAt: number; raw: string | null } = { updatedAt: 0, raw: null }

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

/**
 * Stale-tab protection. If the stored document is not the one this tab last read or wrote, and
 * another tab swapped the whole document (the demo flag differs) after that, this tab's copy is
 * the old one: take the stored document instead of overwriting it. Returns true when it did.
 */
async function adoptIfReplaced(mine: AppData): Promise<boolean> {
  let raw: string | null
  try {
    raw = await storage().get(STORAGE_KEYS.data)
  } catch {
    return false
  }
  if (raw === null || raw === synced.raw) return false
  try {
    const parsed = parseAppData(JSON.parse(raw), getToday(), now())
    if (!parsed.ok || parsed.data.updatedAt <= synced.updatedAt || parsed.data.demo === mine.demo) return false
    synced = { updatedAt: parsed.data.updatedAt, raw }
    useStore.setState({ data: parsed.data, undoStack: [] })
    return true
  } catch {
    return false
  }
}

async function saveNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const { data, status } = useStore.getState()
  if (status !== 'ready') return
  try {
    if (await adoptIfReplaced(data)) return
    const text = JSON.stringify(data)
    await storage().set(STORAGE_KEYS.data, text)
    synced = { updatedAt: data.updatedAt, raw: text }
    // A volatile adapter "succeeds" into memory; its warning stays for the whole visit.
    if (useStore.getState().storageError && !storage().volatile) useStore.setState({ storageError: null })
  } catch (err) {
    useStore.setState({ storageError: err instanceof Error ? err.message : 'Could not save' })
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), SAVE_DELAY_MS)
}

/** Another tab (or device) wrote the document. Take it if it is newer, or if the whole document was swapped. */
function onExternalChange(value: string | null): void {
  if (!value || useStore.getState().status !== 'ready') return
  try {
    const parsed = parseAppData(JSON.parse(value), getToday(), now())
    if (!parsed.ok) return
    const mine = data()
    if (parsed.data.updatedAt > mine.updatedAt || parsed.data.demo !== mine.demo) {
      synced = { updatedAt: parsed.data.updatedAt, raw: value }
      useStore.setState({ data: parsed.data, undoStack: [] })
    }
  } catch {
    // Ignore a half-written value; the next event will carry the whole document.
  }
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
  // The demo celebrates too (nothing about an event is stored), so the reward moments can be seen
  // on demo data without touching real progress.
  const events = options.celebrate ? eventsBetween(prev, next) : []
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
 * The mocks after undoing: the ones there are now, except that a mock the undone change rated
 * (it is done now, and was waiting for its ratings in the snapshot) goes back to that state.
 * A mock that started after the snapshot, or is running, is never touched.
 */
function rewindMocks(current: AppData, previous: AppData): AppData['mocks'] {
  return current.mocks.map((mock) => {
    const before = previous.mocks.find((m) => m.id === mock.id)
    return before && before.status !== 'done' && mock.status === 'done' ? before : mock
  })
}

/**
 * The document with the attempts of an earlier snapshot, and any mock rating undone. Everything
 * else (notes, settings, drill results, the timer, a mock in progress) stays as it is now, so
 * undoing an attempt never throws away what was done since.
 */
function rewindAttempts(current: AppData, previous: AppData): AppData {
  const problems: AppData['problems'] = {}
  for (const slug of new Set([...Object.keys(previous.problems), ...Object.keys(current.problems)])) {
    const attempts = previous.problems[slug]?.attempts ?? []
    const notes = (current.problems[slug] ?? previous.problems[slug]).notes
    if (attempts.length > 0 || !R.isBlankNotes(notes)) problems[slug] = { attempts, notes }
  }
  return { ...current, problems, mocks: rewindMocks(current, previous), updatedAt: now() }
}

let initInFlight: Promise<void> | null = null

async function loadDocument(): Promise<void> {
  const today = getToday()
  let loaded: AppData | null = null
  let loadError: string | null = null
  let storageError: string | null = null
  let raw: string | null = null
  try {
    raw = await storage().get(STORAGE_KEYS.data)
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
        await storage().set(`${STORAGE_KEYS.data}:unreadable`, raw)
      } catch {
        // Best effort.
      }
    }
  }
  // When the browser blocks storage the app still runs, from memory; say so from the start.
  if (storageError === null && storage().volatile) storageError = VOLATILE_STORAGE_MESSAGE
  const document = loaded ?? R.createEmptyData(today, now())
  synced = { updatedAt: loaded ? document.updatedAt : 0, raw: loaded ? raw : null }
  useStore.setState({
    status: 'ready',
    data: document,
    undoStack: [],
    loadError,
    storageError,
  })
  // Hear about other tabs, if the adapter can tell us.
  unsubscribe?.()
  unsubscribe = storage().subscribe?.(STORAGE_KEYS.data, onExternalChange) ?? null
}

// --- actions ---------------------------------------------------------------------------------

export const actions = {
  /**
   * Load the stored document. Call once at startup; a concurrent call shares the same load.
   * Pass an adapter to use it instead of the browser's storage (it replaces any earlier one).
   */
  init(withAdapter?: StorageAdapter): Promise<void> {
    if (useStore.getState().status === 'ready') return Promise.resolve()
    if (withAdapter && !initInFlight) setStorageAdapter(withAdapter)
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
  /**
   * Replace everything with an imported document. Restoring a backup is never a first run, so the
   * welcome stays closed and the imported plan dates are kept.
   */
  async importData(imported: AppData): Promise<void> {
    await storage().remove(STORAGE_KEYS.stash)
    replaceDocument({ ...imported, demo: false, onboarded: true, updatedAt: now() })
    await saveNow()
  },

  /** Erase everything and start a fresh plan from today. */
  async resetAll(): Promise<void> {
    await storage().remove(STORAGE_KEYS.stash)
    const fresh = R.createEmptyData(getToday(), now())
    replaceDocument({ ...fresh, onboarded: true })
    await saveNow()
  },

  /**
   * Load the generated demo history. The user's own document is parked first and comes back on
   * clearDemo. If it cannot be parked the demo is not loaded at all: the document stays as it is
   * and storageError says why, so a failed write can never cost the user their progress.
   */
  async loadDemo(): Promise<void> {
    const current = data()
    if (!current.demo) {
      try {
        await storage().set(STORAGE_KEYS.stash, JSON.stringify(current))
      } catch {
        useStore.setState({ storageError: STASH_FAILED_MESSAGE })
        return
      }
    }
    const { generateDemoData } = await import('../domain/demo')
    replaceDocument(generateDemoData(getToday(), now()))
    await saveNow()
  },

  /** Leave the demo: restore the parked document, or start empty if there was none. */
  async clearDemo(): Promise<void> {
    const today = getToday()
    let restored: AppData | null = null
    const raw = await storage().get(STORAGE_KEYS.stash)
    if (raw) {
      try {
        const parsed = parseAppData(JSON.parse(raw), today, now())
        if (parsed.ok) restored = parsed.data
      } catch {
        restored = null
      }
    }
    await storage().remove(STORAGE_KEYS.stash)
    // The restored document is older than the demo it replaces. Stamping it now makes it the
    // newest, so other tabs that still show the demo take it instead of ignoring it.
    const next = restored ? { ...restored, demo: false, updatedAt: now() } : { ...R.createEmptyData(today, now()), onboarded: true }
    replaceDocument(next)
    await saveNow()
  },

  /** Write pending changes immediately (used when the page is being hidden). */
  flush(): void {
    if (saveTimer) void saveNow()
  },
}

export type Actions = typeof actions

// Save before the tab goes away. (Hearing about other tabs is the adapter's job: see `subscribe`.)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => actions.flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') actions.flush()
  })
}

export type { AttemptInput, AttemptPatch, Settings }
