import { describe, expect, it } from 'vitest'
import type { Rating } from '../state/schema'
import { PROBLEMS } from '../data'
import { addDays } from './dates'
import { mulberry32 } from './rng'
import { buildQueue, reviewPriority, reviewsDoneOn } from './queue'
import { attempt, listWith, viewOf } from './testing'
import type { ProblemView, SrsState } from './types'

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

/** A view of `slug` whose attempts are given as [day offset, rating] pairs. */
const viewWith = (slug: string, ...steps: [number, Rating][]): ProblemView =>
  viewOf(
    slug,
    steps.map(([n, rating]) => attempt(day(n), rating)),
    TODAY,
  )

/** The same view with its schedule adjusted, to isolate one ingredient of the priority. */
const withSrs = (view: ProblemView, patch: Partial<SrsState>): ProblemView => {
  if (!view.srs) throw new Error('view has no schedule')
  return { ...view, srs: { ...view.srs, ...patch } }
}

const slugsOf = (views: ProblemView[]) => views.map((v) => v.problem.slug)

describe('reviewPriority', () => {
  it('is -Infinity for problems with nothing to revise', () => {
    expect(reviewPriority(viewOf('two-sum', [], TODAY), TODAY)).toBe(-Infinity)
    const mastered = viewWith('two-sum', [-40, 'easy'], [-37, 'easy'], [-12, 'easy'])
    expect(mastered.status).toBe('mastered')
    expect(reviewPriority(mastered, TODAY)).toBe(-Infinity)
  })

  it('is deterministic', () => {
    const view = viewWith('two-sum', [-9, 'struggled'])
    expect(reviewPriority(view, TODAY)).toBe(reviewPriority(view, TODAY))
  })

  it('grows with every day a revision is overdue', () => {
    const view = viewWith('two-sum', [-9, 'easy'])
    const scores = [0, 1, 2, 5, 20].map((n) => reviewPriority(view, day(6 + n)))
    expect(scores).toEqual([...scores].sort((a, b) => a - b))
    expect(new Set(scores).size).toBe(scores.length)
  })

  it('weighs lateness against the planned interval', () => {
    // Same weakness, one day late: a 1-day interval matters more than a 45-day one.
    const base = viewWith('two-sum', [-9, 'easy'])
    const short = withSrs(base, { interval: 1, due: day(-1) })
    const long = withSrs(base, { interval: 45, due: day(-1) })
    expect(reviewPriority(short, TODAY)).toBeGreaterThan(reviewPriority(long, TODAY))
  })

  it('ranks a problem that is due today below the same problem overdue', () => {
    const base = viewWith('two-sum', [-9, 'easy'])
    expect(reviewPriority(withSrs(base, { due: day(-2) }), TODAY)).toBeGreaterThan(
      reviewPriority(withSrs(base, { due: TODAY }), TODAY),
    )
  })

  describe('weakness, with urgency held equal', () => {
    const base = withSrs(viewWith('two-sum', [-9, 'easy']), { due: TODAY, interval: 3, step: 3, ease: 1, lapses: 0 })

    it('rises when the problem is lower on the ladder', () => {
      expect(reviewPriority(withSrs(base, { step: 1 }), TODAY)).toBeGreaterThan(
        reviewPriority(withSrs(base, { step: 4 }), TODAY),
      )
    })

    it('rises with lapses', () => {
      expect(reviewPriority(withSrs(base, { lapses: 2 }), TODAY)).toBeGreaterThan(reviewPriority(base, TODAY))
    })

    it('stops counting lapses after a few', () => {
      expect(reviewPriority(withSrs(base, { lapses: 30 }), TODAY)).toBe(reviewPriority(withSrs(base, { lapses: 3 }), TODAY))
    })

    it('rises when the ease is low and ignores a high ease', () => {
      expect(reviewPriority(withSrs(base, { ease: 0.7 }), TODAY)).toBeGreaterThan(reviewPriority(base, TODAY))
      expect(reviewPriority(withSrs(base, { ease: 1.5 }), TODAY)).toBe(reviewPriority(base, TODAY))
    })

    it('rises when the last attempt needed help', () => {
      expect(reviewPriority(withSrs(base, { lastRating: 'help' }), TODAY)).toBeGreaterThan(
        reviewPriority(withSrs(base, { lastRating: 'struggled' }), TODAY),
      )
    })
  })
})

describe('reviewsDoneOn', () => {
  it('is 0 for an empty list and for untouched problems', () => {
    expect(reviewsDoneOn([], TODAY)).toBe(0)
    expect(reviewsDoneOn(listWith({}, TODAY), TODAY)).toBe(0)
  })

  it('does not count a first solve', () => {
    const list = [viewWith('two-sum', [0, 'easy']), viewWith('valid-anagram', [0, 'help'])]
    expect(reviewsDoneOn(list, TODAY)).toBe(0)
  })

  it('counts revisions dated today across problems', () => {
    const list = [
      viewWith('two-sum', [-5, 'easy'], [0, 'struggled']),
      viewWith('valid-anagram', [-9, 'help'], [-2, 'easy'], [0, 'easy']),
      viewWith('group-anagrams', [-3, 'easy']),
    ]
    expect(reviewsDoneOn(list, TODAY)).toBe(2)
  })

  it('counts every same-day attempt after the first', () => {
    const list = [viewWith('two-sum', [0, 'easy'], [0, 'struggled'], [0, 'help'])]
    expect(reviewsDoneOn(list, TODAY)).toBe(2)
  })

  it('ignores revisions on other days', () => {
    const list = [viewWith('two-sum', [-9, 'easy'], [-6, 'easy'], [1, 'easy'])]
    expect(reviewsDoneOn(list, TODAY)).toBe(0)
  })

  it('decides what is a revision by date order, not storage order', () => {
    // The attempt dated today is stored first but is the solve.
    const list = [
      viewOf('two-sum', [attempt(TODAY, 'easy'), attempt(day(3), 'easy')], TODAY),
      viewOf('valid-anagram', [attempt(day(-2), 'easy'), attempt(TODAY, 'easy')], TODAY),
    ]
    expect(reviewsDoneOn(list, TODAY)).toBe(1)
  })
})

describe('buildQueue: empty and trivial lists', () => {
  it('is empty for an empty list', () => {
    expect(buildQueue([], TODAY, 5)).toEqual({ cap: 5, doneToday: 0, today: [], waiting: [], totalDue: 0 })
  })

  it('is empty when nothing has been attempted', () => {
    const queue = buildQueue(listWith({}, TODAY), TODAY, 5)
    expect(queue).toMatchObject({ today: [], waiting: [], totalDue: 0, doneToday: 0 })
  })

  it('leaves out problems that are learning, mastered or not yet due', () => {
    const list = [
      viewWith('contains-duplicate', [-1, 'easy']),
      viewWith('valid-anagram', [-40, 'easy'], [-37, 'easy'], [-12, 'easy']),
      viewWith('two-sum', [3, 'easy']),
      viewWith('group-anagrams'),
    ]
    expect(buildQueue(list, TODAY, 10)).toMatchObject({ today: [], waiting: [], totalDue: 0 })
  })

  it('includes a problem due exactly today', () => {
    const queue = buildQueue([viewWith('two-sum', [-3, 'easy'])], TODAY, 5)
    expect(slugsOf(queue.today)).toEqual(['two-sum'])
  })

  it('works when today is before every attempt', () => {
    const list = [viewOf('two-sum', [attempt('2026-12-01', 'easy')], TODAY)]
    expect(buildQueue(list, TODAY, 5)).toMatchObject({ today: [], waiting: [], totalDue: 0 })
  })

  it('returns the very view objects it was given', () => {
    const view = viewWith('two-sum', [-5, 'struggled'])
    expect(buildQueue([view], TODAY, 5).today[0]).toBe(view)
  })

  it('does not modify or reorder the input list', () => {
    const list = [viewWith('two-sum', [-3, 'struggled']), viewWith('valid-anagram', [-9, 'struggled'])]
    const before = [...list]
    buildQueue(list, TODAY, 1)
    expect(list).toEqual(before)
  })
})

describe('buildQueue: ordering and the cap', () => {
  // Five Struggled solves, each overdue by a different number of days: 1 through 5.
  const overdue = (): ProblemView[] =>
    SLUGS.slice(0, 5).map((slug, i) => viewWith(slug, [-(i + 2), 'struggled']))

  it('puts everything in today when the cap is larger than what is due', () => {
    const queue = buildQueue(overdue(), TODAY, 30)
    expect(queue.today).toHaveLength(5)
    expect(queue.waiting).toEqual([])
    expect(queue.totalDue).toBe(5)
  })

  it('puts everything in today when the cap equals what is due', () => {
    const queue = buildQueue(overdue(), TODAY, 5)
    expect(queue.today).toHaveLength(5)
    expect(queue.waiting).toEqual([])
  })

  it('serves the most overdue first and keeps the rest waiting in order', () => {
    const queue = buildQueue(overdue(), TODAY, 3)
    expect(slugsOf(queue.today)).toEqual(['top-k-frequent-elements', 'group-anagrams', 'two-sum'])
    expect(slugsOf(queue.waiting)).toEqual(['valid-anagram', 'contains-duplicate'])
    expect(queue.totalDue).toBe(5)
    expect(queue.cap).toBe(3)
  })

  it('splits the due set without losing or repeating anything', () => {
    const list = overdue()
    const queue = buildQueue(list, TODAY, 2)
    expect(slugsOf([...queue.today, ...queue.waiting]).sort()).toEqual(slugsOf(list).sort())
  })

  it('is the same whatever order the list arrives in', () => {
    const list = overdue()
    const a = buildQueue(list, TODAY, 3)
    const b = buildQueue([...list].reverse(), TODAY, 3)
    expect(slugsOf(b.today)).toEqual(slugsOf(a.today))
    expect(slugsOf(b.waiting)).toEqual(slugsOf(a.waiting))
  })

  it('serves a weak problem before a strong one that is due the same day', () => {
    const strong = viewWith('contains-duplicate', [-3, 'easy'])
    const weak = viewWith('two-sum', [-1, 'help'])
    expect(strong.dueIn).toBe(0)
    expect(weak.dueIn).toBe(0)
    expect(slugsOf(buildQueue([strong, weak], TODAY, 2).today)).toEqual(['two-sum', 'contains-duplicate'])
  })

  it('serves a short-interval problem before a long-interval one that is equally late', () => {
    // Both one day overdue. The first came up after a 2-day interval, the second after 3 days.
    const quick = viewWith('two-sum', [-3, 'struggled'])
    const slow = viewWith('contains-duplicate', [-4, 'easy'])
    expect(quick.dueIn).toBe(-1)
    expect(slow.dueIn).toBe(-1)
    expect(slugsOf(buildQueue([slow, quick], TODAY, 2).today)).toEqual(['two-sum', 'contains-duplicate'])
  })

  it('breaks exact ties by list order', () => {
    const a = viewWith('two-sum', [-5, 'struggled'])
    const b = viewWith('valid-anagram', [-5, 'struggled'])
    const c = viewWith('contains-duplicate', [-5, 'struggled'])
    expect(slugsOf(buildQueue([a, b, c], TODAY, 2).today)).toEqual(['two-sum', 'valid-anagram'])
    expect(slugsOf(buildQueue([c, b, a], TODAY, 2).today)).toEqual(['contains-duplicate', 'valid-anagram'])
    expect(slugsOf(buildQueue([c, b, a], TODAY, 2).waiting)).toEqual(['two-sum'])
  })

  it('serves nothing today when the cap is zero, and everything waits', () => {
    const queue = buildQueue(overdue(), TODAY, 0)
    expect(queue.today).toEqual([])
    expect(queue.waiting).toHaveLength(5)
    expect(queue.totalDue).toBe(5)
  })

  it('never lets a negative or fractional cap misbehave', () => {
    expect(buildQueue(overdue(), TODAY, -4).today).toEqual([])
    expect(buildQueue(overdue(), TODAY, 2.9).today).toHaveLength(2)
  })

  it('takes a cap of one', () => {
    const queue = buildQueue(overdue(), TODAY, 1)
    expect(slugsOf(queue.today)).toEqual(['top-k-frequent-elements'])
    expect(queue.waiting).toHaveLength(4)
  })
})

describe('buildQueue: revisions already done today', () => {
  const revisedToday = (slug: string) => viewWith(slug, [-10, 'easy'], [0, 'struggled'])
  const overdue = (): ProblemView[] => SLUGS.slice(0, 5).map((slug, i) => viewWith(slug, [-(i + 2), 'struggled']))

  it('counts against the cap', () => {
    const list = [...overdue(), revisedToday('valid-sudoku')]
    const queue = buildQueue(list, TODAY, 3)
    expect(queue.doneToday).toBe(1)
    expect(slugsOf(queue.today)).toEqual(['top-k-frequent-elements', 'group-anagrams'])
    expect(queue.waiting).toHaveLength(3)
    expect(queue.totalDue).toBe(5)
  })

  it('does not put the problem that was just revised back in the queue', () => {
    const queue = buildQueue([revisedToday('two-sum')], TODAY, 5)
    expect(queue).toMatchObject({ doneToday: 1, today: [], waiting: [], totalDue: 0 })
  })

  it('leaves no room once the cap is met', () => {
    const list = [...overdue(), revisedToday('valid-sudoku'), revisedToday('longest-consecutive-sequence')]
    const queue = buildQueue(list, TODAY, 2)
    expect(queue.doneToday).toBe(2)
    expect(queue.today).toEqual([])
    expect(queue.waiting).toHaveLength(5)
  })

  it('stays at no room when more were done than the cap allows', () => {
    const list = [...overdue(), revisedToday('valid-sudoku'), revisedToday('longest-consecutive-sequence')]
    const queue = buildQueue(list, TODAY, 1)
    expect(queue.doneToday).toBe(2)
    expect(queue.today).toEqual([])
    expect(queue.totalDue).toBe(5)
  })

  it('does not count a first solve logged today', () => {
    const list = [...overdue(), viewWith('valid-sudoku', [0, 'help'])]
    const queue = buildQueue(list, TODAY, 3)
    expect(queue.doneToday).toBe(0)
    expect(queue.today).toHaveLength(3)
  })

  it('counts a repeat attempt on a problem first solved today', () => {
    const list = [...overdue(), viewWith('valid-sudoku', [0, 'help'], [0, 'easy'])]
    expect(buildQueue(list, TODAY, 3).doneToday).toBe(1)
  })
})

describe('buildQueue: mastery and lapses', () => {
  it('never queues a mastered problem, however long ago', () => {
    const list = [viewWith('two-sum', [-400, 'easy'], [-397, 'easy'], [-372, 'easy'])]
    expect(buildQueue(list, TODAY, 5).totalDue).toBe(0)
  })

  it('queues a mastered problem again after a lapse', () => {
    const list = [viewWith('two-sum', [-400, 'easy'], [-397, 'easy'], [-372, 'easy'], [-1, 'help'])]
    const queue = buildQueue(list, TODAY, 5)
    expect(slugsOf(queue.today)).toEqual(['two-sum'])
  })
})

describe('buildQueue: a realistic month', () => {
  const list = () => [
    // Two good revisions three weeks ago: next one still a week away.
    viewWith('contains-duplicate', [-21, 'easy'], [-18, 'easy']),
    // Easy solve eleven days past its due date.
    viewWith('valid-anagram', [-14, 'easy']),
    // Struggled solve two weeks ago and never revisited.
    viewWith('two-sum', [-14, 'struggled']),
    // Struggled solve ten days ago.
    viewWith('group-anagrams', [-10, 'struggled']),
    // Easy solve three days ago: due today, on time.
    viewWith('top-k-frequent-elements', [-3, 'easy']),
    // Solved yesterday: not due yet.
    viewWith('product-of-array-except-self', [-1, 'easy']),
    // Needed help today: comes back tomorrow.
    viewWith('valid-sudoku', [0, 'help']),
    // Revised today already.
    viewWith('longest-consecutive-sequence', [-10, 'easy'], [0, 'struggled']),
  ]

  it('holds the day to the cap and ranks the backlog', () => {
    const queue = buildQueue(list(), TODAY, 3)
    expect(queue.doneToday).toBe(1)
    expect(slugsOf(queue.today)).toEqual(['two-sum', 'group-anagrams'])
    expect(slugsOf(queue.waiting)).toEqual(['valid-anagram', 'top-k-frequent-elements'])
    expect(queue.totalDue).toBe(4)
  })

  it('shows everything due with a generous cap', () => {
    const queue = buildQueue(list(), TODAY, 10)
    expect(slugsOf(queue.today)).toEqual(['two-sum', 'group-anagrams', 'valid-anagram', 'top-k-frequent-elements'])
    expect(queue.waiting).toEqual([])
  })

  it('rolls forward without anything counting as lost', () => {
    // The same list a day later: the waiting ones are still due and more overdue, and valid-sudoku joins them.
    const tomorrow = list().map((v) => viewOf(v.problem.slug, v.attempts, day(1)))
    const queue = buildQueue(tomorrow, day(1), 3)
    expect(queue.doneToday).toBe(0)
    expect(queue.totalDue).toBe(5)
    expect(slugsOf(queue.today)).toEqual(['two-sum', 'group-anagrams', 'valid-anagram'])
    expect(slugsOf(queue.waiting)).toEqual(['valid-sudoku', 'top-k-frequent-elements'])
  })
})

describe('buildQueue: judged against the date it is given', () => {
  it('queues a problem that became due after its view was built', () => {
    // Built on day -5, when the revision (due day -2) was still ahead.
    const stale = viewOf('two-sum', [attempt(day(-5), 'easy')], day(-5))
    expect(stale.status).toBe('learning')
    expect(slugsOf(buildQueue([stale], TODAY, 5).today)).toEqual(['two-sum'])
  })

  it('leaves out a problem that is not yet due on the given date, whatever its view says', () => {
    const fresh = viewOf('two-sum', [attempt(day(-5), 'easy')], TODAY)
    expect(fresh.status).toBe('due')
    expect(buildQueue([fresh], day(-3), 5)).toMatchObject({ today: [], waiting: [], totalDue: 0 })
  })
})

describe('buildQueue: a whole library', () => {
  const everyProblem = (rating: Rating, ago: number) => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    for (const p of PROBLEMS) history[p.slug] = [attempt(day(-ago), rating)]
    return listWith(history, TODAY)
  }

  it('holds a cap of 30 when all 150 are overdue, and nothing is lost', () => {
    const queue = buildQueue(everyProblem('struggled', 40), TODAY, 30)
    expect(queue.today).toHaveLength(30)
    expect(queue.waiting).toHaveLength(120)
    expect(queue.totalDue).toBe(150)
    // Identical schedules tie, so the list order decides.
    expect(slugsOf(queue.today)).toEqual(PROBLEMS.slice(0, 30).map((p) => p.slug))
  })

  it('serves exactly one with a cap of one', () => {
    const queue = buildQueue(everyProblem('struggled', 40), TODAY, 1)
    expect(slugsOf(queue.today)).toEqual([PROBLEMS[0].slug])
    expect(queue.waiting).toHaveLength(149)
  })

  it('is empty when everything is mastered', () => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    for (const p of PROBLEMS) history[p.slug] = [attempt(day(-80), 'easy'), attempt(day(-77), 'easy'), attempt(day(-52), 'easy')]
    const list = listWith(history, TODAY)
    expect(list.every((v) => v.status === 'mastered')).toBe(true)
    expect(buildQueue(list, TODAY, 30)).toMatchObject({ today: [], waiting: [], totalDue: 0, doneToday: 0 })
  })

  it('is empty when everything was solved today', () => {
    expect(buildQueue(everyProblem('easy', 0), TODAY, 30)).toMatchObject({ today: [], waiting: [], totalDue: 0, doneToday: 0 })
  })

  it('handles a year of history on every problem', () => {
    const history: Record<string, ReturnType<typeof attempt>[]> = {}
    PROBLEMS.forEach((p, i) => {
      const attempts = []
      for (let d = 365; d > 0; d -= 20 + (i % 9)) attempts.push(attempt(day(-d), i % 4 === 0 ? 'help' : i % 2 ? 'easy' : 'struggled'))
      history[p.slug] = attempts
    })
    const list = listWith(history, TODAY)
    const queue = buildQueue(list, TODAY, 12)
    expect(queue.today.length).toBeLessThanOrEqual(12)
    expect(queue.totalDue).toBe(list.filter((v) => v.status === 'due').length)
    for (const v of [...queue.today, ...queue.waiting]) expect(Number.isFinite(reviewPriority(v, TODAY))).toBe(true)
    // Everything on the waiting list ranks no higher than anything served today.
    const lowestServed = Math.min(...queue.today.map((v) => reviewPriority(v, TODAY)))
    for (const v of queue.waiting) expect(reviewPriority(v, TODAY)).toBeLessThanOrEqual(lowestServed)
  })
})

describe('buildQueue: odd input', () => {
  it('counts only today when other attempts are dated in the future', () => {
    const list = [
      viewWith('two-sum', [-9, 'easy'], [1, 'easy'], [5, 'easy']),
      viewWith('valid-anagram', [-9, 'easy'], [0, 'struggled']),
    ]
    expect(buildQueue(list, TODAY, 5).doneToday).toBe(1)
  })

  it('does not serve a problem whose latest attempt is in the future', () => {
    const queue = buildQueue([viewWith('two-sum', [-30, 'easy'], [2, 'easy'])], TODAY, 5)
    expect(queue.totalDue).toBe(0)
  })

  it('works on frozen input', () => {
    const list = Object.freeze([viewWith('two-sum', [-5, 'struggled']), viewWith('valid-anagram', [-6, 'struggled'])])
    expect(slugsOf(buildQueue(list, TODAY, 1).today)).toEqual(['valid-anagram'])
  })

  it('serves nothing and keeps everything waiting when the cap is not a number', () => {
    const queue = buildQueue([viewWith('two-sum', [-5, 'struggled'])], TODAY, Number.NaN)
    expect(queue.today).toEqual([])
    expect(queue.totalDue).toBe(1)
  })

  it('never produces a priority that is not finite for a scheduled problem', () => {
    const rng = mulberry32(31)
    const ratings: Rating[] = ['easy', 'struggled', 'help']
    for (let trial = 0; trial < 200; trial++) {
      const steps: [number, Rating][] = []
      let when = -400
      for (let i = 0, n = 1 + Math.floor(rng() * 8); i < n; i++) {
        when += Math.floor(rng() * 60)
        steps.push([when, ratings[Math.floor(rng() * 3)]])
      }
      const view = viewWith('two-sum', ...steps)
      if (view.srs?.due) expect(Number.isFinite(reviewPriority(view, TODAY))).toBe(true)
    }
  })
})
