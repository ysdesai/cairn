import { describe, expect, it } from 'vitest'
import { getProblem } from '../data'
import type { Difficulty } from '../data/types'
import { DEFAULT_TARGETS, type SessionPlan } from '../state/schema'
import {
  DRILL_BLOCK_CARDS,
  DRILL_BLOCK_MINUTES,
  SESSION_PRESETS,
  buildSession,
  estimateMinutes,
  viewSession,
} from './session'
import { attempt, viewOf } from './testing'
import type { ProblemView, Recommendation, ReviewQueue } from './types'

const TODAY = '2026-11-12'

// Easy 15 / medium 25 / hard 40 minutes by default.
const EASY = 'contains-duplicate'
const MEDIUM = 'group-anagrams'
const HARD = 'trapping-rain-water'

// Distinct slugs of one difficulty, for queues of a known size.
const EASY_SLUGS = ['contains-duplicate', 'valid-anagram', 'two-sum', 'valid-palindrome', 'valid-parentheses']
const MEDIUM_SLUGS = [
  'group-anagrams',
  'top-k-frequent-elements',
  'product-of-array-except-self',
  'valid-sudoku',
  'longest-consecutive-sequence',
]

/** A revision candidate solved long ago and never timed: easy 6 minutes, medium 10, hard 15 (40% of the target, at most 15). */
const due = (slug: string, rating: 'easy' | 'help' = 'easy', on = '2026-10-01') =>
  viewOf(slug, [attempt(on, rating)], TODAY)

const rec = (slug: string, note = `Note for ${slug}`): Recommendation => ({
  problem: getProblem(slug)!,
  reason: 'continue',
  note,
})

function build(
  minutes: number,
  over: {
    due?: ProblemView[]
    /** Revisions due beyond the daily cap: a backlog, as `queue.waiting`. */
    waiting?: ProblemView[]
    recs?: Recommendation[]
    targets?: Record<Difficulty, number>
  } = {},
) {
  const today = over.due ?? []
  const recs = over.recs ?? []
  const problems: Record<string, ProblemView> = {}
  for (const v of today) problems[v.problem.slug] = v
  for (const r of recs) problems[r.problem.slug] = viewOf(r.problem.slug, [], TODAY)
  const waiting = over.waiting ?? []
  const queue: ReviewQueue = { cap: 5, doneToday: 0, today, waiting, totalDue: today.length + waiting.length }
  return buildSession({ minutes, queue, recommendations: recs, problems, targets: over.targets ?? DEFAULT_TARGETS })
}

type Items = ReturnType<typeof build>
const kinds = (items: Items) => items.map((i) => i.kind)
const minutesOf = (items: Items) => items.reduce((n, i) => n + i.minutes, 0)

describe('constants', () => {
  it('describe the drill block and the presets', () => {
    expect(DRILL_BLOCK_CARDS).toBe(10)
    expect(DRILL_BLOCK_MINUTES).toBe(5)
    expect(SESSION_PRESETS).toEqual([20, 40, 60, 90])
  })
})

describe('estimateMinutes', () => {
  const view = (slug: string, attempts: ReturnType<typeof attempt>[] = []) => viewOf(slug, attempts, TODAY)

  it('gives a new problem its target plus five for notes', () => {
    expect(estimateMinutes(view(EASY), 'new', DEFAULT_TARGETS)).toBe(20)
    expect(estimateMinutes(view(MEDIUM), 'new', DEFAULT_TARGETS)).toBe(30)
    expect(estimateMinutes(view(HARD), 'new', DEFAULT_TARGETS)).toBe(45)
    expect(estimateMinutes(view(MEDIUM), 'new', { easy: 15, medium: 35, hard: 40 })).toBe(40)
  })

  it('gives a never-timed revision 40% of the target, a revision being a recall check', () => {
    const revised = (slug: string) =>
      estimateMinutes(view(slug, [attempt('2026-10-01', 'easy')]), 'review', DEFAULT_TARGETS)
    expect(revised(EASY)).toBe(6)
    expect(revised(MEDIUM)).toBe(10)
    expect(revised(HARD)).toBe(15) // 16, held to the 15-minute ceiling
  })

  it('gives a timed revision 50% of the last timed attempt', () => {
    const timed = view(EASY, [attempt('2026-10-01', 'easy', { minutes: 14 })])
    expect(estimateMinutes(timed, 'review', DEFAULT_TARGETS)).toBe(7)
  })

  it('goes by the last timed attempt, skipping untimed ones after it', () => {
    const v = view(EASY, [attempt('2026-10-01', 'easy', { minutes: 12 }), attempt('2026-10-05', 'easy')])
    expect(estimateMinutes(v, 'review', DEFAULT_TARGETS)).toBe(6)
  })

  it('never goes over fifteen minutes, however big the target or the last attempt', () => {
    const slow = view(HARD, [attempt('2026-10-01', 'easy', { minutes: 90 })])
    expect(estimateMinutes(slow, 'review', { easy: 15, medium: 25, hard: 120 })).toBe(15)
    const untimed = view(HARD, [attempt('2026-10-01', 'easy')])
    expect(estimateMinutes(untimed, 'review', { easy: 15, medium: 25, hard: 120 })).toBe(15)
  })

  it('is at most the target', () => {
    const slow = view(EASY, [attempt('2026-10-01', 'easy', { minutes: 40 })])
    expect(estimateMinutes(slow, 'review', DEFAULT_TARGETS)).toBe(15)
  })

  it('is at least five minutes', () => {
    const quick = view(EASY, [attempt('2026-10-01', 'easy', { minutes: 2 })])
    expect(estimateMinutes(quick, 'review', DEFAULT_TARGETS)).toBe(5)
    const untimed = view(EASY, [attempt('2026-10-01', 'easy')])
    expect(estimateMinutes(untimed, 'review', { easy: 6, medium: 25, hard: 40 })).toBe(5)
  })

  it('lets the target win when it is under five', () => {
    const v = view(EASY, [attempt('2026-10-01', 'easy')])
    expect(estimateMinutes(v, 'review', { easy: 4, medium: 25, hard: 40 })).toBe(4)
  })

  it('rounds to whole minutes', () => {
    const v = view(MEDIUM, [attempt('2026-10-01', 'easy', { minutes: 17 })])
    expect(estimateMinutes(v, 'review', DEFAULT_TARGETS)).toBe(9) // 8.5
  })
})

describe('buildSession', () => {
  it('is a lone drill block when there is nothing to revise or learn', () => {
    expect(build(60)).toEqual([{ kind: 'drill', minutes: 5, reason: 'Warm-up · 10 pattern cards' }])
  })

  it('is empty for a budget under five minutes with nothing that fits', () => {
    expect(build(4)).toEqual([])
    expect(build(0, { recs: [rec(EASY)] })).toEqual([])
  })

  it('orders the result: drill, revisions, then new problems', () => {
    const items = build(60, { due: EASY_SLUGS.slice(0, 3).map((s) => due(s)), recs: [rec('valid-palindrome')] })
    // 3 x 6 + 20 = 38, leaving 22 for the warm-up.
    expect(kinds(items)).toEqual(['drill', 'review', 'review', 'review', 'new'])
    expect(minutesOf(items)).toBe(43)
  })

  it('keeps room for a new problem on budgets of 30 minutes or more', () => {
    const items = build(40, { due: MEDIUM_SLUGS.map((s) => due(s)), recs: [rec('valid-palindrome')] })
    // 20 is held back, so only two 10-minute revisions fit before the new problem.
    expect(kinds(items)).toEqual(['review', 'review', 'new'])
  })

  it('does not hold anything back under 30 minutes', () => {
    const items = build(29, { due: MEDIUM_SLUGS.map((s) => due(s)), recs: [rec('valid-palindrome')] })
    // Two revisions (20); a third would make 30. The new problem would make 40, over 29 x 1.1.
    expect(kinds(items)).toEqual(['drill', 'review', 'review'])
  })

  it('holds nothing back when there is no recommendation', () => {
    const items = build(40, { due: MEDIUM_SLUGS.map((s) => due(s)) })
    expect(items.filter((i) => i.kind === 'review')).toHaveLength(4) // 40 of 40
  })

  it('does not hold back time for a problem that could never fit', () => {
    const items = build(30, { due: MEDIUM_SLUGS.map((s) => due(s)), recs: [rec(HARD)] }) // 45 against 33
    expect(items.filter((i) => i.kind === 'review')).toHaveLength(3)
    expect(items.some((i) => i.kind === 'new')).toBe(false)
  })

  it('always includes one revision on budgets of ten minutes or more, even if it does not fit', () => {
    const items = build(10, { due: [due(HARD)] }) // 15 minutes
    expect(kinds(items)).toEqual(['review'])
    expect(items[0].minutes).toBe(15)
  })

  it('does not force a revision under ten minutes', () => {
    expect(kinds(build(9, { due: [due(HARD)] }))).toEqual(['drill'])
    expect(kinds(build(9, { due: [due(EASY)] }))).toEqual(['review'])
  })

  it('stops adding revisions at the first one that does not fit', () => {
    const items = build(20, { due: [due(EASY), due(HARD), due('valid-anagram')] })
    // 6, then 15 would make 21: stop, even though another 6 would still fit.
    expect(items.filter((i) => i.kind === 'review').map((i) => i.slug)).toEqual([EASY])
  })

  it('adds at most three new problems when a fourth would not fit inside the budget', () => {
    const items = build(100, { recs: MEDIUM_SLUGS.map((s) => rec(s)) })
    expect(kinds(items)).toEqual(['drill', 'new', 'new', 'new'])
    // 3 x 30 = 90 of 100; a fourth makes 120, past the budget and past the 10% allowance.
    expect(items.filter((i) => i.kind === 'new')).toHaveLength(3)
  })

  it('goes past three, up to five, only while each still fits inside the budget', () => {
    const quick = EASY_SLUGS.map((s) => rec(s)) // 20 minutes each
    expect(build(90, { recs: quick }).filter((i) => i.kind === 'new')).toHaveLength(4) // 80; a fifth makes 100
    expect(build(120, { recs: quick }).filter((i) => i.kind === 'new')).toHaveLength(5)
    expect(build(200, { recs: quick }).filter((i) => i.kind === 'new')).toHaveLength(5)
    // 3 x 20 + 30 = 90 fits 90 exactly; at 89 the fourth would need the 10% allowance, which it does not get.
    const mixed = [rec(EASY), rec('valid-anagram'), rec('two-sum'), rec(MEDIUM)]
    expect(build(90, { recs: mixed }).filter((i) => i.kind === 'new')).toHaveLength(4)
    expect(build(89, { recs: mixed }).filter((i) => i.kind === 'new')).toHaveLength(3)
  })

  it('fills a first-run 90 minutes: three easy problems and the next one, no drill needed', () => {
    // Nothing solved, so the route is the first problems of Arrays & Hashing: easy, easy, easy, medium.
    const recs = ['contains-duplicate', 'valid-anagram', 'two-sum', 'group-anagrams'].map((s) => rec(s))
    const items = build(90, { recs })
    expect(kinds(items)).toEqual(['new', 'new', 'new', 'new'])
    expect(minutesOf(items)).toBe(90)
  })

  it('lets the session run 10% over the budget for a new problem', () => {
    // A medium problem is 30 minutes: over 28 but within 28 x 1.1 = 30.8, and over 27 x 1.1 = 29.7.
    expect(kinds(build(28, { recs: [rec(MEDIUM)] }))).toEqual(['new'])
    expect(kinds(build(27, { recs: [rec(MEDIUM)] }))).toEqual(['drill'])
  })

  it('stops adding new problems at the first one that does not fit', () => {
    const items = build(75, { recs: [rec(MEDIUM), rec(HARD), rec(EASY)] })
    // 30 and 45 make 75; the easy one (20) would make 95 > 82.5.
    expect(items.filter((i) => i.kind === 'new').map((i) => i.slug)).toEqual([MEDIUM, HARD])
    const skipped = build(45, { recs: [rec(HARD), rec('valid-anagram')] })
    expect(skipped.filter((i) => i.kind === 'new').map((i) => i.slug)).toEqual([HARD])
  })

  it('adds a warm-up only when five minutes or more remain', () => {
    expect(kinds(build(25, { recs: [rec(EASY)] }))).toEqual(['drill', 'new']) // 20 used, 5 left
    expect(kinds(build(24, { recs: [rec(EASY)] }))).toEqual(['new']) // 20 used, 4 left
  })

  it('fits the 20-minute preset with two revisions and a warm-up, and not a new problem', () => {
    const items = build(20, { due: [due(EASY), due('valid-anagram')], recs: [rec(MEDIUM)] })
    expect(kinds(items)).toEqual(['drill', 'review', 'review'])
    expect(minutesOf(items)).toBe(17)
  })

  it('uses the targets it is given', () => {
    const items = build(30, { recs: [rec(EASY)], targets: { easy: 10, medium: 20, hard: 30 } })
    expect(items.find((i) => i.kind === 'new')?.minutes).toBe(15)
  })

  it('gives each item a short reason', () => {
    const items = build(90, {
      due: [
        due(EASY, 'easy', '2026-11-09'), // due today
        due('valid-anagram', 'help', '2026-11-10'), // a day overdue, needed help
        due('two-sum', 'easy', '2026-11-01'), // eight days overdue
      ],
      recs: [rec(MEDIUM, 'Continue Arrays & Hashing · 3 of 9')],
    })
    expect(items.map((i) => i.reason)).toEqual([
      'Warm-up · 10 pattern cards',
      'Due today',
      'Waiting 1 day · needed help last',
      'Waiting 8 days',
      'Continue Arrays & Hashing · 3 of 9',
    ])
  })

  it('names the problem on every item but the drill block', () => {
    const items = build(60, { due: [due(EASY)], recs: [rec(MEDIUM)] })
    expect(items.map((i) => i.slug)).toEqual([undefined, EASY, MEDIUM])
  })

  it('ignores a recommendation with no matching view', () => {
    const queue: ReviewQueue = { cap: 5, doneToday: 0, today: [], waiting: [], totalDue: 0 }
    const items = buildSession({
      minutes: 60,
      queue,
      recommendations: [rec(EASY)],
      problems: {},
      targets: DEFAULT_TARGETS,
    })
    expect(kinds(items)).toEqual(['drill'])
  })

  it('is deterministic', () => {
    const input = { due: EASY_SLUGS.map((s) => due(s)), recs: [rec(MEDIUM), rec(HARD)] }
    expect(build(60, input)).toEqual(build(60, input))
  })
})

describe('buildSession with a backlog', () => {
  // 19 revisions are due and the cap is 5: five go in today's queue, fourteen wait.
  const today = () => MEDIUM_SLUGS.map((slug) => due(slug)) // 10 minutes each
  const waiting = () =>
    Array.from({ length: 14 }, (_, i) => due(EASY_SLUGS[i % EASY_SLUGS.length], 'easy', `2026-09-${String(i + 1).padStart(2, '0')}`))
  const withBacklog = (minutes: number, recs: Recommendation[] = [rec('valid-palindrome')]) =>
    build(minutes, { due: today(), waiting: waiting(), recs })
  const reviewCount = (items: Items) => items.filter((i) => i.kind === 'review').length

  it('holds nothing back for a new problem: 60 minutes clears the whole cap of five', () => {
    const items = withBacklog(60)
    expect(reviewCount(items)).toBe(5)
    // 50 minutes of revision, a 5-minute warm-up, and no room left for new ground.
    expect(kinds(items)).toEqual(['drill', 'review', 'review', 'review', 'review', 'review'])
    expect(minutesOf(items)).toBe(55)
  })

  it('does the same sitting differently with no backlog: a new problem is held back first', () => {
    const items = build(60, { due: today(), recs: [rec('valid-palindrome')] })
    // 20 minutes are held for the new problem, so only four of the five revisions fit.
    expect(reviewCount(items)).toBe(4)
    expect(items.some((i) => i.kind === 'new')).toBe(true)
  })

  it('adds a new problem once the cap is cleared and time remains: 90 minutes', () => {
    const items = withBacklog(90, [rec(MEDIUM)])
    expect(kinds(items)).toEqual(['drill', 'review', 'review', 'review', 'review', 'review', 'new'])
    expect(minutesOf(items)).toBeLessThanOrEqual(90)
  })

  it('takes as many revisions as fit when the budget is short: 40 and 20 minutes', () => {
    expect(kinds(withBacklog(40))).toEqual(['review', 'review', 'review', 'review'])
    expect(kinds(withBacklog(20))).toEqual(['review', 'review'])
  })

  it('never runs past the budget, apart from the one forced revision', () => {
    for (const minutes of [10, 20, 25, 40, 45, 60, 75, 90, 120]) {
      const items = withBacklog(minutes)
      const reviews = items.filter((i) => i.kind === 'review')
      expect(minutesOf(items) - reviews[0].minutes).toBeLessThanOrEqual(minutes)
    }
  })

  it('keeps the revisions in queue order and tries a cheaper one when the next does not fit', () => {
    // Budget 22: Trapping Rain Water 15, a medium would make 25 (skipped), an easy 6 makes 21.
    const items = build(22, {
      due: [due(HARD), due(MEDIUM), due(EASY)],
      waiting: waiting(),
    })
    expect(items.filter((i) => i.kind === 'review').map((i) => i.slug)).toEqual([HARD, EASY])
  })

  it('still forces one revision from ten minutes and none under it', () => {
    expect(kinds(build(10, { due: [due(HARD)], waiting: waiting() }))).toEqual(['review'])
    expect(kinds(build(9, { due: [due(HARD)], waiting: waiting() }))).toEqual(['drill'])
  })

  it('skips a new problem that does not fit, rather than promising it', () => {
    const items = withBacklog(30, [rec(HARD)])
    expect(kinds(items)).toEqual(['review', 'review', 'review'])
  })

  it('is the ordinary build when the cap was already used up today and only the waiting remain', () => {
    // Nothing left in today's queue: the new problem is simply added.
    const items = build(40, { waiting: waiting(), recs: [rec(MEDIUM)] })
    expect(kinds(items)).toEqual(['drill', 'new'])
  })
})

describe('viewSession', () => {
  const plan = (items: SessionPlan['items'], date = TODAY): SessionPlan => ({ date, budget: 60, items, createdAt: 1 })
  const problemsOf = (...views: ProblemView[]) => Object.fromEntries(views.map((v) => [v.problem.slug, v]))

  it('is null without a plan, and for a plan from another day', () => {
    const items: SessionPlan['items'] = [{ kind: 'drill', minutes: 5, reason: 'Warm-up' }]
    expect(viewSession(null, {}, 0, TODAY)).toBeNull()
    expect(viewSession(plan(items, '2026-11-11'), {}, 0, TODAY)).toBeNull()
    expect(viewSession(plan(items, '2026-11-13'), {}, 0, TODAY)).toBeNull()
  })

  it('marks a problem done once it has an attempt dated today', () => {
    const done = viewOf(EASY, [attempt('2026-10-01', 'easy'), attempt(TODAY, 'easy')], TODAY)
    const waiting = viewOf(MEDIUM, [attempt('2026-11-11', 'easy')], TODAY)
    const untouched = viewOf('two-sum', [], TODAY)
    const view = viewSession(
      plan([
        { kind: 'review', slug: EASY, minutes: 9, reason: 'Due today' },
        { kind: 'review', slug: MEDIUM, minutes: 15, reason: 'Due today' },
        { kind: 'new', slug: 'two-sum', minutes: 20, reason: 'Continue' },
      ]),
      problemsOf(done, waiting, untouched),
      0,
      TODAY,
    )!
    expect(view.items.map((i) => i.done)).toEqual([true, false, false])
    expect(view.items[0].problem).toBe(done.problem)
    expect(view.doneCount).toBe(1)
    expect(view.nextIndex).toBe(1)
  })

  it('marks the drill block done at ten cards today, not nine', () => {
    const items: SessionPlan['items'] = [{ kind: 'drill', minutes: 5, reason: 'Warm-up' }]
    expect(viewSession(plan(items), {}, 9, TODAY)!.items[0].done).toBe(false)
    expect(viewSession(plan(items), {}, 10, TODAY)!.items[0].done).toBe(true)
    expect(viewSession(plan(items), {}, 25, TODAY)!.items[0].done).toBe(true)
    expect(viewSession(plan(items), {}, 0, TODAY)!.items[0].problem).toBeNull()
  })

  it('totals the planned minutes of every item and carries the budget', () => {
    const view = viewSession(
      plan([
        { kind: 'drill', minutes: 5, reason: 'Warm-up' },
        { kind: 'review', slug: EASY, minutes: 9, reason: 'Due today' },
        { kind: 'new', slug: MEDIUM, minutes: 30, reason: 'Continue' },
      ]),
      problemsOf(viewOf(EASY, [], TODAY), viewOf(MEDIUM, [], TODAY)),
      0,
      TODAY,
    )!
    expect(view.plannedMinutes).toBe(44)
    expect(view.budget).toBe(60)
  })

  it('reports -1 when everything is done, and for a plan with no items', () => {
    const touched = viewOf(EASY, [attempt(TODAY, 'easy')], TODAY)
    const finished = viewSession(
      plan([
        { kind: 'drill', minutes: 5, reason: 'Warm-up' },
        { kind: 'new', slug: EASY, minutes: 20, reason: 'Continue' },
      ]),
      problemsOf(touched),
      10,
      TODAY,
    )!
    expect(finished.doneCount).toBe(2)
    expect(finished.nextIndex).toBe(-1)

    const empty = viewSession(plan([]), {}, 0, TODAY)!
    expect(empty).toMatchObject({ doneCount: 0, nextIndex: -1, plannedMinutes: 0, items: [] })
  })

  it('finds the first item not done, not the last', () => {
    const second = viewOf(MEDIUM, [attempt(TODAY, 'easy')], TODAY)
    const view = viewSession(
      plan([
        { kind: 'drill', minutes: 5, reason: 'Warm-up' },
        { kind: 'review', slug: MEDIUM, minutes: 15, reason: 'Due today' },
        { kind: 'new', slug: EASY, minutes: 20, reason: 'Continue' },
      ]),
      problemsOf(second, viewOf(EASY, [], TODAY)),
      0,
      TODAY,
    )!
    expect(view.items.map((i) => i.done)).toEqual([false, true, false])
    expect(view.nextIndex).toBe(0)
  })

  it('leaves an item with an unknown problem not done, with no problem attached', () => {
    const unknown = plan([{ kind: 'new', slug: 'not-a-problem', minutes: 20, reason: 'Continue' }])
    expect(viewSession(unknown, {}, 0, TODAY)!.items[0]).toMatchObject({ done: false, problem: null })
  })
})

describe('estimateMinutes rounding', () => {
  const timed = (minutes: number) => viewOf(HARD, [attempt('2026-10-01', 'easy', { minutes })], TODAY)

  it('rounds a half minute up, even where floating point would land just below it', () => {
    expect(estimateMinutes(timed(25), 'review', DEFAULT_TARGETS)).toBe(13) // 12.5
    expect(estimateMinutes(timed(21), 'review', DEFAULT_TARGETS)).toBe(11) // 10.5
    expect(estimateMinutes(timed(19), 'review', DEFAULT_TARGETS)).toBe(10) // 9.5
  })

  it('takes 40% of an odd target exactly', () => {
    const untimed = viewOf(HARD, [attempt('2026-10-01', 'easy')], TODAY)
    expect(estimateMinutes(untimed, 'review', { easy: 15, medium: 25, hard: 35 })).toBe(14)
    expect(estimateMinutes(untimed, 'review', { easy: 15, medium: 25, hard: 33 })).toBe(13) // 13.2
    expect(estimateMinutes(untimed, 'review', { easy: 15, medium: 25, hard: 6 })).toBe(5)
  })

  it('treats a zero-minute attempt as the five-minute floor, not zero', () => {
    expect(estimateMinutes(timed(0), 'review', DEFAULT_TARGETS)).toBe(5)
  })
})

describe('buildSession edge cases', () => {
  it('copes with a zero, negative or fractional budget without throwing', () => {
    expect(build(0, { due: [due(EASY)] })).toEqual([])
    expect(build(-30, { due: [due(EASY)], recs: [rec(MEDIUM)] })).toEqual([])
    expect(kinds(build(4.5, { due: [due(EASY)] }))).toEqual([])
  })

  it('never forces a revision into a budget under ten minutes', () => {
    expect(kinds(build(9.9, { due: [due(HARD)] }))).toEqual(['drill'])
  })

  it('forces one revision at exactly ten minutes and no more', () => {
    const items = build(10, { due: [due(EASY), due('valid-anagram')], recs: [rec(MEDIUM)] })
    expect(items.filter((i) => i.kind === 'review')).toHaveLength(1)
    expect(items.some((i) => i.kind === 'drill')).toBe(false)
  })

  it('holds back a new problem from exactly 30 minutes, not from 29', () => {
    const queue = EASY_SLUGS.map((s) => due(s)) // 6 minutes each
    // The new easy problem is 20 minutes. At 30 minutes it is held back, so only 10 minutes of revision.
    expect(build(30, { due: queue, recs: [rec(EASY)] }).map((i) => i.kind)).toEqual(['review', 'new'])
    // At 29 nothing is held back: four revisions fit, the new problem does not, and 5 minutes are left for a warm-up.
    expect(build(29, { due: queue, recs: [rec(EASY)] }).map((i) => i.kind)).toEqual([
      'drill',
      'review',
      'review',
      'review',
      'review',
    ])
  })

  it('keeps the held-back problem even when the forced revision leaves no room for it', () => {
    // One 15-minute revision is forced; with the 20-minute new problem that is 35, over 30 x 1.1.
    const items = build(30, { due: [due(HARD)], recs: [rec(EASY)] })
    expect(kinds(items)).toEqual(['review', 'new'])
    expect(items.map((i) => i.minutes)).toEqual([15, 20])
  })

  it('lets only the held-back problem past the allowance, not a second new problem', () => {
    const items = build(30, { due: [due(HARD)], recs: [rec(EASY), rec('valid-anagram')] })
    expect(items.filter((i) => i.kind === 'new').map((i) => i.slug)).toEqual([EASY])
  })

  it('still fits further new problems within the allowance after the held-back one', () => {
    // Held back: 20. Nothing is due, so 20 + 10 (a cheap 5-minute target) fits in 33.
    const targets = { easy: 15, medium: 5, hard: 40 }
    const items = build(30, { recs: [rec(EASY), rec(MEDIUM)], targets })
    expect(items.filter((i) => i.kind === 'new').map((i) => i.slug)).toEqual([EASY, MEDIUM])
  })

  it('does not run a heavy queue past the budget by more than the one forced revision', () => {
    const queue = [...EASY_SLUGS, ...MEDIUM_SLUGS].map((s) => due(s))
    for (const minutes of [10, 20, 40, 60, 90, 240]) {
      const items = build(minutes, { due: queue })
      const reviews = items.filter((i) => i.kind === 'review')
      const withoutFirst = minutesOf(items) - reviews[0].minutes
      expect(withoutFirst).toBeLessThanOrEqual(minutes * 1.1)
    }
  })

  it('keeps every due revision in queue order when the budget is large', () => {
    const queue = EASY_SLUGS.map((s) => due(s))
    const items = build(240, { due: queue })
    expect(items.filter((i) => i.kind === 'review').map((i) => i.slug)).toEqual(EASY_SLUGS)
  })

  it('lets the 90-minute preset take a full queue of five and three new problems', () => {
    const items = build(90, { due: EASY_SLUGS.map((s) => due(s)), recs: [rec(MEDIUM), rec('valid-anagram'), rec('two-sum')] })
    // 5 x 6 = 30 of revisions, then 30 + 20 = 50 of new problems make 80; the third (100) is cut.
    expect(kinds(items)).toEqual(['drill', 'review', 'review', 'review', 'review', 'review', 'new', 'new'])
  })

  it('fits five revisions and three quick new problems into 90 minutes', () => {
    const items = build(90, { due: EASY_SLUGS.map((s) => due(s)), recs: [rec(EASY), rec('valid-anagram'), rec('two-sum')] })
    expect(kinds(items)).toEqual(['review', 'review', 'review', 'review', 'review', 'new', 'new', 'new'])
  })

  it('is a single revision of an overdue hard problem at a ten minute budget, with its reason', () => {
    const items = build(10, { due: [due(HARD, 'help', '2026-11-01')] })
    expect(items).toEqual([
      { kind: 'review', slug: HARD, minutes: 15, reason: 'Waiting 10 days · needed help last' },
    ])
  })

  it('does not change the queue or the recommendations it is given', () => {
    const today = EASY_SLUGS.slice(0, 2).map((s) => due(s))
    const recs = [rec(MEDIUM)]
    const queue: ReviewQueue = { cap: 5, doneToday: 0, today, waiting: [], totalDue: 2 }
    const problems = Object.fromEntries([...today, viewOf(MEDIUM, [], TODAY)].map((v) => [v.problem.slug, v]))
    const before = JSON.stringify({ queue, recs })
    buildSession({ minutes: 60, queue, recommendations: recs, problems, targets: DEFAULT_TARGETS })
    expect(JSON.stringify({ queue, recs })).toBe(before)
  })
})

describe('viewSession edge cases', () => {
  const plan = (items: SessionPlan['items'], date = TODAY): SessionPlan => ({ date, budget: 60, items, createdAt: 1 })

  it('does not count an attempt dated tomorrow or yesterday as done today', () => {
    const items: SessionPlan['items'] = [
      { kind: 'review', slug: EASY, minutes: 9, reason: 'Due today' },
      { kind: 'review', slug: MEDIUM, minutes: 15, reason: 'Due today' },
    ]
    const view = viewSession(
      plan(items),
      {
        [EASY]: viewOf(EASY, [attempt('2026-11-13', 'easy')], TODAY),
        [MEDIUM]: viewOf(MEDIUM, [attempt('2026-11-11', 'easy')], TODAY),
      },
      0,
      TODAY,
    )!
    expect(view.items.map((i) => i.done)).toEqual([false, false])
  })

  it('counts several attempts on one day as one completed item', () => {
    const items: SessionPlan['items'] = [{ kind: 'new', slug: EASY, minutes: 20, reason: 'Continue' }]
    const touched = viewOf(EASY, [attempt(TODAY, 'help'), attempt(TODAY, 'easy')], TODAY)
    const view = viewSession(plan(items), { [EASY]: touched }, 0, TODAY)!
    expect(view).toMatchObject({ doneCount: 1, nextIndex: -1 })
  })

  it('works through a session in order as it gets done', () => {
    const items: SessionPlan['items'] = [
      { kind: 'drill', minutes: 5, reason: 'Warm-up' },
      { kind: 'review', slug: EASY, minutes: 9, reason: 'Due today' },
      { kind: 'new', slug: MEDIUM, minutes: 30, reason: 'Continue' },
    ]
    const at = (drills: number, easyDone: boolean, mediumDone: boolean) =>
      viewSession(
        plan(items),
        {
          [EASY]: viewOf(EASY, easyDone ? [attempt(TODAY, 'easy')] : [], TODAY),
          [MEDIUM]: viewOf(MEDIUM, mediumDone ? [attempt(TODAY, 'easy')] : [], TODAY),
        },
        drills,
        TODAY,
      )!
    expect(at(0, false, false)).toMatchObject({ doneCount: 0, nextIndex: 0 })
    expect(at(10, false, false)).toMatchObject({ doneCount: 1, nextIndex: 1 })
    expect(at(10, true, false)).toMatchObject({ doneCount: 2, nextIndex: 2 })
    expect(at(10, true, true)).toMatchObject({ doneCount: 3, nextIndex: -1 })
  })

  it('does not change the plan it is given', () => {
    const items: SessionPlan['items'] = [{ kind: 'drill', minutes: 5, reason: 'Warm-up' }]
    const p = plan(items)
    const before = JSON.stringify(p)
    viewSession(p, {}, 10, TODAY)
    expect(JSON.stringify(p)).toBe(before)
  })
})
