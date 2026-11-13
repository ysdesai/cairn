/**
 * The session builder: given a time budget, propose a queue of revisions and new problems.
 *
 * Estimates (minutes):
 *   new problem  target for its difficulty + 5 for writing notes
 *   revision     a recall check, so short: 50% of the last timed attempt, or 40% of the target
 *                when never timed; at least 5, at most the target and at most 15
 *   drill block  5 minutes (DRILL_BLOCK_CARDS cards)
 *
 * A backlog is `queue.waiting` not being empty: more revisions are due than the daily cap lets
 * through. `queue.today` is already held to the cap, in queue order.
 *
 * Building for a budget of M minutes, with a backlog:
 *   1. Nothing is held back for a new problem. Today's revisions go in first, in queue order, as
 *      many as fit in M (the first is always added if M ≥ 10). One that does not fit is skipped
 *      and the next, cheaper one is tried, so the time is used rather than left idle.
 *   2. A new problem is added only if time remains: it must fit within 10% over M. At most 3,
 *      and a fourth or fifth only if it fits inside M itself.
 *
 * Without a backlog (today's behavior):
 *   1. If M ≥ 30 and there is a recommendation, hold back enough time for one new problem.
 *   2. Add today's revisions in queue order while they fit in what is left
 *      (always at least one if any are due and M ≥ 10).
 *   3. Add new problems in recommendation order while they fit, allowing 10% over; at most 3.
 *      A fourth and fifth are added only while they fit inside M itself (no overrun), so a long
 *      sitting with nothing due, such as a first run at 90 minutes, is not left a third empty.
 *      If step 1 held a slot back, that first new problem is always added, even when the
 *      revisions (the forced one included) left no room: it may take the session past the 10%
 *      allowance. Only that one item gets this; further new problems must still fit.
 *
 * Either way: if 5 or more minutes remain, open with a drill block as a warm-up.
 * Order of the result: drill (if any), revisions, new problems.
 *
 * viewSession marks an item done when its problem has an attempt dated today (drill block:
 * DRILL_BLOCK_CARDS cards answered today). A plan from another day is ignored (null).
 */
import type { Difficulty } from '../data/types'
import type { ISODate, SessionItem, SessionPlan } from '../state/schema'
import type { ProblemView, Recommendation, ReviewQueue, SessionView } from './types'

export const DRILL_BLOCK_CARDS = 10
export const DRILL_BLOCK_MINUTES = 5
export const SESSION_PRESETS: readonly number[] = [20, 40, 60, 90]

const NOTES_MINUTES = 5
const MIN_REVIEW_MINUTES = 5
/** A revision is a recall check: never budgeted above this, whatever the problem's target. */
const MAX_REVIEW_MINUTES = 15
const MAX_NEW = 3
/** Past MAX_NEW, up to this many, while each still fits inside the budget itself (no 10% overrun). */
const MAX_NEW_FITTING = 5
/** A new problem may push the session this far past the budget. */
const OVERRUN = 1.1
/** Budgets from here up keep room for a new problem. */
const NEW_PROBLEM_FROM = 30
/** Budgets from here up always get at least one due revision. */
const ONE_REVIEW_FROM = 10

export function estimateMinutes(
  view: ProblemView,
  kind: 'review' | 'new',
  targets: Record<Difficulty, number>,
): number {
  const target = targets[view.problem.difficulty]
  if (kind === 'new') return target + NOTES_MINUTES
  // Multiply, then divide: 0.7 * 45 is 31.499999999999996, which would round down instead of up.
  const raw = view.lastMinutes !== null ? (5 * view.lastMinutes) / 10 : (4 * target) / 10
  return Math.min(target, MAX_REVIEW_MINUTES, Math.max(MIN_REVIEW_MINUTES, Math.round(raw)))
}

function reviewReason(view: ProblemView): string {
  // Past its date is "waiting", never "overdue": the daily cap makes waiting normal.
  const waited = view.dueIn !== null && view.dueIn < 0 ? -view.dueIn : 0
  const when = waited > 0 ? `Waiting ${waited} ${waited === 1 ? 'day' : 'days'}` : 'Due today'
  return view.srs?.lastRating === 'help' ? `${when} · needed help last` : when
}

export function buildSession(input: {
  minutes: number
  queue: ReviewQueue
  recommendations: Recommendation[]
  problems: Record<string, ProblemView>
  targets: Record<Difficulty, number>
}): SessionItem[] {
  const { minutes, queue, recommendations, problems, targets } = input
  const limit = minutes * OVERRUN

  const newCandidates = recommendations.flatMap((rec) => {
    const view = problems[rec.problem.slug]
    return view ? [{ rec, minutes: estimateMinutes(view, 'new', targets) }] : []
  })

  const backlog = queue.waiting.length > 0

  // With a backlog the revisions come first and nothing is held back. Otherwise keep room for one
  // new problem, unless it could never fit anyway.
  const first = newCandidates[0]
  const held =
    !backlog && minutes >= NEW_PROBLEM_FROM && first && first.minutes <= limit ? first.minutes : 0

  let used = 0
  const reviews: SessionItem[] = []
  for (const view of queue.today) {
    const est = estimateMinutes(view, 'review', targets)
    const forced = reviews.length === 0 && minutes >= ONE_REVIEW_FROM
    if (!forced && used + est > minutes - held) {
      // Under a backlog a later, cheaper revision may still fit; otherwise stop at the first miss.
      if (backlog) continue
      break
    }
    reviews.push({ kind: 'review', slug: view.problem.slug, minutes: est, reason: reviewReason(view) })
    used += est
  }

  const fresh: SessionItem[] = []
  for (const { rec, minutes: est } of newCandidates) {
    // The held-back problem is promised, whatever the revisions used up.
    const promised = held > 0 && fresh.length === 0
    if (!promised && used + est > limit) break
    // A fourth and fifth new problem only when they fit the budget outright, so a long sitting of
    // first problems (a first run, nothing due) is not left half empty.
    if (fresh.length >= MAX_NEW && (fresh.length >= MAX_NEW_FITTING || used + est > minutes)) break
    fresh.push({ kind: 'new', slug: rec.problem.slug, minutes: est, reason: rec.note })
    used += est
  }

  const warmUp: SessionItem[] =
    minutes - used >= DRILL_BLOCK_MINUTES
      ? [
          {
            kind: 'drill',
            minutes: DRILL_BLOCK_MINUTES,
            reason: `Warm-up · ${DRILL_BLOCK_CARDS} pattern cards`,
          },
        ]
      : []

  return [...warmUp, ...reviews, ...fresh]
}

export function viewSession(
  plan: SessionPlan | null,
  problems: Record<string, ProblemView>,
  drillsToday: number,
  today: ISODate,
): SessionView | null {
  if (!plan || plan.date !== today) return null
  const items = plan.items.map((item) => {
    const view = item.slug ? (problems[item.slug] ?? null) : null
    const done = item.kind === 'drill' ? drillsToday >= DRILL_BLOCK_CARDS : view?.touchedToday === true
    return { ...item, done, problem: view?.problem ?? null }
  })
  return {
    budget: plan.budget,
    items,
    plannedMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
    doneCount: items.filter((item) => item.done).length,
    nextIndex: items.findIndex((item) => !item.done),
  }
}
