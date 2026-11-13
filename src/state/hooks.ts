/** How components read state. Screens should use these rather than touching the store directly. */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { TopicId } from '../data/types'
import { deriveCached } from '../domain/derive'
import type { Derived, ProblemView, TopicView } from '../domain/types'
import { getToday, now, subscribeToday } from './clock'
import { timerElapsed } from './reducers'
import type { AppData, ISODate, Settings, TimerState } from './schema'
import { actions, useStore, type Actions, type AppEvent } from './store'

/** 'loading' until the stored document has been read. */
export function useStatus(): 'loading' | 'ready' {
  return useStore((s) => s.status)
}

/** The raw stored document. Prefer `useDerived` for anything computed. */
export function useData(): AppData {
  return useStore((s) => s.data)
}

export function useSettings(): Settings {
  return useStore((s) => s.data.settings)
}

/** Today's local date. Re-renders when the day rolls over. */
export function useToday(): ISODate {
  return useSyncExternalStore(subscribeToday, getToday, getToday)
}

/** Everything computed from the document: statuses, queue, topics, stats. Memoised per change. */
export function useDerived(): Derived {
  const data = useData()
  const today = useToday()
  return deriveCached(data, today)
}

export function useProblemView(slug: string | null | undefined): ProblemView | undefined {
  const derived = useDerived()
  return slug ? derived.problems[slug] : undefined
}

export function useTopicView(id: TopicId): TopicView {
  return useDerived().topics[id]
}

/** The stable set of actions. Safe to call from event handlers and effects. */
export function useActions(): Actions {
  return actions
}

export function useEvents(): AppEvent[] {
  return useStore((s) => s.events)
}

export function useCanUndo(): boolean {
  return useStore((s) => s.undoStack.length > 0)
}

export function useStorageProblems(): { storageError: string | null; loadError: string | null } {
  const storageError = useStore((s) => s.storageError)
  const loadError = useStore((s) => s.loadError)
  return { storageError, loadError }
}

/** A clock that ticks while `enabled`. For countdowns and running timers. */
export function useNow(intervalMs: number = 1000, enabled: boolean = true): number {
  const [value, setValue] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setValue(Date.now())
    const id = window.setInterval(() => setValue(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, enabled])
  return value
}

/** The solve timer, ticking once a second while it runs. */
export function useTimer(): { timer: TimerState | null; elapsedMs: number; running: boolean } {
  const timer = useStore((s) => s.data.timer)
  const running = !!timer && timer.runningSince !== null
  // The tick only forces a re-render; the elapsed time is read from the clock itself.
  useNow(1000, running)
  return { timer, elapsedMs: timerElapsed(timer, now()), running }
}
