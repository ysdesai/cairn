/**
 * Topic-level views: progress, where each topic stands on the roadmap, and its strength.
 *
 * State of a topic:
 *   complete  every problem solved
 *   active    some solved
 *   ready     none solved, and every prerequisite is at least READY_THRESHOLD solved (or it has none)
 *   ahead     none solved, a prerequisite is not there yet
 *
 * `recommended` marks the topics to work on now: active topics first, then ready ones, both in
 * ROADMAP_ORDER, at most MAX_RECOMMENDED in total. With no history that is Arrays & Hashing alone.
 * It is advice only; nothing is ever locked.
 */
import { ROADMAP_ORDER, TOPIC_BY_ID, recordByTopic } from '../data'
import type { Difficulty, TopicId } from '../data/types'
import { topicStrength } from './strength'
import type { DrillStats, ProblemView, TopicState, TopicView } from './types'

/** A prerequisite counts as "far enough along" at 60% solved. */
export const READY_THRESHOLD = 0.6
export const MAX_RECOMMENDED = 3

const NO_DRILL = { seen: 0, correct: 0 }

export function buildTopicViews(
  list: readonly ProblemView[],
  drill: DrillStats,
  targets: Record<Difficulty, number>,
): Record<TopicId, TopicView> {
  const problemsOf = recordByTopic((id) => list.filter((v) => v.problem.topic === id))
  const progressOf = (id: TopicId) =>
    problemsOf[id].length ? problemsOf[id].filter((v) => v.solved).length / problemsOf[id].length : 0

  const stateOf = (id: TopicId): TopicState => {
    const problems = problemsOf[id]
    const solved = problems.filter((v) => v.solved).length
    if (problems.length > 0 && solved === problems.length) return 'complete'
    if (solved > 0) return 'active'
    return TOPIC_BY_ID[id].deps.every((dep) => progressOf(dep) >= READY_THRESHOLD) ? 'ready' : 'ahead'
  }

  const states = recordByTopic(stateOf)
  const recommended = new Set<TopicId>(
    [
      ...ROADMAP_ORDER.filter((id) => states[id] === 'active'),
      ...ROADMAP_ORDER.filter((id) => states[id] === 'ready'),
    ].slice(0, MAX_RECOMMENDED),
  )

  return recordByTopic((id) => {
    const problems = problemsOf[id]
    const solved = problems.filter((v) => v.solved).length
    return {
      topic: TOPIC_BY_ID[id],
      problems,
      total: problems.length,
      solved,
      mastered: problems.filter((v) => v.status === 'mastered').length,
      due: problems.filter((v) => v.status === 'due').length,
      progress: progressOf(id),
      state: states[id],
      recommended: recommended.has(id),
      ...topicStrength(problems, drill.byTopic[id] ?? NO_DRILL, targets),
      next: problems.find((v) => !v.solved)?.problem ?? null,
    }
  })
}
