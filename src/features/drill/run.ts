/** What a run is made of, and the small calculations the three drill views share. */
import { PATTERN_BY_ID, PROBLEMS } from '../../data'
import type { PatternId, Problem } from '../../data/types'
import type { Derived } from '../../domain/types'
import type { Rng } from '../../domain/rng'

export type Source = 'all' | 'solved' | 'weak'

export interface DrillConfig {
  size: number
  source: Source
}

export interface Card {
  problem: Problem
  options: PatternId[]
  /** performance.now() when the card was drawn. */
  shownAt: number
}

export interface Answer {
  problem: Problem
  picked: PatternId
  correct: boolean
  ms: number
}

export interface Run {
  config: DrillConfig
  /** Cards in this run: the deck size, or fewer when the pool is small. */
  total: number
  rng: Rng
  pool: Problem[]
  card: Card
  /** The option chosen on the current card, once answered. */
  picked: PatternId | null
  answers: Answer[]
}

/** How many answers a pattern needs before "Weak patterns" has anything to go on. */
export const WEAK_NEEDS = 3

export const MIN_START_SIZE = 1
export const MAX_START_SIZE = 100

export function patternName(id: PatternId): string {
  return PATTERN_BY_ID[id]?.name ?? id
}

/**
 * Slugs of a mock that is running. The drill names the pattern after every answer, which would
 * give away how a mock problem is solved, so these stay out of every pool until the mock ends.
 */
export function mockHeld(derived: Derived): ReadonlySet<string> {
  const mock = derived.activeMock
  return new Set(mock?.status === 'running' ? mock.slugs : [])
}

/** The cards a source allows. Problems without a summary cannot be played. */
export function buildPool(source: Source, derived: Derived): Problem[] {
  const weak = new Set(derived.drill.weakest.map((s) => s.pattern.id))
  const held = mockHeld(derived)
  return PROBLEMS.filter((p) => {
    if (p.summary.trim() === '') return false
    if (held.has(p.slug)) return false
    if (source === 'solved') return derived.problems[p.slug]?.solved === true
    if (source === 'weak') return weak.has(p.pattern)
    return true
  })
}

export function percent(value: number | null): number | null {
  return value == null ? null : Math.round(value * 100)
}

/** 4.2 s */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}

/** The longest unbroken run of correct answers. */
export function bestStreak(answers: readonly Answer[]): number {
  let best = 0
  let current = 0
  for (const a of answers) {
    current = a.correct ? current + 1 : 0
    best = Math.max(best, current)
  }
  return best
}

/** The streak the user is on right now. */
export function currentStreak(answers: readonly Answer[]): number {
  let n = 0
  for (let i = answers.length - 1; i >= 0 && answers[i].correct; i--) n += 1
  return n
}

export interface WatchedPattern {
  id: PatternId
  asked: number
  missed: number
}

/** Patterns missed in this run, most misses first. */
export function patternsToWatch(answers: readonly Answer[]): WatchedPattern[] {
  const by = new Map<PatternId, WatchedPattern>()
  for (const a of answers) {
    const id = a.problem.pattern
    const row = by.get(id) ?? { id, asked: 0, missed: 0 }
    row.asked += 1
    if (!a.correct) row.missed += 1
    by.set(id, row)
  }
  return [...by.values()].filter((r) => r.missed > 0).sort((a, b) => b.missed - a.missed || b.asked - a.asked)
}
