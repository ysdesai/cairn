import type { Difficulty } from '../../data/types'
import { estimateMinutes } from '../../domain/session'
import type { Derived, ProblemView, PlanStats } from '../../domain/types'
import type { ISODate, SessionItem, SessionItemKind } from '../../state/schema'

/** The reason on a revision the user pulled forward from the waiting list. */
export const PULLED = 'Pulled forward from the waiting list'

const RANK: Record<SessionItemKind, number> = { drill: 0, review: 1, new: 2 }
const MAX_NEW = 3
/** A route may run this far past its budget (the same allowance the session builder gives a new problem). */
const OVERRUN = 1.1
const ONE_REVIEW_FROM = 10

function reviewReason(view: ProblemView): string {
  const waited = view.dueIn !== null && view.dueIn < 0 ? -view.dueIn : 0
  const when = waited > 0 ? `Waiting ${waited} ${waited === 1 ? 'day' : 'days'}` : 'Due today'
  return view.srs?.lastRating === 'help' ? `${when} · needed help last` : when
}

/** A route as a comparable string. */
export const routeKey = (items: readonly SessionItem[]) => JSON.stringify(items.map((i) => [i.kind, i.slug ?? null, i.minutes, i.reason]))

/**
 * Today's stored route, brought up to date with what is true now. The route is drawn once and kept
 * steady, so finished stops stay checked off; but the facts under it move (a solve is backdated, the
 * daily cap or a timer target changes in Settings). This keeps every stop that still stands, and
 *   - drops a new problem that is now solved and a revision that is no longer due or is now held back by the cap
 *     (one the user pulled forward stays),
 *   - re-estimates the stops still to do from the current timer targets,
 *   - adds revisions that are due inside today's cap and fit the budget,
 *   - tops up new ground if there is room.
 * It is idempotent: reconciling a reconciled route returns it unchanged.
 */
export function reconcile(
  items: readonly SessionItem[],
  budget: number,
  derived: Derived,
  targets: Record<Difficulty, number>,
): SessionItem[] {
  const { queue, problems, recommendations } = derived
  const inToday = new Set(queue.today.map((v) => v.problem.slug))
  const limit = budget * OVERRUN

  const kept: SessionItem[] = []
  for (const item of items) {
    if (item.kind === 'drill' || !item.slug) {
      kept.push(item)
      continue
    }
    const view = problems[item.slug]
    if (!view) continue
    if (view.touchedToday) {
      kept.push(item)
      continue
    }
    if (item.kind === 'review') {
      if (view.status !== 'due') continue
      if (!inToday.has(item.slug) && item.reason !== PULLED) continue
    } else if (view.solved) {
      continue
    }
    kept.push({ ...item, minutes: estimateMinutes(view, item.kind, targets) })
  }

  const used = () => kept.reduce((sum, item) => sum + item.minutes, 0)
  const isPendingNew = (item: SessionItem) => item.kind === 'new' && !!item.slug && !problems[item.slug]?.touchedToday

  // Raised timer targets can push the route past its budget: let go of the last new problems.
  while (used() > limit && kept.filter((i) => i.kind !== 'drill').length > 1) {
    const at = kept.map(isPendingNew).lastIndexOf(true)
    if (at < 0) break
    kept.splice(at, 1)
  }

  const onRoute = new Set(kept.flatMap((i) => (i.slug ? [i.slug] : [])))
  let reviews = kept.filter((i) => i.kind === 'review').length
  for (const view of queue.today) {
    if (onRoute.has(view.problem.slug)) continue
    const est = estimateMinutes(view, 'review', targets)
    const forced = reviews === 0 && budget >= ONE_REVIEW_FROM
    if (!forced && used() + est > budget) break
    kept.push({ kind: 'review', slug: view.problem.slug, minutes: est, reason: reviewReason(view) })
    onRoute.add(view.problem.slug)
    reviews += 1
  }

  let fresh = kept.filter((i) => i.kind === 'new').length
  for (const rec of recommendations) {
    if (fresh >= MAX_NEW) break
    const view = problems[rec.problem.slug]
    if (!view || onRoute.has(rec.problem.slug)) continue
    const est = estimateMinutes(view, 'new', targets)
    if (used() + est > limit) break
    kept.push({ kind: 'new', slug: rec.problem.slug, minutes: est, reason: rec.note })
    onRoute.add(rec.problem.slug)
    fresh += 1
  }

  // Drill, then revisions, then new ground, each group keeping its order.
  return kept.map((item, i) => ({ item, i })).sort((a, b) => RANK[a.item.kind] - RANK[b.item.kind] || a.i - b.i).map((x) => x.item)
}

// ---------------------------------------------------------------------------------------------
// Pace

export type PacePhase = 'before' | 'during' | 'after' | 'done'

export interface Pace {
  phase: PacePhase
  tone: 'ember' | 'lake' | 'gold' | 'neutral'
  variant: 'soft' | 'outline'
  text: string
  /** Whether "the plan expects N by today" and the daily rates mean anything. */
  judged: boolean
}

/** Pace is judged against what the plan expected before today began, and on the projected finish. */
export function pace(plan: PlanStats, when: (iso: ISODate) => string, daysToStart: number): Pace {
  if (plan.status === 'done') return { phase: 'done', tone: 'gold', variant: 'soft', text: 'Plan complete', judged: false }
  if (plan.dayNumber < 1) {
    return { phase: 'before', tone: 'neutral', variant: 'outline', text: daysToStart === 1 ? 'Starts tomorrow' : `Starts ${when(plan.startDate)}`, judged: false }
  }
  if (plan.daysLeft === 0) {
    return { phase: 'after', tone: 'neutral', variant: 'outline', text: 'Target passed', judged: false }
  }
  const dayStart = Math.floor((2 * plan.total * Math.min(plan.totalDays, Math.max(0, plan.dayNumber - 1)) + plan.totalDays) / (2 * plan.totalDays))
  const gap = plan.solved - dayStart
  const onTrack = plan.projectedFinish !== null && plan.projectedFinish <= plan.targetDate
  if (plan.solved === 0 && plan.dayNumber <= 1) return { phase: 'during', tone: 'neutral', variant: 'outline', text: 'Not started', judged: true }
  if (plan.delta >= 2) return { phase: 'during', tone: 'ember', variant: 'soft', text: `${plan.delta} ahead of plan`, judged: true }
  if (gap <= -2 && !onTrack) return { phase: 'during', tone: 'lake', variant: 'soft', text: `${-gap} behind plan`, judged: true }
  return { phase: 'during', tone: 'ember', variant: 'outline', text: 'On pace', judged: true }
}
