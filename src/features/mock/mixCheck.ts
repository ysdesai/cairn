import type { Difficulty } from '../../data/types'
import type { MockConfig, MockMix } from '../../state/schema'
import type { ProblemView } from '../../domain/types'

/**
 * The difficulties each mix asks for, mirroring MIX_WANTS in domain/mock.ts (null leaves a slot
 * open). The engine relaxes a mix its pool cannot meet; this says so before the clock starts.
 */
const WANTS: Record<MockMix, readonly Difficulty[]> = {
  any: [],
  'easy-medium': ['easy', 'medium'],
  'medium-medium': ['medium', 'medium'],
  'medium-hard': ['medium', 'hard'],
}

const NAME: Record<Difficulty, string> = { easy: 'easy', medium: 'medium', hard: 'hard' }

/**
 * Null when the pool can give the mix exactly. Otherwise a short sentence naming what is
 * missing, written for the pool-count line.
 */
export function mixShortfall(config: MockConfig, list: readonly ProblemView[]): string | null {
  const wanted = WANTS[config.mix]
  if (wanted.length === 0) return null

  const have: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 }
  for (const v of list) {
    if (config.pool === 'solved' && !v.solved) continue
    if (config.pool === 'unsolved' && v.solved) continue
    if (config.topics.length > 0 && !config.topics.includes(v.problem.topic)) continue
    have[v.problem.difficulty] += 1
  }

  const need: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 }
  for (const d of wanted) need[d] += 1

  const lacking = (['easy', 'medium', 'hard'] as const).filter((d) => have[d] < need[d])
  if (lacking.length === 0) return null

  const d = lacking[0]
  const shortfall =
    have[d] === 0
      ? `No ${NAME[d]} problems in this pool`
      : `Only ${have[d]} ${NAME[d]} ${have[d] === 1 ? 'problem' : 'problems'} in this pool`
  return `${shortfall}, so the mix shifts to the nearest difficulties.`
}
