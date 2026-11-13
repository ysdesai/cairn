/** Per-device preferences that are not part of the exported document. Currently: the theme. */
import { useSyncExternalStore } from 'react'
import type { ThemeChoice } from './schema'
import { STORAGE_KEYS } from './storage'

export type ResolvedTheme = 'light' | 'dark'

const listeners = new Set<() => void>()
const systemDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function readChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(STORAGE_KEYS.theme)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let choice: ThemeChoice = typeof window !== 'undefined' ? readChoice() : 'system'

export function resolveTheme(c: ThemeChoice = choice): ResolvedTheme {
  if (c === 'system') return systemDark?.matches ? 'dark' : 'light'
  return c
}

/** Write the resolved theme onto <html>. The inline script in index.html does the same before first paint. */
export function applyTheme(): void {
  const resolved = resolveTheme()
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0d1218' : '#f6f3ec')
}

export function getThemeChoice(): ThemeChoice {
  return choice
}

export function setThemeChoice(next: ThemeChoice): void {
  choice = next
  try {
    if (next === 'system') window.localStorage.removeItem(STORAGE_KEYS.theme)
    else window.localStorage.setItem(STORAGE_KEYS.theme, next)
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
  applyTheme()
  listeners.forEach((fn) => fn())
}

/** light → dark → system → light */
export function cycleTheme(): ThemeChoice {
  const next: ThemeChoice = choice === 'light' ? 'dark' : choice === 'dark' ? 'system' : 'light'
  setThemeChoice(next)
  return next
}

systemDark?.addEventListener('change', () => {
  if (choice === 'system') {
    applyTheme()
    listeners.forEach((fn) => fn())
  }
})

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** `${choice}:${resolved}` so a system flip re-renders subscribers too. */
const snapshot = () => `${choice}:${resolveTheme()}`

export function useTheme(): { choice: ThemeChoice; resolved: ResolvedTheme; setChoice: (c: ThemeChoice) => void } {
  const snap = useSyncExternalStore(subscribe, snapshot, () => 'system:light')
  const [c, r] = snap.split(':') as [ThemeChoice, ResolvedTheme]
  return { choice: c, resolved: r, setChoice: setThemeChoice }
}
