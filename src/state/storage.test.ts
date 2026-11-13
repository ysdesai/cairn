import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultAdapter, LocalStorageAdapter, MemoryAdapter, STORAGE_KEYS } from './storage'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A tiny window: working or blocked localStorage, and the storage-event listeners. */
function stubWindow(blocked: boolean) {
  const items = new Map<string, string>()
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const localStorage = {
    getItem: (key: string) => {
      if (blocked) throw new DOMException('blocked', 'SecurityError')
      return items.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      if (blocked) throw new DOMException('blocked', 'SecurityError')
      items.set(key, value)
    },
    removeItem: (key: string) => {
      if (blocked) throw new DOMException('blocked', 'SecurityError')
      items.delete(key)
    },
  }
  const window = {
    localStorage,
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(fn))
    },
    removeEventListener: (type: string, fn: (event: unknown) => void) => listeners.get(type)?.delete(fn),
  }
  vi.stubGlobal('window', window)
  return { items, fire: (event: unknown) => listeners.get('storage')?.forEach((fn) => fn(event)), listeners }
}

describe('defaultAdapter', () => {
  it('is localStorage when it works, and not volatile', () => {
    stubWindow(false)
    const adapter = defaultAdapter()
    expect(adapter).toBeInstanceOf(LocalStorageAdapter)
    expect(adapter.volatile).toBeFalsy()
  })

  it('falls back to volatile memory when the browser blocks storage, so the store can warn', async () => {
    stubWindow(true)
    const adapter = defaultAdapter()
    expect(adapter).toBeInstanceOf(MemoryAdapter)
    expect(adapter.volatile).toBe(true)
    // It still works for the visit.
    await adapter.set(STORAGE_KEYS.data, 'x')
    expect(await adapter.get(STORAGE_KEYS.data)).toBe('x')
  })

  it('probes nothing until it is called', () => {
    const { items } = stubWindow(false)
    expect(items.size).toBe(0)
  })
})

describe('MemoryAdapter', () => {
  it('is not volatile unless asked, and does not subscribe', () => {
    expect(new MemoryAdapter().volatile).toBe(false)
    expect(new MemoryAdapter({ volatile: true }).volatile).toBe(true)
    expect((new MemoryAdapter() as { subscribe?: unknown }).subscribe).toBeUndefined()
  })
})

describe('LocalStorageAdapter.subscribe', () => {
  it('hears writes to its key from other tabs, and nothing else, until it stops', () => {
    const { fire, listeners } = stubWindow(false)
    const adapter = new LocalStorageAdapter()
    const heard: (string | null)[] = []
    const stop = adapter.subscribe(STORAGE_KEYS.data, (value) => heard.push(value))

    fire({ key: STORAGE_KEYS.data, newValue: '{"a":1}' })
    fire({ key: STORAGE_KEYS.stash, newValue: 'other key' })
    fire({ key: STORAGE_KEYS.data, newValue: null })
    expect(heard).toEqual(['{"a":1}', null])

    stop()
    fire({ key: STORAGE_KEYS.data, newValue: 'after' })
    expect(heard).toHaveLength(2)
    expect(listeners.get('storage')?.size).toBe(0)
  })
})
