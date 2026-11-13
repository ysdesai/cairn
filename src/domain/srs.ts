/**
 * Spaced repetition. A problem's schedule is never stored: it is replayed from its attempts,
 * so editing, backdating or deleting an attempt always leaves a consistent state.
 *
 * The rules, in full:
 *
 * - The ladder is 1, 3, 7, 21, 45 days. `step` counts rungs cleared (0…5). Step 5 is mastered.
 * - First attempt (the solve):  Easy → step 1 (back in 3 days).  Struggled → step 0, but back
 *   in 2 days.  Needed help → step 0, back in 1 day. The three ratings lead to three different
 *   first revisions; a first solve has no earlier rung to "move one step" from, so Struggled is
 *   a half rung: more room than starting over, less than Easy.
 * - Each later attempt (a revision):
 *     Easy        → step + 2   (moves along faster)
 *     Struggled   → step + 1
 *     Needed help → step 0     (back to the start; counts as a lapse)
 * - A revision logged on the same date as the previous attempt changes nothing about the schedule:
 *   no rung, no ease (you cannot master a problem, or inflate its ease, in one sitting).
 *   "Needed help" is the exception and still resets it.
 * - A rung is a retention interval, so it only counts when it has been waited out. A revision
 *   logged before the problem's due date is practice: the due date stays, no rung is climbed
 *   (Easy included; it cannot cram a problem to mastered in three days), and an Easy leaves
 *   ease alone. Struggled still lowers ease, since trouble is evidence whenever it shows up.
 *   "Needed help" still resets the problem. A revision on or after the due date counts in full.
 * - Patience bonus: an Easy revision that comes after waiting at least twice the planned
 *   interval clears one extra rung. The memory outlived its schedule, so the schedule was too tight.
 *   This is also what lets a backlog held back by the daily cap drain quickly.
 * - `ease` is the per-problem adaptation. It starts at 1 and moves with each attempt that counts:
 *   Easy +0.10, Struggled −0.05, Needed help −0.15, clamped to [0.7, 1.5].
 * - The next interval is LADDER[step] × ease, rounded, at least 1 day. Step 0 is always 1 day
 *   (apart from the 2 days a Struggled first solve gets). Easy skipping a rung on time is
 *   deliberate: the full ladder takes 77 days, an all-Easy climb 24.
 * - At step ≥ LADDER.length the problem is mastered: no due date. If a later attempt on a
 *   mastered problem is rated Needed help it drops back to step 0 and re-enters rotation.
 */
import type { Attempt, ISODate, Rating } from '../state/schema'
import { addDays, diffDays } from './dates'
import type { ProblemStatus, SrsPreview, SrsState } from './types'

export const LADDER: readonly number[] = [1, 3, 7, 21, 45]
export const EASE_START = 1
export const EASE_MIN = 0.7
export const EASE_MAX = 1.5
export const EASE_DELTA: Record<Rating, number> = { easy: 0.1, struggled: -0.05, help: -0.15 }
/** Days until the first revision after a Struggled first solve (Needed help gets 1, Easy 3). */
export const STRUGGLED_FIRST_INTERVAL = 2

/** Attempts in chronological order: by date, then by time logged. Returns a new array. */
export function sortAttempts(attempts: readonly Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at))
}

const clampEase = (ease: number) => Math.min(EASE_MAX, Math.max(EASE_MIN, Math.round(ease * 100) / 100))

/** Days until the next revision for a rung and ease. null once the ladder is cleared. */
export function intervalFor(step: number, ease: number): number | null {
  if (step >= LADDER.length) return null
  if (step <= 0) return LADDER[0]
  // Integer arithmetic on hundredths, rounding halves up: 45 * 0.7 is 31.499999999999996 in floating point.
  return Math.max(1, Math.floor((LADDER[step] * Math.round(ease * 100) + 50) / 100))
}

type Core = Omit<SrsState, 'mastered'>

/** Apply one attempt. `prev` is null for the first attempt. `on` is never earlier than prev.lastOn. */
function advance(prev: Core | null, rating: Rating, on: ISODate): Core {
  if (!prev) {
    const step = rating === 'easy' ? 1 : 0
    const ease = clampEase(EASE_START + EASE_DELTA[rating])
    const interval = rating === 'struggled' ? STRUGGLED_FIRST_INTERVAL : intervalFor(step, ease)
    return {
      step,
      ease,
      interval,
      due: interval === null ? null : addDays(on, interval),
      lapses: 0,
      reviews: 0,
      firstOn: on,
      lastOn: on,
      lastRating: rating,
    }
  }

  const sameDay = on === prev.lastOn
  const base = { ...prev, reviews: prev.reviews + 1, lastOn: on, lastRating: rating }

  if (rating === 'help') {
    const ease = clampEase(prev.ease + EASE_DELTA.help)
    const interval = intervalFor(0, ease)
    return { ...base, step: 0, ease, interval, due: addDays(on, interval ?? LADDER[0]), lapses: prev.lapses + 1 }
  }

  // A second attempt on the same day is practice, not evidence of retention: the schedule stands.
  if (sameDay) return base

  // Before its date: practice. The due date stands (the interval now counts from this attempt, so
  // `due - lastOn` still equals `interval`), no rung is climbed, and only a struggle moves ease.
  if (prev.due !== null && on < prev.due) {
    const ease = rating === 'struggled' ? clampEase(prev.ease + EASE_DELTA.struggled) : prev.ease
    return { ...base, ease, interval: diffDays(on, prev.due) }
  }

  const waited = diffDays(prev.lastOn, on)
  const patient = rating === 'easy' && prev.interval !== null && waited >= prev.interval * 2
  const gain = (rating === 'easy' ? 2 : 1) + (patient ? 1 : 0)
  const step = Math.min(LADDER.length, prev.step + gain)
  const ease = clampEase(prev.ease + EASE_DELTA[rating])
  const interval = intervalFor(step, ease)
  return { ...base, step, ease, interval, due: interval === null ? null : addDays(on, interval) }
}

const finish = (core: Core): SrsState => ({ ...core, mastered: core.step >= LADDER.length })

/** Replay a problem's attempts (any order) into its current schedule. null when there are none. */
export function replay(attempts: readonly Attempt[]): SrsState | null {
  let core: Core | null = null
  for (const attempt of sortAttempts(attempts)) core = advance(core, attempt.rating, attempt.date)
  return core ? finish(core) : null
}

/**
 * What logging `rating` on `on` would lead to, without changing anything.
 * `state` is the current schedule, or null for a first solve. A date earlier than the latest
 * attempt is treated as that attempt's date (a backdated entry is replayed properly once saved).
 */
export function preview(state: SrsState | null, rating: Rating, on: ISODate): SrsPreview {
  const when = state && on < state.lastOn ? state.lastOn : on
  const next = finish(advance(state, rating, when))
  return { step: next.step, interval: next.interval, due: next.due, mastered: next.mastered }
}

export function statusOf(srs: SrsState | null, today: ISODate): ProblemStatus {
  if (!srs) return 'todo'
  if (srs.mastered || srs.due === null) return 'mastered'
  return srs.due <= today ? 'due' : 'learning'
}
