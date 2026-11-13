import { CATALOG } from './catalog'
import { CHEATSHEETS } from './cheatsheets'
import { DETAILS } from './details'
import { DEFAULT_PATTERN, PATTERN_BY_ID, PATTERNS } from './patterns'
import { EXPECTED_COUNTS, TOPIC_EDGES, TOPIC_SEEDS } from './topics'
import type { Problem, ProblemDetail, Topic, TopicId } from './types'

export type * from './types'
export { CHEATSHEETS, EXPECTED_COUNTS, PATTERN_BY_ID, PATTERNS, TOPIC_EDGES }

const FALLBACK_DETAIL = (topic: TopicId): ProblemDetail => ({
  tags: [],
  pattern: DEFAULT_PATTERN[topic],
  summary: '',
  clue: '',
  decoys: [],
})

/** All 18 topics in the conventional listing order. */
export const TOPICS: readonly Topic[] = TOPIC_SEEDS.map((seed) => ({
  ...seed,
  count: CATALOG.filter((p) => p.topic === seed.id).length,
}))

/** Build a value for every topic. The typed way to make a Record<TopicId, T>. */
export function recordByTopic<T>(make: (id: TopicId) => T): Record<TopicId, T> {
  const out = {} as Record<TopicId, T>
  for (const seed of TOPIC_SEEDS) out[seed.id] = make(seed.id)
  return out
}

export const TOPIC_BY_ID: Record<TopicId, Topic> = recordByTopic((id) => TOPICS.find((t) => t.id === id)!)

/** All 150 problems: topic order, then NeetCode's order within the topic. */
export const PROBLEMS: readonly Problem[] = (() => {
  const out: Problem[] = []
  for (const topic of TOPICS) {
    const inTopic = CATALOG.filter((p) => p.topic === topic.id)
    inTopic.forEach((base, i) => {
      out.push({
        ...base,
        ...(DETAILS[base.slug] ?? FALLBACK_DETAIL(base.topic)),
        id: base.slug,
        order: out.length + 1,
        indexInTopic: i + 1,
        url: `https://leetcode.com/problems/${base.slug}/`,
        videoUrl: base.video ? `https://www.youtube.com/watch?v=${base.video}` : null,
      })
    })
  }
  return out
})()

export const TOTAL_PROBLEMS = PROBLEMS.length

const BY_SLUG = new Map(PROBLEMS.map((p) => [p.slug, p]))

export function getProblem(slug: string): Problem | undefined {
  return BY_SLUG.get(slug)
}

export const PROBLEMS_BY_TOPIC: Record<TopicId, readonly Problem[]> = recordByTopic((id) =>
  PROBLEMS.filter((p) => p.topic === id),
)

/**
 * A dependency-respecting order for "what comes next": by level, then listing order.
 * (The conventional listing puts Math & Geometry before Bit Manipulation, which it depends on.)
 */
export const ROADMAP_ORDER: readonly TopicId[] = [...TOPICS]
  .sort((a, b) => a.level - b.level || a.order - b.order)
  .map((t) => t.id)

export function isTopicId(value: string): value is TopicId {
  return Object.hasOwn(TOPIC_BY_ID, value)
}
