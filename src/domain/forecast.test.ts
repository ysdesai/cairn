import { describe, expect, it } from 'vitest'
import type { Rating } from '../state/schema'
import { PROBLEMS } from '../data'
import { addDays } from './dates'
import { buildForecast, FORECAST_DAYS } from './forecast'
import { buildQueue, reviewsDoneOn } from './queue'
import { mulberry32 } from './rng'
import { attempt, listWith, viewOf } from './testing'
import type { ForecastDay, ProblemView } from './types'

const TODAY = '2026-11-12'
const day = (n: number) => addDays(TODAY, n)

const SLUGS = [
  'contains-duplicate',
  'valid-anagram',
  'two-sum',
  'group-anagrams',
  'top-k-frequent-elements',
  'product-of-array-except-self',
  'valid-sudoku',
  'longest-consecutive-sequence',
]

const viewWith = (slug: string, ...steps: [number, Rating][]): ProblemView =>
  viewOf(
    slug,
    steps.map(([n, rating]) => attempt(day(n), rating)),
    TODAY,
  )

const scheduled = (days: ForecastDay[]) => days.map((d) => d.scheduled)
const carried = (days: ForecastDay[]) => days.map((d) => d.carried)

describe('buildForecast: shape', () => {
  it('covers 14 days starting today', () => {
    expect(FORECAST_DAYS).toBe(14)
    const forecast = buildForecast([], TODAY, 5)
    expect(forecast).toHaveLength(14)
    expect(forecast[0]).toEqual({ date: TODAY, offset: 0, scheduled: 0, carried: 0 })
    expect(forecast.map((d) => d.offset)).toEqual([...Array(14).keys()])
    expect(forecast.map((d) => d.date)).toEqual([...Array(14).keys()].map(day))
  })

  it('is all zeros when nothing has been attempted', () => {
    const forecast = buildForecast(listWith({}, TODAY), TODAY, 5)
    expect(scheduled(forecast)).toEqual(Array(14).fill(0))
    expect(carried(forecast)).toEqual(Array(14).fill(0))
  })

  it('honors a custom length, including none', () => {
    expect(buildForecast([], TODAY, 5, 3).map((d) => d.date)).toEqual([day(0), day(1), day(2)])
    expect(buildForecast([], TODAY, 5, 0)).toEqual([])
    expect(buildForecast([], TODAY, 5, 30)).toHaveLength(30)
  })

  it('crosses month and year ends', () => {
    const forecast = buildForecast([], '2026-12-30', 5, 4)
    expect(forecast.map((d) => d.date)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('does not modify the list', () => {
    const list = [viewWith('two-sum', [-5, 'struggled'])]
    const snapshot = JSON.parse(JSON.stringify(list[0].attempts))
    buildForecast(list, TODAY, 1)
    expect(list[0].attempts).toEqual(snapshot)
  })
})

describe('buildForecast: what comes due', () => {
  it('leaves out untouched, mastered and far-off problems', () => {
    const list = [
      viewWith('contains-duplicate'),
      viewWith('valid-anagram', [-400, 'easy'], [-397, 'easy'], [-372, 'easy']),
      // Two Easy revisions: next one is 25 days out.
      viewWith('two-sum', [-5, 'easy'], [-2, 'easy']),
    ]
    expect(scheduled(buildForecast(list, TODAY, 5))).toEqual(Array(14).fill(0))
  })

  it('counts a revision due on the last day of the window but not the day after', () => {
    // Future-dated Easy solves are due three days after they are dated.
    const onLastDay = viewWith('valid-anagram', [10, 'easy'])
    const pastWindow = viewWith('contains-duplicate', [11, 'easy'])
    expect(onLastDay.srs?.due).toBe(day(13))
    expect(pastWindow.srs?.due).toBe(day(14))
    const forecast = buildForecast([onLastDay, pastWindow], TODAY, 5)
    expect(scheduled(forecast)[13]).toBe(1)
    expect(scheduled(forecast).reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('counts a problem due today on day 0', () => {
    const forecast = buildForecast([viewWith('two-sum', [-3, 'easy'])], TODAY, 5)
    expect(forecast[0]).toMatchObject({ scheduled: 1, carried: 0 })
  })

  it('counts a problem overdue by months on day 0', () => {
    const forecast = buildForecast([viewWith('two-sum', [-200, 'easy'])], TODAY, 5)
    expect(forecast[0].scheduled).toBe(1)
  })

  it('treats a lapsed mastered problem as due again', () => {
    const list = [viewWith('two-sum', [-400, 'easy'], [-397, 'easy'], [-372, 'easy'], [-1, 'help'])]
    expect(scheduled(buildForecast(list, TODAY, 5))[0]).toBe(1)
  })
})

describe('buildForecast: simulated revisions come back', () => {
  it('follows one problem up the ladder as it is revised', () => {
    // Struggled today: due in two days. A Struggled revision there is step 1 (3 days), then step 2
    // (6 days), then step 3 (17 days, outside the window).
    const forecast = buildForecast([viewWith('two-sum', [0, 'struggled'])], TODAY, 5)
    expect(scheduled(forecast)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0])
    expect(carried(forecast)).toEqual(Array(14).fill(0))
  })

  it('drops a problem from the window once its next interval lands outside it', () => {
    // Easy solve 20 days ago: step 1, overdue. Revised today -> step 2, due in 7 days; revised then -> 21 days out.
    const forecast = buildForecast([viewWith('two-sum', [-20, 'easy'])], TODAY, 5)
    expect(scheduled(forecast)).toEqual([1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0])
  })

  it('stops a problem that would reach mastery', () => {
    // Struggled solves climb one rung at a time; step 4 is 45 * ease days away.
    const list = [viewWith('two-sum', [-100, 'easy'], [-97, 'easy'], [-72, 'struggled'])]
    const forecast = buildForecast(list, TODAY, 5)
    expect(scheduled(forecast).reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('never schedules the same problem twice in a day', () => {
    // A due-today problem revised at step 0 comes back after a full interval, not the same day.
    const forecast = buildForecast([viewWith('two-sum', [-2, 'struggled'])], TODAY, 5)
    expect(scheduled(forecast).slice(0, 3)).toEqual([1, 0, 0])
    expect(scheduled(forecast)[3]).toBe(1)
  })
})

describe('buildForecast: the cap', () => {
  // Five problems overdue since long ago, all on the same schedule.
  const backlog = (): ProblemView[] => SLUGS.slice(0, 5).map((slug) => viewWith(slug, [-10, 'struggled']))

  it('lets through no more than the cap each day and carries the rest', () => {
    const forecast = buildForecast(backlog(), TODAY, 2)
    // A and B on day 0, C and D on day 1, E on day 2, then each returns 3 days later (step 1)
    // and again 6 days after that (step 2); the third return is past the window.
    expect(scheduled(forecast)).toEqual([2, 2, 1, 2, 2, 1, 0, 0, 0, 2, 2, 1, 0, 0])
    expect(carried(forecast).slice(0, 4)).toEqual([3, 1, 0, 0])
    for (const d of forecast) expect(d.scheduled).toBeLessThanOrEqual(2)
  })

  it('carries nothing when the cap exceeds the backlog', () => {
    const forecast = buildForecast(backlog(), TODAY, 50)
    expect(carried(forecast)).toEqual(Array(14).fill(0))
    expect(forecast[0].scheduled).toBe(5)
  })

  it('does nothing and carries the whole backlog with a cap of zero', () => {
    const forecast = buildForecast([...backlog(), viewWith('valid-sudoku', [0, 'struggled'])], TODAY, 0)
    expect(scheduled(forecast)).toEqual(Array(14).fill(0))
    // Five waiting from the start; the sixth joins when it comes due, two days after its solve.
    expect(carried(forecast)).toEqual([5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6])
  })

  it('treats a negative or fractional cap as the whole slots it allows', () => {
    expect(scheduled(buildForecast(backlog(), TODAY, -3)).every((n) => n === 0)).toBe(true)
    expect(buildForecast(backlog(), TODAY, 2.8)[0].scheduled).toBe(2)
  })

  it('counts revisions already logged today against today only', () => {
    const list = [
      viewWith('valid-sudoku', [-5, 'struggled'], [0, 'struggled']),
      viewWith('two-sum', [-10, 'struggled']),
      viewWith('valid-anagram', [-10, 'struggled']),
    ]
    const forecast = buildForecast(list, TODAY, 2)
    expect(forecast[0]).toMatchObject({ scheduled: 1, carried: 1 })
    expect(forecast[1].scheduled).toBe(1)
    expect(forecast[1].carried).toBe(0)
  })

  it('leaves nothing for today when the cap was already used up', () => {
    const list = [
      viewWith('valid-sudoku', [-5, 'struggled'], [0, 'struggled']),
      viewWith('longest-consecutive-sequence', [-5, 'struggled'], [0, 'struggled']),
      viewWith('two-sum', [-10, 'struggled']),
    ]
    const forecast = buildForecast(list, TODAY, 2)
    expect(forecast[0]).toMatchObject({ scheduled: 0, carried: 1 })
    expect(forecast[1]).toMatchObject({ scheduled: 1, carried: 0 })
  })

  it('does the earliest-due problem first', () => {
    // Overdue since day -17 (Easy solve at -20, will be a long climb) versus since day -2.
    // Whichever goes first on day 0 decides when each comes back, so the pattern shows the order.
    const early = viewWith('contains-duplicate', [-20, 'easy'])
    const late = viewWith('valid-anagram', [-3, 'struggled'])
    // late is listed first, so list order would favor it if due dates were ignored.
    const forecast = buildForecast([late, early], TODAY, 1)
    expect(scheduled(forecast)).toEqual([1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0])
  })

  it('breaks due-date ties by list order', () => {
    // Both due on day -7. After revision the Easy solve returns on day 7 and the Struggled one on day 3,
    // so who goes first on day 0 shows in the pattern.
    const a = viewWith('two-sum', [-10, 'easy'])
    const b = viewWith('valid-anagram', [-9, 'struggled'])
    expect(a.srs?.due).toBe(b.srs?.due)
    expect(scheduled(buildForecast([a, b], TODAY, 1))).toEqual([1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0])
    expect(scheduled(buildForecast([b, a], TODAY, 1))).toEqual([1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0])
  })
})

describe('buildForecast: history that is not in the past', () => {
  it('schedules a future-dated history when it comes due', () => {
    // Easy on day 5: due on day 8.
    const forecast = buildForecast([viewWith('two-sum', [5, 'easy'])], TODAY, 5)
    expect(scheduled(forecast)[8]).toBe(1)
    expect(forecast[0].scheduled).toBe(0)
  })
})

describe('buildForecast: realistic list', () => {
  const list = (): ProblemView[] => [
    viewWith('contains-duplicate', [-21, 'easy'], [-18, 'easy']),
    viewWith('valid-anagram', [-14, 'easy']),
    viewWith('two-sum', [-14, 'struggled']),
    viewWith('group-anagrams', [-9, 'struggled']),
    viewWith('top-k-frequent-elements', [-3, 'easy']),
    viewWith('product-of-array-except-self', [-1, 'easy']),
    viewWith('valid-sudoku', [0, 'help']),
    viewWith('longest-consecutive-sequence', [-10, 'easy'], [0, 'struggled']),
  ]

  it('agrees with the queue about today', () => {
    for (const cap of [1, 2, 3, 4, 10]) {
      const queue = buildQueue(list(), TODAY, cap)
      const forecast = buildForecast(list(), TODAY, cap)
      expect(forecast[0].scheduled).toBe(queue.today.length)
      expect(forecast[0].carried).toBe(queue.waiting.length)
    }
  })

  it('agrees with the queue on a full-size list', () => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    SLUGS.forEach((slug, i) => {
      history[slug] = [attempt(day(-30 + i * 2), i % 2 ? 'easy' : 'struggled')]
    })
    const full = listWith(history, TODAY)
    const queue = buildQueue(full, TODAY, 3)
    const forecast = buildForecast(full, TODAY, 3)
    expect(forecast[0].scheduled).toBe(queue.today.length)
    expect(forecast[0].carried).toBe(queue.waiting.length)
  })

  it('stays within the cap and never goes negative', () => {
    for (const cap of [1, 2, 5]) {
      for (const d of buildForecast(list(), TODAY, cap)) {
        expect(d.scheduled).toBeGreaterThanOrEqual(0)
        expect(d.scheduled).toBeLessThanOrEqual(cap)
        expect(d.carried).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('carries less with a bigger cap', () => {
    const small = buildForecast(list(), TODAY, 1)
    const large = buildForecast(list(), TODAY, 5)
    expect(small[0].carried).toBeGreaterThan(large[0].carried)
    expect(large.reduce((a, d) => a + d.carried, 0)).toBeLessThanOrEqual(small.reduce((a, d) => a + d.carried, 0))
  })

  it('is deterministic', () => {
    expect(buildForecast(list(), TODAY, 2)).toEqual(buildForecast(list(), TODAY, 2))
  })
})

describe('buildForecast: the whole ladder', () => {
  it('follows a Struggled problem from solve to mastery over a long window', () => {
    // Solve day 0 (ease 0.95, due day 2). Each simulated Struggled revision climbs one rung:
    // day 2 -> 3 days, day 5 -> 6 days, day 11 -> 17 days, day 28 -> 34 days, day 62 -> mastered.
    const forecast = buildForecast([viewWith('two-sum', [0, 'struggled'])], TODAY, 5, 90)
    const busy = forecast.filter((d) => d.scheduled > 0).map((d) => d.offset)
    expect(busy).toEqual([2, 5, 11, 28, 62])
    expect(forecast.every((d) => d.carried === 0)).toBe(true)
  })

  it('keeps going past the old window when the length is raised', () => {
    const forecast = buildForecast([viewWith('two-sum', [-3, 'easy'])], TODAY, 5, 30)
    // Easy solve at -3: due today. Struggled revision -> step 2, ease 1.05, 7 days; then 21 days; then 45 * 0.95 -> past day 29.
    expect(forecast.filter((d) => d.scheduled > 0).map((d) => d.offset)).toEqual([0, 7, 28])
  })
})

describe('buildForecast: capacity is never wasted', () => {
  const library = (spread: number, rating: Rating = 'struggled'): ProblemView[] => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    PROBLEMS.forEach((p, i) => {
      history[p.slug] = [attempt(day(-30 + (i % spread)), i % 3 ? rating : 'easy')]
    })
    return listWith(history, TODAY)
  }

  it('fills every day to the cap while anything is carried, for caps of 1 and 30', () => {
    for (const cap of [1, 30]) {
      const list = library(25)
      const done = reviewsDoneOn(list, TODAY)
      const forecast = buildForecast(list, TODAY, cap, 30)
      forecast.forEach((d) => {
        const room = d.offset === 0 ? Math.max(0, cap - done) : cap
        expect(d.scheduled).toBeLessThanOrEqual(room)
        if (d.carried > 0) expect(d.scheduled).toBe(room)
      })
    }
  })

  it('drains a 150-problem backlog at the cap, day after day', () => {
    const forecast = buildForecast(library(1), TODAY, 30, 5)
    expect(scheduled(forecast).slice(0, 4)).toEqual([30, 30, 30, 30])
    expect(forecast[0].carried).toBe(120)
    expect(forecast[1].carried).toBeGreaterThanOrEqual(90)
  })

  it('moves one problem a day with a cap of one', () => {
    const forecast = buildForecast(library(1), TODAY, 1, 14)
    expect(scheduled(forecast)).toEqual(Array(14).fill(1))
    expect(forecast[0].carried).toBe(149)
  })

  it('is empty when everything is mastered', () => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    for (const p of PROBLEMS) history[p.slug] = [attempt(day(-80), 'easy'), attempt(day(-77), 'easy'), attempt(day(-52), 'easy')]
    const forecast = buildForecast(listWith(history, TODAY), TODAY, 30)
    expect(scheduled(forecast)).toEqual(Array(14).fill(0))
    expect(carried(forecast)).toEqual(Array(14).fill(0))
  })

  it('has nothing for today when everything was solved today, and a wave tomorrow', () => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    for (const p of PROBLEMS) history[p.slug] = [attempt(TODAY, 'help')]
    const forecast = buildForecast(listWith(history, TODAY), TODAY, 30, 3)
    expect(forecast[0]).toMatchObject({ scheduled: 0, carried: 0 })
    expect(forecast[1]).toMatchObject({ scheduled: 30, carried: 120 })
  })
})

describe('buildForecast: a year of history', () => {
  const yearLong = (): ProblemView[] => {
    const rng = mulberry32(2026)
    const ratings: Rating[] = ['easy', 'struggled', 'help']
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    PROBLEMS.forEach((p, i) => {
      if (i % 5 === 4) return
      const attempts = []
      for (let d = 365 - (i % 40); d > 0; d -= 3 + Math.floor(rng() * 40)) attempts.push(attempt(day(-d), ratings[Math.floor(rng() * 3)]))
      history[p.slug] = attempts
    })
    return listWith(history, TODAY)
  }

  it('agrees with the queue about today for several caps', () => {
    const list = yearLong()
    for (const cap of [1, 5, 12, 30]) {
      const queue = buildQueue(list, TODAY, cap)
      const forecast = buildForecast(list, TODAY, cap)
      expect(forecast[0].scheduled).toBe(queue.today.length)
      expect(forecast[0].carried).toBe(queue.waiting.length)
    }
  })

  it('never exceeds the cap and carries more when the cap is smaller', () => {
    const list = yearLong()
    const small = buildForecast(list, TODAY, 2)
    const large = buildForecast(list, TODAY, 10)
    for (const d of small) expect(d.scheduled).toBeLessThanOrEqual(2)
    expect(small[0].carried).toBeGreaterThanOrEqual(large[0].carried)
  })
})

describe('buildForecast: several attempts on one day', () => {
  it('counts every repeat logged today against today, including on a first solve', () => {
    const list = [
      viewWith('valid-sudoku', [0, 'help'], [0, 'struggled'], [0, 'easy']),
      viewWith('two-sum', [-10, 'struggled']),
      viewWith('valid-anagram', [-10, 'struggled']),
    ]
    expect(reviewsDoneOn(list, TODAY)).toBe(2)
    const forecast = buildForecast(list, TODAY, 3)
    expect(forecast[0]).toMatchObject({ scheduled: 1, carried: 1 })
    // Tomorrow: the one carried over, plus valid-sudoku, whose solve is due the next day.
    expect(forecast[1]).toMatchObject({ scheduled: 2, carried: 0 })
  })

  it('keeps a same-day repeat from pulling the due date forward', () => {
    // Easy twice today: still due in three days, not sooner and not later.
    const forecast = buildForecast([viewWith('two-sum', [0, 'easy'], [0, 'easy'])], TODAY, 5)
    expect(forecast.filter((d) => d.scheduled > 0).map((d) => d.offset)).toEqual([3, 10])
  })
})

describe('buildForecast: input is left alone', () => {
  it('works on a frozen list and does not touch the attempts', () => {
    const view = viewWith('two-sum', [-5, 'struggled'], [-4, 'easy'])
    const list = Object.freeze([view])
    const before = JSON.stringify(view)
    expect(() => buildForecast(list, TODAY, 1)).not.toThrow()
    expect(JSON.stringify(view)).toBe(before)
  })

  it('gives the same answer when asked twice for the same list', () => {
    const list = [viewWith('two-sum', [-5, 'struggled']), viewWith('valid-anagram', [-5, 'struggled'])]
    expect(buildForecast(list, TODAY, 1)).toEqual(buildForecast(list, TODAY, 1))
  })
})
