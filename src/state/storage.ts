/**
 * The storage boundary. The app only ever talks to a `StorageAdapter`: a tiny async key-value
 * interface. Today that is the browser's localStorage; a remote sync backend can implement the
 * same three methods and be swapped in at `createStore` without touching anything else.
 */

export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
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
}

/** In-memory adapter: used in tests, and as the fallback when the browser blocks storage. */
export class MemoryAdapter implements StorageAdapter {
  private readonly map = new Map<string, string>()

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

/** localStorage when it works, memory otherwise (private windows, blocked site data). */
export function defaultAdapter(): StorageAdapter {
  try {
    const probe = 'cairn:probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return new LocalStorageAdapter()
  } catch {
    return new MemoryAdapter()
  }
}
