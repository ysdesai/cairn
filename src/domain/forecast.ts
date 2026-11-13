/**
 * How many revisions are coming over the next two weeks, with the daily cap applied.
 *
 * A day-by-day simulation: each day the backlog is whatever was carried over plus whatever
 * becomes due; up to `cap` are done (today: cap minus revisions already logged), the rest carry.
 * A simulated revision is assumed to go one rung up the ladder ("Struggled") and comes back
 * after its next interval if that lands inside the window. Earliest-due goes first.
 */
import type { Attempt, ISODate } from '../state/schema'
import { addDays, diffDays } from './dates'
import { reviewsDoneOn } from './queue'
import { replay } from './srs'
import type { ForecastDay, ProblemView } from './types'

export const FORECAST_DAYS = 14

interface Pending {
  /** Position in the list, for stable ordering. */
  index: number
  /** Day offset from today; zero or less means already due. */
  dueOffset: number
  /** Real attempts plus the simulated revisions so far. */
  attempts: readonly Attempt[]
}

export function buildForecast(
  list: readonly ProblemView[],
  today: ISODate,
  cap: number,
  days: number = FORECAST_DAYS,
): ForecastDay[] {
  const slots = Math.max(0, Math.floor(cap))
  let pending: Pending[] = []
  list.forEach((view, index) => {
    if (view.srs?.due) pending.push({ index, dueOffset: diffDays(today, view.srs.due), attempts: view.attempts })
  })

  const out: ForecastDay[] = []
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(today, offset)
    const capacity = offset === 0 ? Math.max(0, slots - reviewsDoneOn(list, today)) : slots

    const available = pending
      .filter((p) => p.dueOffset <= offset)
      .sort((a, b) => a.dueOffset - b.dueOffset || a.index - b.index)
    const doing = new Set(available.slice(0, capacity))

    const returning: Pending[] = []
    for (const p of doing) {
      // Replaying keeps the simulation on the real rules; `at` puts it after any same-day attempt.
      const simulated: Attempt = {
        id: 'forecast',
        date,
        at: Number.MAX_SAFE_INTEGER,
        rating: 'struggled',
        minutes: null,
        mistakes: [],
        source: 'manual',
      }
      const attempts = [...p.attempts, simulated]
      const due = replay(attempts)?.due
      if (due && diffDays(today, due) < days) returning.push({ index: p.index, dueOffset: diffDays(today, due), attempts })
    }

    pending = [...pending.filter((p) => !doing.has(p)), ...returning]
    out.push({ date, offset, scheduled: doing.size, carried: available.length - doing.size })
  }
  return out
}
