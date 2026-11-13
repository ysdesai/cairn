/**
 * The app's sense of "now" and "today". Components subscribe to the day so that leaving a tab
 * open past midnight rolls everything (due dates, streak, plan) forward without a reload.
 */
import { todayISO } from '../domain/dates'
import type { ISODate } from './schema'

let current: ISODate = todayISO()
const listeners = new Set<() => void>()

function check() {
  const next = todayISO()
  if (next !== current) {
    current = next
    listeners.forEach((fn) => fn())
  }
}

let started = false
function start() {
  if (started || typeof window === 'undefined') return
  started = true
  window.setInterval(check, 30_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}

export function subscribeToday(fn: () => void): () => void {
  start()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Read fresh, so an action just after midnight (or under a fake clock) never files under yesterday. */
export function getToday(): ISODate {
  return todayISO()
}

export function now(): number {
  return Date.now()
}
