import { describe, expect, it } from 'vitest'
import { PROBLEMS } from '../data'
import type { Difficulty } from '../data/types'
import { DEFAULT_TARGETS, type Attempt, type ISODate, type Settings } from '../state/schema'
import { addDays, diffDays, eachDay } from './dates'
import { buildActivity, buildCounts, buildDifficulty, buildMistakes, buildPlan, buildStreak } from './stats'
import { attempt, listWith } from './testing'
import type { ActivityStats } from './types'

const TODAY = '2026-11-12'

// 84 days: Oct 1 to Dec 23 inclusive.
const SETTINGS: Settings = {
  startDate: '2026-10-01',
  targetDate: '2026-12-23',
  dailyReviewCap: 5,
  targets: DEFAULT_TARGETS,
  mockMinutes: 45,
  sessionMinutes: 60,
}

const slug = (i: number) => PROBLEMS[i].slug

/** The first `n` problems, each solved once on `date`. */
function solvedOn(n: number, date: ISODate, from = 0): Record<string, Attempt[]> {
  const history: Record<string, Attempt[]> = {}
  for (let i = from; i < from + n; i++) history[slug(i)] = [attempt(date, 'easy')]
  return history
}

function firstOf(difficulty: Difficulty, skip = 0) {
  return PROBLEMS.filter((p) => p.difficulty === difficulty)[skip]
}

describe('buildCounts', () => {
  it('counts an empty list as zeros', () => {
    expect(buildCounts([])).toEqual({ total: 0, solved: 0, mastered: 0, learning: 0, due: 0, todo: 0 })
  })

  it('has everything to do before anything is logged', () => {
    expect(buildCounts(listWith({}, TODAY))).toEqual({
      total: 150,
      solved: 0,
      mastered: 0,
      learning: 0,
      due: 0,
      todo: 150,
    })
  })

  it('splits solved problems into learning, due and mastered', () => {
    const list = listWith(
      {
        // Solved today: next revision is in the future.
        [slug(0)]: [attempt(TODAY, 'easy')],
        // Solved long ago: overdue.
        [slug(1)]: [attempt('2026-10-01', 'easy')],
        [slug(2)]: [attempt('2026-10-02', 'help')],
        // Three easy attempts clear the ladder.
        [slug(3)]: [attempt('2026-06-01', 'easy'), attempt('2026-07-01', 'easy'), attempt('2026-09-01', 'easy')],
      },
      TODAY,
    )
    expect(buildCounts(list)).toEqual({
      total: 150,
      solved: 4,
      mastered: 1,
      learning: 1,
      due: 2,
      todo: 146,
    })
  })

  it('has all 150 mastered when every problem has cleared the ladder', () => {
    const history: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS) {
      history[p.slug] = [attempt('2026-06-01', 'easy'), attempt('2026-07-01', 'easy'), attempt('2026-09-01', 'easy')]
    }
    expect(buildCounts(listWith(history, TODAY))).toEqual({
      total: 150,
      solved: 150,
      mastered: 150,
      learning: 0,
      due: 0,
      todo: 0,
    })
  })

  it('has every solved problem in exactly one of mastered, learning or due', () => {
    const list = listWith(solvedOn(20, '2026-11-05'), TODAY)
    const c = buildCounts(list)
    expect(c.mastered + c.learning + c.due).toBe(c.solved)
    expect(c.solved + c.todo).toBe(c.total)
  })
})

describe('buildActivity', () => {
  it('is empty with no history', () => {
    expect(buildActivity(listWith({}, TODAY))).toEqual({ days: {}, max: 1, activeDays: 0, totalMinutes: 0 })
  })

  it('counts the first attempt as a solve and later ones as revisions', () => {
    const list = listWith(
      {
        [slug(0)]: [
          attempt('2026-11-01', 'easy', { minutes: 10 }),
          attempt('2026-11-02', 'easy', { minutes: 5 }),
          attempt('2026-11-04', 'struggled'),
        ],
        [slug(1)]: [attempt('2026-11-02', 'help', { minutes: 30 })],
      },
      TODAY,
    )
    const a = buildActivity(list)
    expect(a.days['2026-11-01']).toEqual({ date: '2026-11-01', solves: 1, reviews: 0, total: 1, minutes: 10 })
    expect(a.days['2026-11-02']).toEqual({ date: '2026-11-02', solves: 1, reviews: 1, total: 2, minutes: 35 })
    expect(a.days['2026-11-04']).toEqual({ date: '2026-11-04', solves: 0, reviews: 1, total: 1, minutes: 0 })
    expect(a.days['2026-11-03']).toBeUndefined()
    expect(a.activeDays).toBe(3)
    expect(a.max).toBe(2)
    expect(a.totalMinutes).toBe(45)
  })

  it('treats the chronologically first attempt as the solve even when it was logged last', () => {
    const list = listWith(
      { [slug(0)]: [attempt('2026-11-05', 'easy'), attempt('2026-11-01', 'help')] },
      TODAY,
    )
    const a = buildActivity(list)
    expect(a.days['2026-11-01'].solves).toBe(1)
    expect(a.days['2026-11-05'].reviews).toBe(1)
  })

  it('splits several attempts on one problem and one day into a solve and revisions', () => {
    const list = listWith(
      { [slug(0)]: [attempt('2026-11-03', 'help', { minutes: 20 }), attempt('2026-11-03', 'easy', { minutes: 6 })] },
      TODAY,
    )
    const a = buildActivity(list)
    expect(a.days['2026-11-03']).toEqual({ date: '2026-11-03', solves: 1, reviews: 1, total: 2, minutes: 26 })
  })

  it('keeps attempts dated in the future on their own day', () => {
    const a = buildActivity(listWith({ [slug(0)]: [attempt('2026-12-30', 'easy')] }, TODAY))
    expect(a.days['2026-12-30'].solves).toBe(1)
  })

  it('counts several solves on one day', () => {
    const a = buildActivity(listWith(solvedOn(7, '2026-11-03'), TODAY))
    expect(a.days['2026-11-03'].solves).toBe(7)
    expect(a.max).toBe(7)
    expect(a.activeDays).toBe(1)
  })
})

function activityOn(...dates: ISODate[]): ActivityStats {
  return {
    days: Object.fromEntries(dates.map((d) => [d, { date: d, solves: 1, reviews: 0, total: 1, minutes: 0 }])),
    max: 1,
    activeDays: dates.length,
    totalMinutes: 0,
  }
}

describe('buildStreak', () => {
  it('is zero with no activity', () => {
    const s = buildStreak(activityOn(), TODAY)
    expect(s).toEqual({
      current: 0,
      best: 0,
      activeToday: false,
      lastActive: null,
      recent: Array(14).fill(false),
    })
  })

  it('counts consecutive days ending today', () => {
    const s = buildStreak(activityOn('2026-11-10', '2026-11-11', TODAY), TODAY)
    expect(s.current).toBe(3)
    expect(s.best).toBe(3)
    expect(s.activeToday).toBe(true)
    expect(s.lastActive).toBe(TODAY)
  })

  it('stays alive when yesterday was active and today is not yet', () => {
    const s = buildStreak(activityOn('2026-11-09', '2026-11-10', '2026-11-11'), TODAY)
    expect(s.current).toBe(3)
    expect(s.activeToday).toBe(false)
    expect(s.lastActive).toBe('2026-11-11')
  })

  it('is broken once a whole day is missed', () => {
    const s = buildStreak(activityOn('2026-11-08', '2026-11-09', '2026-11-10'), TODAY)
    expect(s.current).toBe(0)
    expect(s.best).toBe(3)
    expect(s.lastActive).toBe('2026-11-10')
  })

  it('keeps the best run from earlier', () => {
    const s = buildStreak(
      activityOn('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-11', TODAY),
      TODAY,
    )
    expect(s.current).toBe(2)
    expect(s.best).toBe(4)
  })

  it('counts a single active day as a streak of one', () => {
    const s = buildStreak(activityOn(TODAY), TODAY)
    expect(s.current).toBe(1)
    expect(s.best).toBe(1)
  })

  it('crosses month and year boundaries', () => {
    const s = buildStreak(activityOn('2026-12-30', '2026-12-31', '2027-01-01'), '2027-01-01')
    expect(s.current).toBe(3)
  })

  it('lists the last 14 days oldest first', () => {
    const s = buildStreak(activityOn('2026-10-30', '2026-11-10', TODAY), TODAY)
    expect(s.recent).toHaveLength(14)
    // Oct 30 is 13 days before Nov 12: the first slot.
    expect(s.recent[0]).toBe(true)
    expect(s.recent[1]).toBe(false)
    expect(s.recent[11]).toBe(true)
    expect(s.recent[12]).toBe(false)
    expect(s.recent[13]).toBe(true)
  })

  it('leaves out a day just beyond the 14-day window', () => {
    const s = buildStreak(activityOn('2026-10-29'), TODAY)
    expect(s.recent.every((x) => !x)).toBe(true)
  })

  it('ignores activity dated after today', () => {
    const s = buildStreak(activityOn('2026-11-20', '2026-11-21', '2026-11-22'), TODAY)
    expect(s.current).toBe(0)
    expect(s.best).toBe(0)
    expect(s.lastActive).toBeNull()
  })

  it('counts a year of unbroken days', () => {
    const dates = eachDay('2025-11-13', TODAY)
    const s = buildStreak(activityOn(...dates), TODAY)
    expect(dates).toHaveLength(365)
    expect(s.current).toBe(365)
    expect(s.best).toBe(365)
    expect(s.recent.every(Boolean)).toBe(true)
  })

  it('picks the longest run out of a long history with gaps', () => {
    const dates = [...eachDay('2026-01-01', '2026-01-10'), ...eachDay('2026-03-01', '2026-03-20'), ...eachDay('2026-11-01', '2026-11-05')]
    const s = buildStreak(activityOn(...dates), TODAY)
    expect(s.best).toBe(20)
    expect(s.current).toBe(0)
    expect(s.lastActive).toBe('2026-11-05')
  })

  it('counts a day once however many attempts it holds', () => {
    const list = listWith(
      {
        [slug(0)]: [attempt('2026-11-11', 'easy'), attempt('2026-11-11', 'easy'), attempt('2026-11-11', 'help')],
        [slug(1)]: [attempt('2026-11-11', 'easy')],
      },
      TODAY,
    )
    const s = buildStreak(buildActivity(list), TODAY)
    expect(s.current).toBe(1)
    expect(s.best).toBe(1)
  })

  it('does not let a future day extend the current streak', () => {
    const s = buildStreak(activityOn('2026-11-11', TODAY, '2026-11-13'), TODAY)
    expect(s.current).toBe(2)
    expect(s.best).toBe(2)
  })

  it('reads a real history', () => {
    const list = listWith(
      {
        [slug(0)]: [attempt('2026-11-10', 'easy'), attempt('2026-11-12', 'easy')],
        [slug(1)]: [attempt('2026-11-11', 'easy')],
      },
      TODAY,
    )
    const s = buildStreak(buildActivity(list), TODAY)
    expect(s.current).toBe(3)
    expect(s.activeToday).toBe(true)
  })
})

describe('buildPlan: the calendar', () => {
  const list = listWith({}, TODAY)

  it('counts days from the start date', () => {
    const p = buildPlan(list, SETTINGS, TODAY)
    expect(p.totalDays).toBe(84)
    expect(p.dayNumber).toBe(43)
    expect(p.daysLeft).toBe(42)
    expect(p.total).toBe(150)
  })

  it('is day 1 on the start date', () => {
    const p = buildPlan(list, SETTINGS, '2026-10-01')
    expect(p.dayNumber).toBe(1)
    expect(p.daysLeft).toBe(84)
  })

  it('is day 0 before the start date, with the whole plan still ahead', () => {
    const p = buildPlan(list, SETTINGS, '2026-09-20')
    expect(p.dayNumber).toBe(0)
    expect(p.expected).toBe(0)
    expect(p.daysLeft).toBe(diffDays('2026-09-20', '2026-12-23') + 1)
    expect(p.status).toBe('not-started')
  })

  it('has no days left once past the target, and a day number beyond the total', () => {
    const p = buildPlan(list, SETTINGS, '2027-01-05')
    expect(p.dayNumber).toBe(97)
    expect(p.daysLeft).toBe(0)
    expect(p.expected).toBe(150)
  })

  it('has one day left on the target date', () => {
    const p = buildPlan(list, SETTINGS, '2026-12-23')
    expect(p.dayNumber).toBe(84)
    expect(p.daysLeft).toBe(1)
  })

  it('plans at least one day when the target is not after the start', () => {
    const p = buildPlan(list, { ...SETTINGS, targetDate: '2026-10-01' }, '2026-10-01')
    expect(p.totalDays).toBe(1)
    expect(p.expected).toBe(150)
    const before = buildPlan(list, { ...SETTINGS, targetDate: '2026-09-01' }, '2026-10-05')
    expect(before.totalDays).toBe(1)
    expect(before.series.length).toBeGreaterThan(0)
  })
})

describe('buildPlan: expected and status', () => {
  it('expects a straight line, rounded', () => {
    const list = listWith({}, TODAY)
    expect(buildPlan(list, SETTINGS, '2026-10-01').expected).toBe(2) // 150 / 84
    expect(buildPlan(list, SETTINGS, '2026-11-11').expected).toBe(75) // day 42 of 84
    expect(buildPlan(list, SETTINGS, '2026-12-23').expected).toBe(150)
  })

  it('is not-started with nothing solved on the first day or before', () => {
    const list = listWith({}, TODAY)
    expect(buildPlan(list, SETTINGS, '2026-10-01').status).toBe('not-started')
    expect(buildPlan(list, SETTINGS, '2026-09-01').status).toBe('not-started')
  })

  it('is behind with nothing solved once the plan is under way', () => {
    const p = buildPlan(listWith({}, TODAY), SETTINGS, '2026-10-02')
    expect(p.status).toBe('behind')
    expect(p.delta).toBe(-4)
  })

  it('is on-pace with a solve on the first day', () => {
    const p = buildPlan(listWith(solvedOn(1, '2026-10-01'), '2026-10-01'), SETTINGS, '2026-10-01')
    expect(p.status).toBe('on-pace')
    expect(p.delta).toBe(-1)
  })

  it('is ahead from two problems over the line, but not from one', () => {
    // Day 43: expected 77.
    const one = buildPlan(listWith(solvedOn(78, '2026-11-01'), TODAY), SETTINGS, TODAY)
    expect(one.expected).toBe(77)
    expect(one.delta).toBe(1)
    expect(one.status).toBe('on-pace')
    const two = buildPlan(listWith(solvedOn(79, '2026-11-01'), TODAY), SETTINGS, TODAY)
    expect(two.delta).toBe(2)
    expect(two.status).toBe('ahead')
  })

  it('is behind from two problems under the line, but not from one', () => {
    const one = buildPlan(listWith(solvedOn(76, '2026-11-01'), TODAY), SETTINGS, TODAY)
    expect(one.delta).toBe(-1)
    expect(one.status).toBe('on-pace')
    const two = buildPlan(listWith(solvedOn(75, '2026-11-01'), TODAY), SETTINGS, TODAY)
    expect(two.delta).toBe(-2)
    expect(two.status).toBe('behind')
  })

  it('is done when everything is solved, whenever it happened', () => {
    const history = solvedOn(150, '2026-10-20')
    expect(buildPlan(listWith(history, TODAY), SETTINGS, TODAY).status).toBe('done')
    expect(buildPlan(listWith(history, '2026-09-01'), SETTINGS, '2026-09-01').status).toBe('done')
    expect(buildPlan(listWith(history, '2027-02-01'), SETTINGS, '2027-02-01').status).toBe('done')
  })

  it('stays behind after the target with problems left', () => {
    const p = buildPlan(listWith(solvedOn(100, '2026-11-01'), '2027-01-05'), SETTINGS, '2027-01-05')
    expect(p.status).toBe('behind')
    expect(p.delta).toBe(-50)
  })
})

describe('buildPlan: rates', () => {
  it('needs the remaining problems spread over the days left', () => {
    const p = buildPlan(listWith(solvedOn(50, '2026-11-01'), TODAY), SETTINGS, TODAY)
    expect(p.remaining).toBe(100)
    expect(p.neededPerDay).toBeCloseTo(100 / 42)
  })

  it('needs all remaining problems today when past the target', () => {
    const p = buildPlan(listWith(solvedOn(50, '2026-11-01'), '2027-01-05'), SETTINGS, '2027-01-05')
    expect(p.neededPerDay).toBe(100)
  })

  it('needs nothing when done', () => {
    const p = buildPlan(listWith(solvedOn(150, '2026-11-01'), TODAY), SETTINGS, TODAY)
    expect(p.neededPerDay).toBe(0)
  })

  it('divides the last 14 days by 14', () => {
    // The window is Oct 30 to Nov 12. Oct 29 falls outside it.
    const history = {
      ...solvedOn(7, TODAY, 0),
      ...solvedOn(7, '2026-10-30', 7),
      ...solvedOn(5, '2026-10-29', 14),
    }
    const p = buildPlan(listWith(history, TODAY), SETTINGS, TODAY)
    expect(p.recentPerDay).toBe(14 / 14)
    expect(p.solved).toBe(19)
    expect(p.overallPerDay).toBeCloseTo(19 / 43)
  })

  it('divides by the plan age while the plan is under 14 days old', () => {
    const p = buildPlan(listWith(solvedOn(10, '2026-10-02'), '2026-10-05'), SETTINGS, '2026-10-05')
    expect(p.dayNumber).toBe(5)
    expect(p.recentPerDay).toBe(2)
    expect(p.overallPerDay).toBe(2)
  })

  it('does not count revisions as problems solved', () => {
    const list = listWith(
      { [slug(0)]: [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'easy'), attempt('2026-11-10', 'easy')] },
      TODAY,
    )
    const p = buildPlan(list, SETTINGS, TODAY)
    expect(p.solved).toBe(1)
    expect(p.recentPerDay).toBeCloseTo(1 / 14)
  })

  it('has zero rates with no history', () => {
    const p = buildPlan(listWith({}, TODAY), SETTINGS, TODAY)
    expect(p.recentPerDay).toBe(0)
    expect(p.overallPerDay).toBe(0)
  })
})

describe('buildPlan: projected finish', () => {
  it('is null with no pace at all', () => {
    expect(buildPlan(listWith({}, TODAY), SETTINGS, TODAY).projectedFinish).toBeNull()
  })

  it('uses the recent pace', () => {
    // 14 solves in the window: one a day, 136 left.
    const p = buildPlan(listWith(solvedOn(14, '2026-11-10'), TODAY), SETTINGS, TODAY)
    expect(p.recentPerDay).toBe(1)
    expect(p.projectedFinish).toBe(addDays(TODAY, 136))
  })

  it('rounds up to a whole day', () => {
    // 147 left at 3 solves per 14 days divides exactly; the others below need rounding up.
    const exact = buildPlan(listWith(solvedOn(3, '2026-11-10'), TODAY), SETTINGS, TODAY)
    expect(exact.projectedFinish).toBe(addDays(TODAY, 686))
    const up = buildPlan(listWith(solvedOn(4, '2026-11-10'), TODAY), SETTINGS, TODAY)
    // 146 * 14 / 4 = 511
    expect(up.projectedFinish).toBe(addDays(TODAY, 511))
    const odd = buildPlan(listWith(solvedOn(5, '2026-11-10'), TODAY), SETTINGS, TODAY)
    // 145 * 14 / 5 = 406
    expect(odd.projectedFinish).toBe(addDays(TODAY, 406))
    const frac = buildPlan(listWith(solvedOn(6, '2026-11-10'), TODAY), SETTINGS, TODAY)
    // 144 * 14 / 6 = 336
    expect(frac.projectedFinish).toBe(addDays(TODAY, 336))
    const ceil = buildPlan(listWith(solvedOn(9, '2026-11-10'), TODAY), SETTINGS, TODAY)
    // 141 * 14 / 9 = 219.33
    expect(ceil.projectedFinish).toBe(addDays(TODAY, 220))
  })

  it('falls back to the overall pace when nothing was solved recently', () => {
    const p = buildPlan(listWith(solvedOn(5, '2026-10-02'), TODAY), SETTINGS, TODAY)
    expect(p.recentPerDay).toBe(0)
    // 145 left at 5 per 43 days: 145 * 43 / 5 = 1247
    expect(p.projectedFinish).toBe(addDays(TODAY, 1247))
  })

  it('is the date of the last solve when done', () => {
    const history = { ...solvedOn(149, '2026-10-20'), [slug(149)]: [attempt('2026-11-09', 'easy')] }
    const p = buildPlan(listWith(history, TODAY), SETTINGS, TODAY)
    expect(p.status).toBe('done')
    expect(p.projectedFinish).toBe('2026-11-09')
  })

  it('ignores a revision when finding the date of the last solve', () => {
    const history = {
      ...solvedOn(149, '2026-10-20', 1),
      [slug(0)]: [attempt('2026-10-21', 'easy'), attempt('2026-11-11', 'easy')],
    }
    const p = buildPlan(listWith(history, TODAY), SETTINGS, TODAY)
    expect(p.projectedFinish).toBe('2026-10-21')
  })

  it('works from the first day', () => {
    const p = buildPlan(listWith(solvedOn(3, '2026-10-01'), '2026-10-01'), SETTINGS, '2026-10-01')
    expect(p.recentPerDay).toBe(3)
    expect(p.projectedFinish).toBe(addDays('2026-10-01', 49))
  })
})

describe('buildPlan: series', () => {
  it('has a point per day from the start to the target', () => {
    const p = buildPlan(listWith({}, TODAY), SETTINGS, TODAY)
    expect(p.series).toHaveLength(84)
    expect(p.series[0].date).toBe('2026-10-01')
    expect(p.series[83].date).toBe('2026-12-23')
  })

  it('plans along the line from the first day to all problems on the target', () => {
    const { series } = buildPlan(listWith({}, TODAY), SETTINGS, TODAY)
    expect(series[0].planned).toBe(2)
    expect(series[41].planned).toBe(75)
    expect(series[83].planned).toBe(150)
    for (let i = 1; i < series.length; i++) expect(series[i].planned).toBeGreaterThanOrEqual(series[i - 1].planned)
  })

  it('has no actual after today', () => {
    const { series } = buildPlan(listWith({}, TODAY), SETTINGS, TODAY)
    const today = series.find((s) => s.date === TODAY)!
    expect(today.actual).toBe(0)
    expect(series.find((s) => s.date === '2026-11-13')!.actual).toBeNull()
    expect(series[series.length - 1].actual).toBeNull()
  })

  it('accumulates first solves by day', () => {
    const history = {
      ...solvedOn(2, '2026-10-03', 0),
      ...solvedOn(3, '2026-10-05', 2),
    }
    const { series } = buildPlan(listWith(history, TODAY), SETTINGS, TODAY)
    const at = (date: string) => series.find((s) => s.date === date)!.actual
    expect(at('2026-10-02')).toBe(0)
    expect(at('2026-10-03')).toBe(2)
    expect(at('2026-10-04')).toBe(2)
    expect(at('2026-10-05')).toBe(5)
    expect(at(TODAY)).toBe(5)
  })

  it('counts a problem only once however often it is revised', () => {
    const list = listWith(
      { [slug(0)]: [attempt('2026-10-03', 'easy'), attempt('2026-10-04', 'easy'), attempt('2026-10-09', 'easy')] },
      TODAY,
    )
    const { series } = buildPlan(list, SETTINGS, TODAY)
    expect(series.find((s) => s.date === '2026-10-03')!.actual).toBe(1)
    expect(series.find((s) => s.date === '2026-10-20')!.actual).toBe(1)
  })

  it('includes solves from before the start date in every point', () => {
    const list = listWith(solvedOn(4, '2026-09-15'), TODAY)
    const { series } = buildPlan(list, SETTINGS, TODAY)
    expect(series[0].actual).toBe(4)
    expect(series.find((s) => s.date === TODAY)!.actual).toBe(4)
  })

  it('runs on to today when today is after the target', () => {
    const { series } = buildPlan(listWith(solvedOn(10, '2026-12-01'), '2027-01-05'), SETTINGS, '2027-01-05')
    expect(series).toHaveLength(97)
    expect(series[96].date).toBe('2027-01-05')
    expect(series[96].actual).toBe(10)
    expect(series[96].planned).toBe(150)
    expect(series[83].planned).toBe(150)
  })

  it('has no actual anywhere before the plan starts', () => {
    const { series } = buildPlan(listWith(solvedOn(3, '2026-09-10'), '2026-09-20'), SETTINGS, '2026-09-20')
    expect(series).toHaveLength(84)
    expect(series.every((s) => s.actual === null)).toBe(true)
  })

  it('ends at the total when everything is solved', () => {
    const list = listWith(solvedOn(150, '2026-11-01'), TODAY)
    const { series } = buildPlan(list, SETTINGS, TODAY)
    expect(series.find((s) => s.date === TODAY)!.actual).toBe(150)
  })
})

describe('buildPlan: rounding the line', () => {
  const list = listWith({}, TODAY)
  const plan = (days: number, onDay: number) => {
    const start = '2026-10-01'
    const settings = { ...SETTINGS, targetDate: addDays(start, days - 1) }
    return buildPlan(list, settings, addDays(start, onDay - 1))
  }

  it('rounds an exact half up, even where floating point lands just below it', () => {
    // 150 * 11 / 60 = 27.5 exactly, but 150 * (11 / 60) is 27.499999999999996.
    expect(plan(60, 11).expected).toBe(28)
    // 150 * 41 / 100 = 61.5
    expect(plan(100, 41).expected).toBe(62)
    // 150 * 7 / 84 = 12.5
    expect(plan(84, 7).expected).toBe(13)
  })

  it('agrees between the expected count and the series on the same day', () => {
    const p = buildPlan(list, { ...SETTINGS, targetDate: '2026-11-29' }, '2026-10-11')
    expect(p.totalDays).toBe(60)
    expect(p.series[10].date).toBe('2026-10-11')
    expect(p.series[10].planned).toBe(p.expected)
    expect(p.expected).toBe(28)
  })

  it('reaches every problem on the target date for any plan length', () => {
    for (const days of [1, 2, 7, 30, 60, 100, 365]) expect(plan(days, days).expected).toBe(150)
  })

  it('never plans beyond the total or below zero', () => {
    const p = buildPlan(list, SETTINGS, '2030-01-01')
    expect(p.series.every((s) => s.planned >= 0 && s.planned <= 150)).toBe(true)
    expect(p.series[0].planned).toBeGreaterThanOrEqual(0)
  })
})

describe('buildPlan: awkward dates and input', () => {
  it('has nothing left to plan with an empty list', () => {
    const p = buildPlan([], SETTINGS, TODAY)
    expect(p.total).toBe(0)
    expect(p.status).toBe('done')
    expect(p.neededPerDay).toBe(0)
    expect(p.projectedFinish).toBeNull()
    expect(Number.isNaN(p.recentPerDay + p.overallPerDay)).toBe(false)
  })

  it('stays finite with a target before the start and today after both', () => {
    const p = buildPlan(listWith(solvedOn(10, '2026-10-20'), TODAY), { ...SETTINGS, targetDate: '2026-09-01' }, TODAY)
    expect(p.totalDays).toBe(1)
    expect(p.daysLeft).toBe(0)
    expect(p.expected).toBe(150)
    expect(p.neededPerDay).toBe(140)
    expect(p.series[0].date).toBe('2026-10-01')
    expect(p.series[p.series.length - 1].date).toBe(TODAY)
    for (const v of [p.neededPerDay, p.recentPerDay, p.overallPerDay]) expect(Number.isFinite(v)).toBe(true)
  })

  it('treats a mistyped future solve as not yet done: no actual, no recent pace', () => {
    const history = { ...solvedOn(2, '2026-11-01'), ...solvedOn(3, '2026-11-20', 2) }
    const p = buildPlan(listWith(history, TODAY), SETTINGS, TODAY)
    expect(p.series.find((s) => s.date === TODAY)!.actual).toBe(2)
    expect(p.series.find((s) => s.date === '2026-11-20')!.actual).toBeNull()
    expect(p.recentPerDay).toBeCloseTo(2 / 14)
  })

  it('counts several attempts on one day as one solve', () => {
    const list = listWith(
      { [slug(0)]: [attempt(TODAY, 'help'), attempt(TODAY, 'easy'), attempt(TODAY, 'easy')] },
      TODAY,
    )
    const p = buildPlan(list, SETTINGS, TODAY)
    expect(p.solved).toBe(1)
    expect(p.series.find((s) => s.date === TODAY)!.actual).toBe(1)
  })

  it('handles a year of history without drifting', () => {
    // One new problem every other day for 75 days of a long plan.
    const history: Record<string, Attempt[]> = {}
    for (let i = 0; i < 75; i++) history[slug(i)] = [attempt(addDays('2026-01-01', i * 2), 'easy')]
    const settings = { ...SETTINGS, startDate: '2026-01-01', targetDate: '2026-12-31' }
    const p = buildPlan(listWith(history, '2026-06-01'), settings, '2026-06-01')
    expect(p.totalDays).toBe(365)
    expect(p.dayNumber).toBe(152)
    expect(p.series).toHaveLength(365)
    expect(p.series.find((s) => s.date === '2026-06-01')!.actual).toBe(75)
    expect(p.series[364].actual).toBeNull()
    expect(p.expected).toBe(62) // 150 * 152 / 365 = 62.47
  })

  it('does not change the list it is given', () => {
    const list = listWith(solvedOn(5, '2026-11-01'), TODAY)
    const before = JSON.stringify(list.map((v) => v.attempts))
    buildPlan(list, SETTINGS, TODAY)
    buildActivity(list)
    buildMistakes(list)
    buildDifficulty(list, DEFAULT_TARGETS)
    expect(JSON.stringify(list.map((v) => v.attempts))).toBe(before)
  })

  it('is the same on every call', () => {
    const list = listWith(solvedOn(30, '2026-11-01'), TODAY)
    expect(buildPlan(list, SETTINGS, TODAY)).toEqual(buildPlan(list, SETTINGS, TODAY))
  })
})

describe('buildPlan: a realistic history', () => {
  it('follows three weeks of uneven progress', () => {
    const history: Record<string, Attempt[]> = {}
    let next = 0
    const solveOn = (date: ISODate, n: number) => {
      for (let i = 0; i < n; i++) history[slug(next++)] = [attempt(date, 'easy')]
    }
    // Week one is strong, week two is a rest, week three picks back up.
    for (let d = 1; d <= 7; d++) solveOn(`2026-10-0${d}`, 3)
    solveOn('2026-10-20', 2)
    for (let d = 21; d <= 25; d++) solveOn(`2026-10-${d}`, 2)
    const today = '2026-10-26'
    const p = buildPlan(listWith(history, today), SETTINGS, today)
    expect(p.solved).toBe(33)
    expect(p.dayNumber).toBe(26)
    expect(p.expected).toBe(46) // 150 * 26 / 84
    expect(p.status).toBe('behind')
    expect(p.recentPerDay).toBeCloseTo(12 / 14) // solves since Oct 13
    expect(p.series.find((s) => s.date === '2026-10-07')!.actual).toBe(21)
    expect(p.series.find((s) => s.date === '2026-10-19')!.actual).toBe(21)
    expect(p.series.find((s) => s.date === '2026-10-25')!.actual).toBe(33)
    expect(p.series.find((s) => s.date === today)!.actual).toBe(33)
  })
})

describe('buildMistakes', () => {
  it('lists every tag with a zero count when nothing is logged', () => {
    const m = buildMistakes(listWith({}, TODAY))
    expect(m.total).toBe(0)
    expect(m.byTag).toHaveLength(8)
    expect(m.byTag.every((t) => t.count === 0)).toBe(true)
    expect(m.byTopic).toEqual([])
  })

  it('counts tags across every attempt, most frequent first', () => {
    const list = listWith(
      {
        [slug(0)]: [
          attempt('2026-11-01', 'help', { mistakes: ['edge-case', 'bug'] }),
          attempt('2026-11-05', 'struggled', { mistakes: ['edge-case'] }),
        ],
        [slug(1)]: [attempt('2026-11-02', 'help', { mistakes: ['misread', 'edge-case'] })],
      },
      TODAY,
    )
    const m = buildMistakes(list)
    expect(m.total).toBe(5)
    expect(m.byTag[0]).toEqual({ tag: 'edge-case', count: 3 })
    expect(m.byTag.slice(1, 3).map((t) => t.tag).sort()).toEqual(['bug', 'misread'])
    expect(m.byTag.slice(1, 3).every((t) => t.count === 1)).toBe(true)
    expect(m.byTag.slice(3).every((t) => t.count === 0)).toBe(true)
  })

  it('keeps tag order on ties', () => {
    const list = listWith(
      { [slug(0)]: [attempt('2026-11-01', 'help', { mistakes: ['blanked', 'wrong-pattern', 'bug'] })] },
      TODAY,
    )
    const tags = buildMistakes(list).byTag.slice(0, 3).map((t) => t.tag)
    expect(tags).toEqual(['wrong-pattern', 'bug', 'blanked'])
  })

  it('counts a tag repeated in one attempt once', () => {
    const list = listWith(
      { [slug(0)]: [attempt('2026-11-01', 'help', { mistakes: ['bug', 'bug'] })] },
      TODAY,
    )
    expect(buildMistakes(list).total).toBe(1)
  })

  it('groups by topic, busiest first, with the tags inside', () => {
    const inTopic = (topic: string) => PROBLEMS.filter((p) => p.topic === topic)
    const [a1, a2] = inTopic('arrays-hashing')
    const [t1] = inTopic('trees')
    const list = listWith(
      {
        [a1.slug]: [attempt('2026-11-01', 'help', { mistakes: ['bug'] })],
        [t1.slug]: [attempt('2026-11-01', 'help', { mistakes: ['off-by-one', 'bug', 'misread'] })],
        [a2.slug]: [attempt('2026-11-02', 'help', { mistakes: ['bug'] })],
      },
      TODAY,
    )
    const m = buildMistakes(list)
    expect(m.byTopic).toEqual([
      { topic: 'trees', total: 3, byTag: { 'off-by-one': 1, bug: 1, misread: 1 } },
      { topic: 'arrays-hashing', total: 2, byTag: { bug: 2 } },
    ])
  })

  it('leaves out topics with no tagged mistakes', () => {
    const list = listWith({ [slug(0)]: [attempt('2026-11-01', 'easy')] }, TODAY)
    expect(buildMistakes(list).byTopic).toEqual([])
  })

  it('orders topics with equal totals by the listing order', () => {
    const trees = PROBLEMS.find((p) => p.topic === 'trees')!
    const arrays = PROBLEMS.find((p) => p.topic === 'arrays-hashing')!
    const list = listWith(
      {
        [trees.slug]: [attempt('2026-11-01', 'help', { mistakes: ['bug'] })],
        [arrays.slug]: [attempt('2026-11-01', 'help', { mistakes: ['bug'] })],
      },
      TODAY,
    )
    expect(buildMistakes(list).byTopic.map((t) => t.topic)).toEqual(['arrays-hashing', 'trees'])
  })
})

describe('buildDifficulty', () => {
  const targets = { easy: 10, medium: 20, hard: 30 }

  it('returns easy, medium, hard with their totals and targets', () => {
    const d = buildDifficulty(listWith({}, TODAY), targets)
    expect(d.map((x) => x.difficulty)).toEqual(['easy', 'medium', 'hard'])
    expect(d.map((x) => x.target)).toEqual([10, 20, 30])
    for (const row of d) {
      expect(row.total).toBe(PROBLEMS.filter((p) => p.difficulty === row.difficulty).length)
      expect(row.solved).toBe(0)
      expect(row.mastered).toBe(0)
      expect(row.avgMinutes).toBeNull()
    }
    expect(d.reduce((sum, x) => sum + x.total, 0)).toBe(150)
  })

  it('handles an empty list', () => {
    const d = buildDifficulty([], targets)
    expect(d.map((x) => x.total)).toEqual([0, 0, 0])
    expect(d.map((x) => x.avgMinutes)).toEqual([null, null, null])
  })

  it('counts solved and mastered per difficulty', () => {
    const e1 = firstOf('easy')
    const e2 = firstOf('easy', 1)
    const h1 = firstOf('hard')
    const list = listWith(
      {
        [e1.slug]: [attempt('2026-06-01', 'easy'), attempt('2026-07-01', 'easy'), attempt('2026-09-01', 'easy')],
        [e2.slug]: [attempt('2026-11-01', 'easy')],
        [h1.slug]: [attempt('2026-11-01', 'help')],
      },
      TODAY,
    )
    const [easy, medium, hard] = buildDifficulty(list, targets)
    expect(easy.solved).toBe(2)
    expect(easy.mastered).toBe(1)
    expect(medium.solved).toBe(0)
    expect(hard.solved).toBe(1)
    expect(hard.mastered).toBe(0)
  })

  it('averages the minutes of timed first solves only', () => {
    const m1 = firstOf('medium')
    const m2 = firstOf('medium', 1)
    const m3 = firstOf('medium', 2)
    const m4 = firstOf('medium', 3)
    const list = listWith(
      {
        [m1.slug]: [
          attempt('2026-11-01', 'struggled', { minutes: 30 }),
          // A faster revision must not drag the average down.
          attempt('2026-11-05', 'easy', { minutes: 5 }),
        ],
        [m2.slug]: [attempt('2026-11-01', 'easy', { minutes: 20 })],
        // Untimed first solve, timed revision: no first-solve time to use.
        [m3.slug]: [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'easy', { minutes: 9 })],
        // Untimed.
        [m4.slug]: [attempt('2026-11-01', 'easy')],
      },
      TODAY,
    )
    const medium = buildDifficulty(list, targets)[1]
    expect(medium.avgMinutes).toBe(25)
    expect(medium.solved).toBe(4)
  })

  it('is null when no first solve was timed', () => {
    const e = firstOf('easy')
    const list = listWith({ [e.slug]: [attempt('2026-11-01', 'easy')] }, TODAY)
    expect(buildDifficulty(list, targets)[0].avgMinutes).toBeNull()
  })

  it('uses the chronologically first attempt, not the first logged', () => {
    const e = firstOf('easy')
    const list = listWith(
      {
        [e.slug]: [
          attempt('2026-11-05', 'easy', { minutes: 4 }),
          attempt('2026-11-01', 'help', { minutes: 18 }),
        ],
      },
      TODAY,
    )
    expect(buildDifficulty(list, targets)[0].avgMinutes).toBe(18)
  })
})
