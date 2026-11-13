/**
 * A 0–100 strength score per topic, from four ingredients (each 0…1, or null without data):
 *
 * ratings    Per solved problem, the recency-weighted mean of its attempt ratings
 *            (Easy 1, Struggled 0.55, Needed help 0.15; latest attempt weight 1, then ×0.6 each
 *            step back). The topic value is the mean over solved problems.
 * pace       Per timed attempt, minutes against the target: at or under target scores 1, twice
 *            the target scores 0, linear in between. A revision is held to 60% of the target.
 * retention  Per problem that has been revised at least once or is mastered:
 *            0.6 × (step / LADDER.length) + 0.4 × (1 − lapses / reviews). Mean over those problems.
 * drill      Pattern-drill accuracy on this topic's problems, smoothed: (correct + 1) / (seen + 2).
 *
 * strength = 100 × weighted mean of the ingredients that have data, with weights
 * ratings 0.40, retention 0.25, drill 0.20, pace 0.15. null when none has data.
 *
 * A topic is only scored once at least one of its problems is solved. Until then strength is
 * null, confidence is 'none' and weakness is null, whatever the drill says: drill accuracy
 * alone says nothing about whether you can solve the problems (`parts.drill` is still reported,
 * so a screen may show it as a drill-only figure). Topics with nothing solved are uncharted.
 *
 * confidence counts the evidence (attempts + drill cards): 0 none, <4 low, <12 medium, else high.
 * weakness names the lowest ingredient when it is under 0.6, in plain words with its number.
 */
import type { Difficulty } from '../data/types'
import type { Rating } from '../state/schema'
import { LADDER } from './srs'
import type { ProblemView, StrengthParts, TopicView } from './types'

export const STRENGTH_WEIGHTS: Record<keyof StrengthParts, number> = {
  ratings: 0.4,
  retention: 0.25,
  drill: 0.2,
  pace: 0.15,
}

export interface StrengthResult {
  strength: number | null
  parts: StrengthParts
  confidence: TopicView['confidence']
  weakness: string | null
}

/** Below this a started topic is treated as a weak area. */
export const WEAK_BELOW = 55

/** An ingredient under this is named as the weakness. */
const WEAKNESS_BELOW = 0.6
const RATING_VALUE: Record<Rating, number> = { easy: 1, struggled: 0.55, help: 0.15 }
const RECENCY_DECAY = 0.6
const REVISION_TARGET_PERCENT = 60
/** When two ingredients tie for lowest, the one with more weight is named. */
const WEAKNESS_ORDER: readonly (keyof StrengthParts)[] = ['ratings', 'retention', 'drill', 'pace']

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** Weighted mean of a problem's attempt ratings, the latest attempt counting most. */
function ratingScore(view: ProblemView): number {
  let sum = 0
  let weights = 0
  let weight = 1
  for (let i = view.attempts.length - 1; i >= 0; i--) {
    sum += weight * RATING_VALUE[view.attempts[i].rating]
    weights += weight
    weight *= RECENCY_DECAY
  }
  return sum / weights
}

/** Scores for every timed attempt: 1 at or under target, 0 at twice the target. */
function paceScores(problems: readonly ProblemView[], targets: Record<Difficulty, number>): number[] {
  const scores: number[] = []
  for (const view of problems) {
    const target = targets[view.problem.difficulty]
    view.attempts.forEach((a, i) => {
      if (a.minutes === null) return
      // Divide last so a revision exactly on its target scores 1: 0.6 * 6 is 3.5999999999999996.
      const allowed = i === 0 ? target : (target * REVISION_TARGET_PERCENT) / 100
      scores.push(Math.min(1, Math.max(0, 2 - a.minutes / allowed)))
    })
  }
  return scores
}

function retentionScore(view: ProblemView): number | null {
  const { srs } = view
  if (!srs || (srs.reviews === 0 && !srs.mastered)) return null
  const held = srs.reviews === 0 ? 1 : 1 - srs.lapses / srs.reviews
  return 0.6 * (srs.step / LADDER.length) + 0.4 * held
}

function confidenceFor(evidence: number): TopicView['confidence'] {
  if (evidence === 0) return 'none'
  if (evidence < 4) return 'low'
  return evidence < 12 ? 'medium' : 'high'
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

function describeWeakness(
  part: keyof StrengthParts,
  parts: StrengthParts,
  problems: readonly ProblemView[],
  drill: { seen: number; correct: number },
): string {
  switch (part) {
    case 'ratings':
      return `recent ratings average ${Math.round((parts.ratings ?? 0) * 100)}%`
    case 'pace': {
      // Pace is 2 minus the time ratio before clamping, so this reads it back.
      const ratio = 2 - (parts.pace ?? 1)
      return `solve times run about ${ratio.toFixed(1)}× target`
    }
    case 'retention': {
      const lapses = problems.reduce((n, v) => n + (v.srs?.lapses ?? 0), 0)
      if (lapses === 0) return 'revisions are still early on the ladder'
      return `${WORDS[lapses] ?? lapses} ${lapses === 1 ? 'lapse' : 'lapses'} in revision`
    }
    case 'drill':
      return `${drill.correct} of ${drill.seen} drill cards right`
  }
}

/** `problems` are one topic's problems; `drill` is that topic's drill tally. */
export function topicStrength(
  problems: readonly ProblemView[],
  drill: { seen: number; correct: number },
  targets: Record<Difficulty, number>,
): StrengthResult {
  const parts: StrengthParts = {
    ratings: mean(problems.filter((v) => v.solved).map(ratingScore)),
    pace: mean(paceScores(problems, targets)),
    retention: mean(problems.map(retentionScore).filter((r): r is number => r !== null)),
    drill: drill.seen > 0 ? (drill.correct + 1) / (drill.seen + 2) : null,
  }

  // Nothing solved: drill accuracy alone must not read as strength.
  if (!problems.some((v) => v.solved)) return { strength: null, parts, confidence: 'none', weakness: null }

  let weighted = 0
  let weights = 0
  for (const key of WEAKNESS_ORDER) {
    const value = parts[key]
    if (value === null) continue
    weighted += STRENGTH_WEIGHTS[key] * value
    weights += STRENGTH_WEIGHTS[key]
  }
  // Whole numbers, so what the screen shows is what the thresholds compare.
  const strength = weights > 0 ? Math.round((100 * weighted) / weights) : null

  let weakest: keyof StrengthParts | null = null
  for (const key of WEAKNESS_ORDER) {
    const value = parts[key]
    if (value === null || value >= WEAKNESS_BELOW) continue
    if (weakest === null || value < (parts[weakest] as number)) weakest = key
  }

  const attempts = problems.reduce((n, v) => n + v.attempts.length, 0)
  return {
    strength,
    parts,
    confidence: confidenceFor(attempts + drill.seen),
    weakness: weakest ? describeWeakness(weakest, parts, problems, drill) : null,
  }
}
