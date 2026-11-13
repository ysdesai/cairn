/**
 * Today's revisions, held to the daily cap.
 *
 * Everything whose revision date has arrived is "due". Only `cap` of them are put in front of
 * the user per day (revisions already logged today count against the cap); the rest wait.
 * Waiting is normal, not a failure: the list is ordered so the ones that matter most go first.
 */
import type { ISODate } from '../state/schema'
import { diffDays } from './dates'
import { LADDER } from './srs'
import type { ProblemView, ReviewQueue } from './types'

/**
 * Higher means revise sooner. Combines
 * - urgency: days past the date relative to the interval that was planned (1 day past a 1-day
 *   interval matters more than 1 day past a 45-day one), and
 * - weakness: low on the ladder, lapses, low ease, last rated "Needed help".
 * Deterministic; ties break by list order.
 */
export function reviewPriority(view: ProblemView, today: ISODate): number {
  const { srs } = view
  // No schedule (todo, mastered) means nothing to revise; sorts below everything.
  if (!srs || srs.due === null || srs.interval === null) return -Infinity

  const urgency = diffDays(srs.due, today) / srs.interval
  const weakness =
    ((LADDER.length - srs.step) / LADDER.length) * 0.5 +
    Math.min(srs.lapses, 3) * 0.1 +
    Math.max(0, 1 - srs.ease) +
    (srs.lastRating === 'help' ? 0.3 : 0)
  return urgency + weakness
}

/** Revisions (attempts after a problem's first) dated `today`, across all problems. */
export function reviewsDoneOn(list: readonly ProblemView[], today: ISODate): number {
  let count = 0
  for (const view of list) {
    // Attempts are chronological, so index 0 is the solve.
    for (let i = 1; i < view.attempts.length; i++) if (view.attempts[i].date === today) count++
  }
  return count
}

export function buildQueue(list: readonly ProblemView[], today: ISODate, cap: number): ReviewQueue {
  const doneToday = reviewsDoneOn(list, today)
  // A fractional or negative cap is treated as the whole number of slots it allows, never below zero.
  const room = Math.max(0, Math.floor(cap) - doneToday)

  const ranked = list
    .map((view, index) => ({ view, index, priority: reviewPriority(view, today) }))
    // Judged from the schedule against `today`, not from view.status, which was fixed when the view was built.
    .filter(({ view }) => view.srs !== null && view.srs.due !== null && view.srs.due <= today)
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map(({ view }) => view)

  return {
    cap,
    doneToday,
    today: ranked.slice(0, room),
    waiting: ranked.slice(room),
    totalDue: ranked.length,
  }
}
