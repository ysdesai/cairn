/**
 * Standing: counts, activity, streak, plan versus actual, mistakes and difficulty.
 *
 * Activity counts solves (a problem's first attempt) and revisions (later attempts) by their date.
 *
 * Streak: consecutive days with at least one solve or revision. The current streak is still
 * alive if yesterday was active and today is not yet.
 *
 * Plan: a straight line from 0 on the day before startDate to all problems on targetDate.
 *   totalDays     start…target inclusive, at least 1
 *   dayNumber     1 on the start date; 0 before it
 *   daysLeft      today…target inclusive; 0 once past the target
 *   expected      round(total × clamp(dayNumber / totalDays, 0, 1))
 *   status        done (all solved) · not-started (nothing solved and dayNumber ≤ 1)
 *                 · ahead (delta ≥ 2) · behind (delta ≤ −2) · on-pace otherwise
 *   neededPerDay  remaining / max(1, daysLeft)
 *   recentPerDay  first solves in the last 14 days ÷ 14 (÷ dayNumber while the plan is younger than that)
 *   projectedFinish  today + ceil(remaining / pace) using the recent pace, or the overall pace if
 *                 the recent pace is 0; null if both are 0; the last solve's date when done
 *   series        one point per day from startDate to max(targetDate, today); `actual` is the
 *                 cumulative number of problems first solved on or before that day (solves dated
 *                 before startDate are included from the first point), null after today
 */
import { TOPICS } from '../data'
import type { Difficulty, TopicId } from '../data/types'
import { MISTAKE_TAGS, type ISODate, type MistakeTag, type Settings } from '../state/schema'
import { addDays, diffDays, eachDay, maxISO } from './dates'
import type {
  ActivityDay,
  ActivityStats,
  Counts,
  DifficultyStat,
  MistakeStats,
  PaceStatus,
  PlanStats,
  ProblemView,
  StreakStats,
} from './types'

const RECENT_DAYS = 14
/** Problems ahead of or behind the line before the status says so. */
const PACE_BAND = 2

export function buildCounts(list: readonly ProblemView[]): Counts {
  const count = (status: ProblemView['status']) => list.filter((v) => v.status === status).length
  return {
    total: list.length,
    solved: list.filter((v) => v.solved).length,
    mastered: count('mastered'),
    learning: count('learning'),
    due: count('due'),
    todo: count('todo'),
  }
}

export function buildActivity(list: readonly ProblemView[]): ActivityStats {
  const days: Record<ISODate, ActivityDay> = {}
  let totalMinutes = 0
  for (const view of list) {
    view.attempts.forEach((a, i) => {
      const day = (days[a.date] ??= { date: a.date, solves: 0, reviews: 0, total: 0, minutes: 0 })
      if (i === 0) day.solves += 1
      else day.reviews += 1
      day.total += 1
      day.minutes += a.minutes ?? 0
      totalMinutes += a.minutes ?? 0
    })
  }
  const totals = Object.values(days).map((d) => d.total)
  return { days, max: Math.max(1, ...totals), activeDays: totals.length, totalMinutes }
}

export function buildStreak(activity: ActivityStats, today: ISODate): StreakStats {
  const active = (date: ISODate) => (activity.days[date]?.total ?? 0) > 0
  const activeToday = active(today)

  // Days after today (a mistyped date) never count, so best can never be below current.
  const past = Object.keys(activity.days)
    .filter((d) => d <= today && active(d))
    .sort()
  let best = 0
  let run = 0
  past.forEach((date, i) => {
    run = i > 0 && diffDays(past[i - 1], date) === 1 ? run + 1 : 1
    best = Math.max(best, run)
  })

  let current = 0
  for (let date = activeToday ? today : addDays(today, -1); active(date); date = addDays(date, -1)) current += 1

  return {
    current,
    best,
    activeToday,
    lastActive: past.length ? past[past.length - 1] : null,
    recent: eachDay(addDays(today, 1 - RECENT_DAYS), today).map(active),
  }
}

export function buildPlan(list: readonly ProblemView[], settings: Settings, today: ISODate): PlanStats {
  const { startDate, targetDate } = settings
  const total = list.length
  // The first attempt of each solved problem, oldest first.
  const solveDates = list
    .filter((v) => v.solved)
    .map((v) => v.attempts[0].date)
    .sort()
  const solved = solveDates.length
  const remaining = total - solved

  const totalDays = Math.max(1, diffDays(startDate, targetDate) + 1)
  const dayNumber = Math.max(0, diffDays(startDate, today) + 1)
  const daysLeft = Math.max(0, diffDays(today, targetDate) + 1)
  // Integer arithmetic, halves rounding up: 150 * (11 / 60) is 27.499999999999996 in floating point.
  const plannedByDay = (day: number) => {
    const done = Math.min(totalDays, Math.max(0, day))
    return Math.floor((2 * total * done + totalDays) / (2 * totalDays))
  }
  const expected = plannedByDay(dayNumber)
  const delta = solved - expected

  let status: PaceStatus
  if (remaining === 0) status = 'done'
  else if (solved === 0 && dayNumber <= 1) status = 'not-started'
  else if (delta >= PACE_BAND) status = 'ahead'
  else if (delta <= -PACE_BAND) status = 'behind'
  else status = 'on-pace'

  const recentSolves = solveDates.filter((d) => d > addDays(today, -RECENT_DAYS) && d <= today).length
  // Before the start date dayNumber is 0; dividing by 1 keeps the rates finite.
  const recentDays = Math.min(RECENT_DAYS, Math.max(1, dayNumber))
  const overallDays = Math.max(1, dayNumber)

  // Kept as a count over days so the ceiling below is not thrown off by float rounding.
  const [paceSolves, paceDays] = recentSolves > 0 ? [recentSolves, recentDays] : [solved, overallDays]
  let projectedFinish: ISODate | null = null
  if (remaining === 0) projectedFinish = solveDates.length ? solveDates[solveDates.length - 1] : null
  else if (paceSolves > 0) projectedFinish = addDays(today, Math.ceil((remaining * paceDays) / paceSolves))

  // Never empty, even if the target lies before the start date.
  const lastDay = maxISO(maxISO(targetDate, today), startDate)
  let seen = 0
  const series = eachDay(startDate, lastDay).map((date) => {
    while (seen < solveDates.length && solveDates[seen] <= date) seen += 1
    return {
      date,
      actual: date > today ? null : seen,
      planned: plannedByDay(diffDays(startDate, date) + 1),
    }
  })

  return {
    startDate,
    targetDate,
    totalDays,
    dayNumber,
    daysLeft,
    total,
    solved,
    remaining,
    expected,
    delta,
    status,
    neededPerDay: remaining / Math.max(1, daysLeft),
    recentPerDay: recentSolves / recentDays,
    overallPerDay: solved / overallDays,
    projectedFinish,
    series,
  }
}

export function buildMistakes(list: readonly ProblemView[]): MistakeStats {
  const tagCounts = new Map<MistakeTag, number>(MISTAKE_TAGS.map((t) => [t.id, 0]))
  const topicCounts = new Map<TopicId, Partial<Record<MistakeTag, number>>>()
  let total = 0
  for (const view of list) {
    for (const a of view.attempts) {
      // A tag repeated within one attempt is still one mistake.
      for (const tag of new Set(a.mistakes)) {
        total += 1
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        const byTag = topicCounts.get(view.problem.topic) ?? {}
        byTag[tag] = (byTag[tag] ?? 0) + 1
        topicCounts.set(view.problem.topic, byTag)
      }
    }
  }

  // Array sort is stable, so ties keep the tag list and topic listing order.
  const byTag = [...tagCounts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)
  const byTopic = TOPICS.filter((t) => topicCounts.has(t.id))
    .map((t) => {
      const tags = topicCounts.get(t.id)!
      return { topic: t.id, total: Object.values(tags).reduce((sum, n) => sum + n, 0), byTag: tags }
    })
    .sort((a, b) => b.total - a.total)
  return { total, byTag, byTopic }
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

export function buildDifficulty(
  list: readonly ProblemView[],
  targets: Record<Difficulty, number>,
): DifficultyStat[] {
  return DIFFICULTIES.map((difficulty) => {
    const views = list.filter((v) => v.problem.difficulty === difficulty)
    // Only the first attempt counts: revisions are quicker and would flatter the average.
    const firstTimes = views.flatMap((v) => (v.attempts[0]?.minutes != null ? [v.attempts[0].minutes] : []))
    return {
      difficulty,
      total: views.length,
      solved: views.filter((v) => v.solved).length,
      mastered: views.filter((v) => v.status === 'mastered').length,
      avgMinutes: firstTimes.length ? firstTimes.reduce((a, b) => a + b, 0) / firstTimes.length : null,
      target: targets[difficulty],
    }
  })
}
