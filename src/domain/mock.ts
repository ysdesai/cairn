/**
 * Mock interviews: choosing the two problems.
 *
 * The pool is every problem matching the config: `pool` (any / solved only / unsolved only) and
 * `topics` (empty = all). `mix` fixes the two difficulties; 'any' draws both at random.
 * The two problems come from different topics when the pool allows it, easier one first.
 * If the pool cannot satisfy the mix, relax the mix (nearest difficulty) before giving up;
 * return as many as can be found (possibly 1 or 0) and let the UI explain.
 */
import type { Difficulty, Problem } from '../data/types'
import type { MockConfig, MockMix } from '../state/schema'
import { pick, type Rng } from './rng'
import type { ProblemView } from './types'

export const MOCK_PROBLEM_COUNT = 2

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }

/** The difficulty wanted for the first and second problem. null leaves that slot open. */
const MIX_WANTS: Record<MockMix, readonly [Difficulty | null, Difficulty | null]> = {
  any: [null, null],
  'easy-medium': ['easy', 'medium'],
  'medium-medium': ['medium', 'medium'],
  'medium-hard': ['medium', 'hard'],
}

function matching(config: MockConfig, list: readonly ProblemView[]): Problem[] {
  return list
    .filter((v) => {
      if (config.pool === 'solved' && !v.solved) return false
      if (config.pool === 'unsolved' && v.solved) return false
      return config.topics.length === 0 || config.topics.includes(v.problem.topic)
    })
    .map((v) => v.problem)
}

/** How many problems match the config's pool and topics. */
export function mockPoolSize(config: MockConfig, list: readonly ProblemView[]): number {
  return matching(config, list).length
}

export function pickMockProblems(config: MockConfig, list: readonly ProblemView[], rng: Rng): Problem[] {
  const pool = matching(config, list)
  if (pool.length < MOCK_PROBLEM_COUNT) return pool

  const wants = MIX_WANTS[config.mix]
  const miss = (p: Problem, want: Difficulty | null) => (want ? Math.abs(RANK[p.difficulty] - RANK[want]) : 0)

  // Every ordered pair is scored: total difficulty miss first (0 means the mix is met exactly,
  // so relaxing happens only when it must), then a shared topic as the tie-break. The lowest
  // cost wins and ties are drawn at random.
  let best: [Problem, Problem][] = []
  let bestCost = Infinity
  for (const first of pool) {
    for (const second of pool) {
      if (first === second) continue
      const cost = (miss(first, wants[0]) + miss(second, wants[1])) * 2 + (first.topic === second.topic ? 1 : 0)
      if (cost < bestCost) {
        bestCost = cost
        best = []
      }
      if (cost === bestCost) best.push([first, second])
    }
  }

  // Stable sort: two of the same difficulty stay in the order they were drawn.
  return [...pick(rng, best)].sort((a, b) => RANK[a.difficulty] - RANK[b.difficulty])
}
