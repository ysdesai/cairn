/** Fixtures for engine tests. Not imported by the app. */
import { getProblem, PROBLEMS } from '../data'
import { EMPTY_NOTES, type Attempt, type ISODate, type Notes, type ProblemRecord, type Rating } from '../state/schema'
import { viewProblem } from './problemView'
import type { ProblemView } from './types'

let seq = 0

/** An attempt on `date`. Later calls get later `at` values, so same-day order follows call order. */
export function attempt(date: ISODate, rating: Rating, extra: Partial<Attempt> = {}): Attempt {
  seq += 1
  return { id: `t${seq}`, date, at: seq, rating, minutes: null, mistakes: [], source: 'manual', ...extra }
}

export function record(attempts: Attempt[], notes: Partial<Notes> = {}): ProblemRecord {
  return { attempts, notes: { ...EMPTY_NOTES, ...notes } }
}

/** The view of one problem with the given attempts. */
export function viewOf(slug: string, attempts: Attempt[], today: ISODate, notes: Partial<Notes> = {}): ProblemView {
  const problem = getProblem(slug)
  if (!problem) throw new Error(`unknown slug ${slug}`)
  return viewProblem(problem, attempts.length || Object.keys(notes).length ? record(attempts, notes) : null, today)
}

/** All 150 views; problems named in `history` get those attempts, the rest are untouched. */
export function listWith(history: Record<string, Attempt[]>, today: ISODate): ProblemView[] {
  for (const slug of Object.keys(history)) if (!getProblem(slug)) throw new Error(`unknown slug ${slug}`)
  return PROBLEMS.map((p) => viewProblem(p, history[p.slug] ? record(history[p.slug]) : null, today))
}
