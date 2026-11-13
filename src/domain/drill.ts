/**
 * The pattern drill: statistics, the four options for a card, and which card comes next.
 *
 * Options: the correct pattern, then the problem's hand-picked decoys, then (if still short)
 * patterns from neighbouring topics, then anything. Never filler from the problem's own topic or
 * the topic its pattern lives in: such a pattern is the likeliest to be another valid way to solve
 * it. Every problem ships three clean decoys, so filler is a safety net only. Always
 * DRILL_OPTION_COUNT distinct patterns, shuffled with the given rng.
 * A pattern in problem.alt is also an accepted solution, so it is never offered, neither as a
 * decoy nor as filler: picking it would be marked wrong unfairly.
 *
 * DrillStats.weakest: the patterns with at least 3 answers and accuracy under 80%, lowest first, at
 * most 5. Empty until a pattern is both tested and missed, so a pattern the user gets right is never
 * called weak and the "weak patterns" source stays locked until there is one.
 *
 * Next card: weighted towards patterns you get wrong. A pattern's weight is
 *   unseen            1.6   (you have not been tested on it yet)
 *   seen              0.4 + 2 × (1 − smoothed accuracy)   where smoothed = (correct + 1) / (seen + 2)
 * A problem's weight is its pattern's weight, divided by the number of problems sharing that
 * pattern in the pool (so big patterns do not crowd out small ones), and multiplied by 0.15 if
 * the problem is in `recent` (the last few cards shown). Problems without a summary are skipped.
 */
import { getProblem, PATTERN_BY_ID, PATTERNS, recordByTopic, TOPIC_BY_ID } from '../data'
import type { PatternId, Problem, TopicId } from '../data/types'
import type { DrillResult, ISODate } from '../state/schema'
import { pickWeighted, shuffle, type Rng } from './rng'
import type { DrillStats, PatternStat } from './types'

export const DRILL_OPTION_COUNT = 4
export const DRILL_DECK_SIZES: readonly number[] = [10, 20, 40]

const WEAK_MIN_SEEN = 3
/** A pattern is only called weak below this accuracy (the Ledger's ember line). */
export const WEAK_BELOW_ACCURACY = 0.8
const WEAK_LIMIT = 5
const CONFUSED_LIMIT = 3
const UNSEEN_WEIGHT = 1.6
const RECENT_FACTOR = 0.15

export function buildDrillStats(drills: readonly DrillResult[], today: ISODate): DrillStats {
  const byAnswer = new Map<PatternId, DrillResult[]>()
  const byTopic = recordByTopic(() => ({ seen: 0, correct: 0 }))
  let correct = 0
  let todayCount = 0
  for (const d of drills) {
    const results = byAnswer.get(d.answer) ?? []
    results.push(d)
    byAnswer.set(d.answer, results)
    if (d.correct) correct += 1
    if (d.date === today) todayCount += 1
    // A card whose problem has left the list still counts, under its pattern's home topic.
    const topic: TopicId | undefined = getProblem(d.slug)?.topic ?? PATTERN_BY_ID[d.answer]?.topic
    if (topic) {
      byTopic[topic].seen += 1
      if (d.correct) byTopic[topic].correct += 1
    }
  }

  const byPattern: PatternStat[] = PATTERNS.map((pattern) => {
    const results = byAnswer.get(pattern.id) ?? []
    const right = results.filter((r) => r.correct).length
    const wrong = new Map<PatternId, number>()
    for (const r of results) if (!r.correct) wrong.set(r.picked, (wrong.get(r.picked) ?? 0) + 1)
    return {
      pattern,
      seen: results.length,
      correct: right,
      accuracy: results.length ? right / results.length : null,
      // Stable sort: equal counts keep the order in which they were first picked.
      confusedWith: [...wrong]
        .map(([id, count]) => ({ pattern: id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, CONFUSED_LIMIT),
    }
  })

  // Lowest accuracy first; on a tie the better-tested pattern, then the pattern order.
  // Only patterns the user actually gets wrong: a perfect pattern is never weak, however few are tested.
  const weakest = byPattern
    .filter((s) => s.seen >= WEAK_MIN_SEEN && (s.accuracy ?? 1) < WEAK_BELOW_ACCURACY)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.seen - a.seen)
    .slice(0, WEAK_LIMIT)

  return {
    total: drills.length,
    correct,
    accuracy: drills.length ? correct / drills.length : null,
    today: todayCount,
    byPattern,
    weakest,
    byTopic,
  }
}

export function drillOptions(problem: Problem, rng: Rng): PatternId[] {
  const chosen: PatternId[] = [problem.pattern]
  const alt = new Set<PatternId>(problem.alt ?? [])
  for (const decoy of problem.decoys) {
    if (chosen.length >= DRILL_OPTION_COUNT) break
    if (PATTERN_BY_ID[decoy] && !alt.has(decoy) && !chosen.includes(decoy)) chosen.push(decoy)
  }

  if (chosen.length < DRILL_OPTION_COUNT) {
    // The problem's own topic and the topic its pattern lives in can differ (a Stack problem
    // solved by a monotonic stack), so both count as "same".
    const own = new Set<TopicId>([problem.topic, PATTERN_BY_ID[problem.pattern].topic])
    const near = new Set<TopicId>()
    for (const id of own) for (const n of [...TOPIC_BY_ID[id].deps, ...TOPIC_BY_ID[id].unlocks]) near.add(n)
    const candidates = PATTERNS.map((p) => p.id).filter((id) => !chosen.includes(id) && !alt.has(id))
    // A pattern from the problem's own topic is the likeliest to be another valid way to solve it
    // (a linked list problem solved with a dummy head, a 1-D table for coins), so it is never
    // filler. Hand-picked decoys are the only same-topic options. Only if that leaves too few
    // does the topic come back in, so four options are always possible.
    const outside = candidates.filter((id) => !own.has(PATTERN_BY_ID[id].topic))
    const rest = outside.length >= DRILL_OPTION_COUNT - chosen.length ? outside : candidates
    const tier = (id: PatternId) => {
      const topic = PATTERN_BY_ID[id].topic
      return own.has(topic) ? 0 : near.has(topic) ? 1 : 2
    }
    // Shuffle first so patterns in the same tier are picked at random, then group by tier.
    const filler = shuffle(rng, rest).sort((a, b) => tier(a) - tier(b))
    chosen.push(...filler.slice(0, DRILL_OPTION_COUNT - chosen.length))
  }
  return shuffle(rng, chosen)
}

export function patternWeight(stat: PatternStat): number {
  if (stat.seen === 0) return UNSEEN_WEIGHT
  const smoothed = (stat.correct + 1) / (stat.seen + 2)
  return 0.4 + 2 * (1 - smoothed)
}

export function nextDrillCard(input: {
  stats: DrillStats
  pool: readonly Problem[]
  recent: readonly string[]
  rng: Rng
}): Problem | null {
  const { stats, pool, recent, rng } = input
  const cards = pool.filter((p) => p.summary.trim() !== '')
  if (cards.length === 0) return null

  // Counted over playable cards, since the skipped ones can never crowd anything out.
  const sharing = new Map<PatternId, number>()
  for (const p of cards) sharing.set(p.pattern, (sharing.get(p.pattern) ?? 0) + 1)
  const statOf = new Map(stats.byPattern.map((s) => [s.pattern.id, s]))
  const recentSet = new Set(recent)

  return pickWeighted(rng, cards, (p) => {
    const stat = statOf.get(p.pattern)
    const base = stat ? patternWeight(stat) : UNSEEN_WEIGHT
    return (base / sharing.get(p.pattern)!) * (recentSet.has(p.slug) ? RECENT_FACTOR : 1)
  })
}
