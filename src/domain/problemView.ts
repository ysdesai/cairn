import type { Problem } from '../data/types'
import type { ISODate, ProblemRecord } from '../state/schema'
import { diffDays } from './dates'
import { replay, sortAttempts, statusOf } from './srs'
import type { ProblemView } from './types'

/** True when any of the four note fields has non-blank text. */
export function hasNotes(record: ProblemRecord | null): boolean {
  if (!record) return false
  const { insight, time, space, pitfalls } = record.notes
  return [insight, time, space, pitfalls].some((text) => text.trim().length > 0)
}

/** Everything the UI needs to know about one problem on a given day. */
export function viewProblem(problem: Problem, record: ProblemRecord | null, today: ISODate): ProblemView {
  const attempts = record ? sortAttempts(record.attempts) : []
  const srs = replay(attempts)
  const timed = attempts.filter((a) => a.minutes !== null)
  return {
    problem,
    record,
    attempts,
    status: statusOf(srs, today),
    solved: attempts.length > 0,
    srs,
    dueIn: srs?.due ? diffDays(today, srs.due) : null,
    hasNotes: hasNotes(record),
    lastMinutes: timed.length ? timed[timed.length - 1].minutes : null,
    bestMinutes: timed.length ? Math.min(...timed.map((a) => a.minutes as number)) : null,
    mistakes: [...new Set(attempts.flatMap((a) => a.mistakes))],
    touchedToday: attempts.some((a) => a.date === today),
  }
}
