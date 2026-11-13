/**
 * The storage boundary. The app only ever talks to a `StorageAdapter`: a tiny async key-value
 * interface. Today that is the browser's localStorage; a remote sync backend implements the same
 * methods and is swapped in with `actions.init(adapter)` (or `setStorageAdapter` before init)
 * without touching anything else. Nothing at module load probes or opens storage: the default
 * adapter is only created the first time the store needs one.
 *
 * What an adapter must know about how it is used:
 *  - The whole document is one value. Every save is a `set(STORAGE_KEYS.data, <the entire JSON>)`
 *    that replaces what was there; the debounce is 250 ms, so a heavy document (a year of use,
 *    under a megabyte) is rewritten at most four times a second. A remote adapter should treat
 *    `set` as "replace" and may diff or compress on its side.
 *  - `get` resolves null when nothing is stored. `set` rejects when the value was not kept (quota,
 *    network); the store then shows "Not saving". `remove` never needs to reject.
 *  - `subscribe` is optional: if present, the store calls it once after loading, for the data key,
 *    and applies every value another tab or device writes (the listener gets the raw JSON, or
 *    null when the key was removed). Without it the store simply never hears about other writers.
 *  - `volatile` is true when what is written will not outlive the page (the in-memory fallback for
 *    blocked browser storage). The store then warns from the start, so the user knows to export.
 */

export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  /** Hear about writes made elsewhere (another tab, another device). Returns the way to stop. */
  subscribe?(key: string, listener: (value: string | null) => void): () => void
  /** Data written here is lost when the page closes. */
  readonly volatile?: boolean
}

export const STORAGE_KEYS = {
  /** The AppData document. */
  data: 'cairn:data:v1',
  /** The user's own document, parked while the demo history is loaded. */
  stash: 'cairn:stash:v1',
  /** Theme choice. Read synchronously by the inline script in index.html. */
  theme: 'cairn:theme',
} as const

export class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value)
  }

  async remove(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }

  /** The browser's `storage` event fires in every other tab on the same origin, never in the writer. */
  subscribe(key: string, listener: (value: string | null) => void): () => void {
    if (typeof window === 'undefined') return () => undefined
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      listener(event.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }
}

/**
 * In-memory adapter: used in tests, and as the fallback when the browser blocks storage (then
 * built with `volatile: true`, which makes the store warn that nothing will survive a reload).
 */
export class MemoryAdapter implements StorageAdapter {
  private readonly map = new Map<string, string>()
  readonly volatile: boolean

  constructor(options: { volatile?: boolean } = {}) {
    this.volatile = options.volatile === true
  }

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value)
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key)
  }
}

/** localStorage when it works, volatile memory otherwise (private windows, blocked site data). */
export function defaultAdapter(): StorageAdapter {
  try {
    const probe = 'cairn:probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return new LocalStorageAdapter()
  } catch {
    return new MemoryAdapter({ volatile: true })
  }
}
