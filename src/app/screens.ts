/**
 * Every screen and overlay is its own chunk. They are declared here, once, so the shell can fetch
 * them ahead of time: when the page is idle after first paint, and when a dock link is pointed at
 * or focused. By the time a screen is opened its code is already in memory, so the outgoing page
 * hands over to the incoming one without an empty beat.
 */
import { lazy, type ComponentType } from 'react'

type Loader = () => Promise<{ default: ComponentType }>

const loaders = {
  today: () => import('../features/today/TodayScreen'),
  map: () => import('../features/map/MapScreen'),
  problems: () => import('../features/problems/ProblemsScreen'),
  drill: () => import('../features/drill/DrillScreen'),
  mock: () => import('../features/mock/MockScreen'),
  insights: () => import('../features/insights/InsightsScreen'),
  settings: () => import('../features/settings/SettingsScreen'),
  problemSheet: () => import('../features/problem/ProblemSheet'),
  palette: () => import('../features/palette/CommandPalette'),
  shortcuts: () => import('../features/palette/ShortcutsDialog'),
  celebrations: () => import('../features/celebrate/Celebrations'),
  welcome: () => import('../features/welcome/Welcome'),
} satisfies Record<string, Loader>

export type ChunkName = keyof typeof loaders

const started = new Map<ChunkName, Promise<unknown>>()

/** Start fetching a chunk (once). Failures are left for the lazy boundary to report when it is needed. */
export function preload(name: ChunkName): void {
  if (started.has(name)) return
  const pending = loaders[name]()
  pending.catch(() => started.delete(name))
  started.set(name, pending)
}

/** A lazy component that reuses a preload already in flight. */
export function lazyChunk<T extends ComponentType>(name: ChunkName) {
  return lazy(() => {
    preload(name)
    return started.get(name) as Promise<{ default: T }>
  })
}

const ROUTE_CHUNK: Record<string, ChunkName> = {
  '/': 'today',
  '/map': 'map',
  '/problems': 'problems',
  '/drill': 'drill',
  '/mock': 'mock',
  '/insights': 'insights',
  '/settings': 'settings',
}

/** Preload the screen behind a path from the dock or the palette. */
export function preloadRoute(path: string): void {
  const chunk = ROUTE_CHUNK[path]
  if (chunk) preload(chunk)
}

/** After first paint, when the browser has nothing better to do, fetch every screen. */
export function preloadAllWhenIdle(): void {
  const run = () => (Object.keys(loaders) as ChunkName[]).forEach(preload)
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2500 })
  else window.setTimeout(run, 800)
}
