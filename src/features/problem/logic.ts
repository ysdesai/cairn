/** Small pure helpers for the problem sheet. */
import { diffDays, formatDate } from '../../domain/dates'
import { preview } from '../../domain/srs'
import type { ProblemView } from '../../domain/types'
import type { ISODate, Rating, TimerState } from '../../state/schema'

/** What logging this rating would lead to, in the words used on the rating buttons and the toast. */
export function consequence(view: ProblemView, rating: Rating, date: ISODate, today: ISODate): string {
  const next = preview(view.srs, rating, validDate(date, today))
  if (next.mastered || next.due === null) return 'Mastered'
  const days = diffDays(today, next.due)
  if (days <= 0) return 'Back today'
  if (days === 1) return 'Back tomorrow'
  return `Back in ${days} days`
}

/** The line next to the log button: when the schedule will next ask for this problem. */
export function followUp(view: ProblemView, rating: Rating, date: ISODate, today: ISODate): string {
  const next = preview(view.srs, rating, validDate(date, today))
  if (next.mastered || next.due === null) return 'Clears the last rung'
  return `Next revision ${formatDate(next.due, 'weekday')}`
}

/** A usable date: empty, malformed or future input counts as today. */
export function validDate(date: ISODate, today: ISODate): ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : today
}

/** Time banked on the solve timer, running or paused, in ms. */
export function timerMs(timer: TimerState | null, at: number = Date.now()): number {
  if (!timer) return 0
  return timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, at - timer.runningSince))
}

/** The timer has been started on this problem and not reset. */
export function timerEngaged(timer: TimerState | null, slug: string): boolean {
  return !!timer && timer.slug === slug && (timer.runningSince !== null || timer.elapsedMs > 0)
}

/** Whole minutes, rounded to the nearest, never below one. null when nothing has been timed. */
export function wholeMinutes(ms: number): number | null {
  return ms > 0 ? Math.max(1, Math.round(ms / 60_000)) : null
}

export const MIN_MINUTES = 1
export const MAX_MINUTES = 600

export interface MinutesCheck {
  /** What will be saved: null for an empty field. */
  value: number | null
  /** The same value as text, for writing back into the field. */
  text: string
  /** Why the typed text was changed, or null when it is kept as typed. */
  note: string | null
}

/** Turn what was typed into what will be saved: whole minutes from 1 to 600, said out loud when it had to change. */
export function checkMinutes(typed: string): MinutesCheck {
  const raw = typed.trim()
  if (raw === '') return { value: null, text: '', note: null }
  const n = Number(raw)
  if (!Number.isFinite(n)) return { value: null, text: '', note: 'Not a number, so no time is saved.' }
  const value = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)))
  if (n < MIN_MINUTES) return { value, text: String(value), note: `Saved as ${MIN_MINUTES} minute, the least.` }
  if (n > MAX_MINUTES) return { value, text: String(value), note: `Saved as ${MAX_MINUTES} minutes, the most.` }
  if (value !== n) return { value, text: String(value), note: `Saved as ${value} whole ${value === 1 ? 'minute' : 'minutes'}.` }
  return { value, text: String(value), note: null }
}

/** A typed date kept to today or earlier. Returns the date and a note when it was pulled back. */
export function checkDate(date: ISODate, today: ISODate): { date: ISODate; note: string | null } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date > today) return { date: today, note: "Dates can't be in the future, so this is today." }
  return { date, note: null }
}

/** The first attempt is the solve; later ones are revisions, counted from 1. */
export function attemptLabel(index: number): string {
  return index === 0 ? 'Solved' : `Revision ${index}`
}

/** The same attempt as the object of a sentence: "Delete the solve", "Edit revision 2". */
export function attemptTarget(index: number): string {
  return index === 0 ? 'the solve' : `revision ${index}`
}

/** "Nov 12", or "Nov 12, 2025" when it is not this year. */
export function dayLabel(date: ISODate, today: ISODate): string {
  return formatDate(date, date.slice(0, 4) === today.slice(0, 4) ? 'short' : 'medium')
}
