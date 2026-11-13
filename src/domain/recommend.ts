/**
 * What to attempt next, and the single clearest call to make.
 *
 * recommendNext: new problems, best first. Follows the roadmap and leans toward weak areas:
 *   1. the focus topic: the first active topic in ROADMAP_ORDER (or the first ready one if none
 *      is active). Its first unsolved problem leads the list.            reason 'continue' / 'new-topic'
 *   2. other active topics whose strength is under WEAK_BELOW get their next problem
 *      slotted in second.                                                reason 'weak-area'
 *   3. then more from the focus topic, the remaining active topics, and ready topics, up to
 *      3 problems per topic.
 *   4. if the list is still short of the limit, take MORE from the open topics (active or ready),
 *      lifting the 3-per-topic cap, in the same order: the focus topic, then other active topics,
 *      then ready topics, each with its usual reason.
 *   5. topics that are still "ahead" appear only when there is nothing at all from open
 *      topics. reason 'explore' (still at most 3 per topic)
 * Each carries a short note for the UI.
 *
 * buildSuggestion: one headline, in this order of precedence:
 *   start     nothing solved yet → begin at Arrays & Hashing
 *   summit    everything solved and mastered
 *   shore-up  a topic scores under WEAK_BELOW (the same line the Insights chart and headline use)
 *             with at least medium confidence → name it and why. Topics with nothing solved have no
 *             strength and are never named. If revisions are in today's route the detail says they
 *             come first.
 *   revise    revisions are still to do today and more are waiting than one day's cap → start with
 *             today's revisions. Once the day's cap is done this never fires: a backlog that carries
 *             over is normal, not an instruction. With a stored session (`session` input) "today's
 *             revisions" are the route's revisions not yet done, so the card agrees with the route;
 *             without one they are queue.today.
 *   drill     a pattern seen 3+ times is under 50% in the drill
 *   advance   otherwise, the first recommendation (the detail adds how many revisions carry over
 *             when the cap is already used up and some wait)
 */
import { ROADMAP_ORDER } from '../data'
import type { TopicId } from '../data/types'
import { WEAK_BELOW } from './strength'
import type {
  Counts,
  DrillStats,
  PatternStat,
  ProblemView,
  Recommendation,
  RecommendReason,
  ReviewQueue,
  SessionView,
  Suggestion,
  TopicView,
} from './types'

export const MAX_RECOMMENDATIONS = 6
export const MAX_PER_TOPIC = 3

/** A topic scoring under this, with enough evidence behind it, is worth shoring up. One line for the whole app. */
export const SHORE_UP_BELOW = WEAK_BELOW
const DRILL_MIN_SEEN = 3
const DRILL_WEAK_BELOW = 0.5

function noteFor(reason: RecommendReason, view: TopicView): string {
  const { name } = view.topic
  switch (reason) {
    case 'continue':
      return `Continue ${name} · ${view.solved} of ${view.total}`
    case 'weak-area':
      return `Weak area · ${name} at ${view.strength}`
    case 'new-topic':
      return `New topic · ${name}`
    case 'explore':
      return `Looking ahead · ${name}`
  }
}

export function recommendNext(
  topics: Record<TopicId, TopicView>,
  limit: number = MAX_RECOMMENDATIONS,
): Recommendation[] {
  const ordered = ROADMAP_ORDER.map((id) => topics[id])
  const active = ordered.filter((t) => t.state === 'active')
  const ready = ordered.filter((t) => t.state === 'ready')
  const ahead = ordered.filter((t) => t.state === 'ahead')

  const out: Recommendation[] = []
  const perTopic = new Map<TopicId, number>()
  const taken = new Set<string>()

  /** Add the topic's next unsolved problem that is not already listed. False if there is none. */
  const take = (view: TopicView, reason: RecommendReason, capped = true): boolean => {
    const count = perTopic.get(view.topic.id) ?? 0
    const next = view.problems.find((v) => !v.solved && !taken.has(v.problem.slug))
    if ((capped && count >= MAX_PER_TOPIC) || !next) return false
    taken.add(next.problem.slug)
    perTopic.set(view.topic.id, count + 1)
    out.push({ problem: next.problem, reason, note: noteFor(reason, view) })
    return true
  }
  const takeAll = (view: TopicView, reason: RecommendReason, capped = true) => {
    while (take(view, reason, capped));
  }

  const focus = active[0] ?? ready[0]
  const focusReason: RecommendReason = focus?.state === 'active' ? 'continue' : 'new-topic'
  if (focus) take(focus, focusReason)

  // Weakest first when several are under the line: they are the ones that most need a turn.
  const weak = active
    .filter((t) => t !== focus && t.strength !== null && t.strength < WEAK_BELOW)
    .sort((a, b) => (a.strength as number) - (b.strength as number))
  for (const view of weak) take(view, 'weak-area')

  if (focus) takeAll(focus, focusReason)
  for (const view of active) if (view !== focus) takeAll(view, 'continue')
  for (const view of ready) if (view !== focus) takeAll(view, 'new-topic')

  // Still short: lift the cap and take more from the open topics, same order, before anything else.
  const short = () => out.length < limit
  if (short() && focus) takeAll(focus, focusReason, false)
  for (const view of active) if (short() && view !== focus) takeAll(view, 'continue', false)
  for (const view of ready) if (short() && view !== focus) takeAll(view, 'new-topic', false)

  // Looking ahead is only for a user with nothing open at all.
  if (out.length === 0) for (const view of ahead) takeAll(view, 'explore')

  return out.slice(0, Math.max(0, limit))
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Among the solved problems still climbing the ladder, the one furthest down it. */
function shakiest(view: TopicView): ProblemView | null {
  let best: ProblemView | null = null
  for (const v of view.problems) {
    if (!v.solved || !v.srs || v.srs.mastered) continue
    if (best === null || v.srs.step < (best.srs?.step ?? Infinity)) best = v
  }
  return best
}

/** The lowest-scoring topic under SHORE_UP_BELOW with at least medium confidence. Ties go to the earlier one. */
function weakestExplored(topics: Record<TopicId, TopicView>): TopicView | null {
  let weakest: TopicView | null = null
  let lowest = SHORE_UP_BELOW
  for (const id of ROADMAP_ORDER) {
    const t = topics[id]
    if (t.strength === null || t.strength >= lowest) continue
    if (t.confidence !== 'medium' && t.confidence !== 'high') continue
    weakest = t
    lowest = t.strength
  }
  return weakest
}

function weakestDrillPattern(drill: DrillStats): PatternStat | null {
  const accuracy = (p: PatternStat) => p.correct / p.seen
  const weak = drill.byPattern.filter((p) => p.seen >= DRILL_MIN_SEEN && accuracy(p) < DRILL_WEAK_BELOW)
  weak.sort((a, b) => accuracy(a) - accuracy(b) || b.seen - a.seen)
  return weak[0] ?? null
}

function adviceFor(rec: Recommendation, topics: Record<TopicId, TopicView>): Suggestion {
  const view = topics[rec.problem.topic]
  const { name } = view.topic
  const detail = {
    continue: `You are ${view.solved} of ${view.total} through ${name}, and ${rec.problem.title} is the next one on the route.`,
    'weak-area': `${name} is under ${WEAK_BELOW}, so it gets a turn before you move on.`,
    'new-topic': `${name} is next on the roadmap: ${view.total} problems, none started.`,
    explore: `Nothing else is open on the route, so this looks ahead to ${name}.`,
  }[rec.reason]
  return {
    kind: 'advance',
    topic: view.topic.id,
    problem: rec.problem,
    headline: `Next up: ${rec.problem.title}.`,
    detail,
  }
}

export function buildSuggestion(input: {
  topics: Record<TopicId, TopicView>
  queue: ReviewQueue
  counts: Counts
  drill: DrillStats
  recommendations: Recommendation[]
  /** Today's stored route, if any. Lets the card agree with it about the revisions still to do. */
  session?: SessionView | null
}): Suggestion {
  const { topics, queue, counts, drill, recommendations, session } = input

  /** Revisions still to do today: the route's, or else the queue's. */
  const pending = session
    ? session.items.flatMap((item) => (item.kind === 'review' && !item.done && item.problem ? [item.problem] : []))
    : queue.today.map((v) => v.problem)

  if (counts.solved === 0) {
    const base = topics['arrays-hashing']
    return {
      kind: 'start',
      topic: base.topic.id,
      problem: base.next,
      headline: `Start at base camp: ${base.topic.name}.`,
      detail: base.next
        ? `Begin with ${base.next.title}, then log how it went and the route takes shape.`
        : 'Log your first solve and the route takes shape.',
    }
  }

  if (counts.total > 0 && counts.solved === counts.total && counts.mastered === counts.total) {
    return {
      kind: 'summit',
      topic: null,
      problem: null,
      headline: 'You have reached the summit.',
      detail: `All ${counts.total} problems are solved and mastered. A drill now and then keeps the patterns fresh.`,
    }
  }

  const weakest = weakestExplored(topics)
  if (weakest) {
    return {
      kind: 'shore-up',
      topic: weakest.topic.id,
      problem: shakiest(weakest)?.problem ?? weakest.next,
      headline: `Shore up ${weakest.topic.name}.`,
      detail:
        (weakest.weakness
          ? `Strength is ${weakest.strength}, and ${weakest.weakness}.`
          : `Strength is ${weakest.strength}, under the ${SHORE_UP_BELOW} mark.`) +
        (pending.length > 0
          ? ` The ${plural(pending.length, 'revision')} in today's route come${pending.length === 1 ? 's' : ''} first.`
          : ''),
    }
  }

  // Only while there is revision left to do today. Once the cap is done a carried backlog is normal.
  if (pending.length > 0 && queue.waiting.length > queue.cap) {
    return {
      kind: 'revise',
      topic: null,
      problem: pending[0],
      headline: 'Start with today\'s revisions.',
      detail: `${plural(pending.length, 'revision')} in today's route. ${queue.waiting.length} more ${queue.waiting.length === 1 ? 'is' : 'are'} due beyond the day's limit of ${queue.cap}; they come up over the next days.`,
    }
  }

  const weakPattern = weakestDrillPattern(drill)
  if (weakPattern) {
    const { pattern, seen, correct } = weakPattern
    return {
      kind: 'drill',
      topic: pattern.topic,
      problem: null,
      headline: `Drill ${pattern.name}.`,
      detail: `You picked it ${correct} of ${seen} times (${Math.round((100 * correct) / seen)}%).`,
    }
  }

  const first = recommendations[0]
  if (first) {
    const advice = adviceFor(first, topics)
    // The cap is used up and some are waiting: say they carry over, so nothing reads as unfinished.
    if (queue.today.length === 0 && queue.waiting.length > 0) {
      advice.detail += ` ${queue.waiting.length} more ${queue.waiting.length === 1 ? 'revision comes' : 'revisions come'} up over the next days.`
    }
    return advice
  }

  // Everything is solved but not yet mastered, so what is left is revision.
  if (queue.today.length > 0) {
    return {
      kind: 'revise',
      topic: null,
      problem: queue.today[0].problem,
      headline: `Revise ${plural(queue.today.length, 'problem')} today.`,
      detail: `Every problem is solved; ${queue.totalDue} ${queue.totalDue === 1 ? 'is' : 'are'} due for another look.`,
    }
  }
  // Nothing left for today: either nothing is due, or today's cap is already used up.
  return {
    kind: 'drill',
    topic: null,
    problem: null,
    headline: 'Keep the patterns sharp with a drill.',
    detail:
      queue.waiting.length > 0
        ? `Every problem is solved and today's revisions are done; ${queue.waiting.length} more can wait for tomorrow.`
        : 'Every problem is solved and nothing is due today. Revisions return as they fall due.',
  }
}
