import { describe, expect, it } from 'vitest'
import { DEFAULT_TARGETS } from '../state/schema'
import { LADDER } from './srs'
import { STRENGTH_WEIGHTS, topicStrength } from './strength'
import { attempt, viewOf } from './testing'

const TODAY = '2026-11-12'
const NO_DRILL = { seen: 0, correct: 0 }

// Easy (target 15), medium (target 25) and hard (target 40) problems from the catalog.
const EASY = 'contains-duplicate'
const EASY_2 = 'valid-anagram'
const MEDIUM = 'group-anagrams'

const strengthOf = (views: ReturnType<typeof viewOf>[], drill = NO_DRILL) =>
  topicStrength(views, drill, DEFAULT_TARGETS)

describe('weights', () => {
  it('sum to one', () => {
    const total = Object.values(STRENGTH_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
  })
})

describe('with no data', () => {
  it('is unexplored', () => {
    const result = strengthOf([viewOf(EASY, [], TODAY)])
    expect(result).toEqual({
      strength: null,
      parts: { ratings: null, pace: null, retention: null, drill: null },
      confidence: 'none',
      weakness: null,
    })
  })

  it('handles an empty topic', () => {
    expect(strengthOf([]).strength).toBeNull()
  })
})

describe('ratings', () => {
  it('scores one solve by its rating', () => {
    const score = (rating: 'easy' | 'struggled' | 'help') =>
      strengthOf([viewOf(EASY, [attempt('2026-11-01', rating)], TODAY)]).parts.ratings
    expect(score('easy')).toBe(1)
    expect(score('struggled')).toBe(0.55)
    expect(score('help')).toBe(0.15)
  })

  it('weights the latest attempt most, each earlier one by 0.6', () => {
    const recovered = viewOf(EASY, [attempt('2026-11-01', 'help'), attempt('2026-11-04', 'easy')], TODAY)
    expect(strengthOf([recovered]).parts.ratings).toBeCloseTo((1 + 0.6 * 0.15) / 1.6)

    const slipped = viewOf(EASY, [attempt('2026-11-01', 'easy'), attempt('2026-11-04', 'help')], TODAY)
    expect(strengthOf([slipped]).parts.ratings).toBeCloseTo((0.15 + 0.6 * 1) / 1.6)
  })

  it('goes by date, not by the order attempts were stored', () => {
    const late = attempt('2026-11-04', 'easy')
    const early = attempt('2026-11-01', 'help')
    const view = viewOf(EASY, [late, early], TODAY)
    expect(strengthOf([view]).parts.ratings).toBeCloseTo((1 + 0.6 * 0.15) / 1.6)
  })

  it('is the mean over solved problems, ignoring untouched ones', () => {
    const views = [
      viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY),
      viewOf(EASY_2, [attempt('2026-11-01', 'help')], TODAY),
      viewOf(MEDIUM, [], TODAY),
    ]
    expect(strengthOf(views).parts.ratings).toBeCloseTo(0.575)
  })
})

describe('pace', () => {
  const pace = (minutes: number, slug = EASY) =>
    strengthOf([viewOf(slug, [attempt('2026-11-01', 'easy', { minutes })], TODAY)]).parts.pace

  it('is 1 at or under target and 0 at twice the target', () => {
    expect(pace(10)).toBe(1)
    expect(pace(15)).toBe(1)
    expect(pace(30)).toBe(0)
    expect(pace(90)).toBe(0)
  })

  it('is linear in between, against the target for the difficulty', () => {
    expect(pace(22.5)).toBeCloseTo(0.5)
    expect(pace(25, MEDIUM)).toBe(1)
    expect(pace(37.5, MEDIUM)).toBeCloseTo(0.5)
  })

  it('holds a revision to 60% of the target', () => {
    const revised = (minutes: number) =>
      strengthOf([
        viewOf(
          EASY,
          [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'easy', { minutes })],
          TODAY,
        ),
      ]).parts.pace
    expect(revised(9)).toBe(1)
    expect(revised(13.5)).toBeCloseTo(0.5)
    expect(revised(18)).toBe(0)
  })

  it('averages timed attempts and skips untimed ones', () => {
    const view = viewOf(
      EASY,
      [attempt('2026-11-01', 'easy', { minutes: 15 }), attempt('2026-11-05', 'easy'), attempt('2026-11-20', 'easy', { minutes: 18 })],
      TODAY,
    )
    // First is on target (1); the third is a revision against 9 minutes, twice over (0).
    expect(strengthOf([view]).parts.pace).toBeCloseTo(0.5)
  })

  it('is null when nothing was timed', () => {
    expect(strengthOf([viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)]).parts.pace).toBeNull()
  })
})

describe('retention', () => {
  it('is null until a problem has been revised', () => {
    expect(strengthOf([viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)]).parts.retention).toBeNull()
  })

  it('rewards climbing the ladder without lapses', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'easy')], TODAY)
    const { step } = view.srs!
    expect(strengthOf([view]).parts.retention).toBeCloseTo(0.6 * (step / LADDER.length) + 0.4)
  })

  it('is zero after a single revision that needed help', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'help')], TODAY)
    expect(strengthOf([view]).parts.retention).toBe(0)
  })

  it('counts a mastered problem at full marks', () => {
    const view = viewOf(
      EASY,
      [
        attempt('2026-09-01', 'easy'),
        attempt('2026-09-05', 'easy'),
        attempt('2026-09-20', 'easy'),
        attempt('2026-11-05', 'easy'),
      ],
      TODAY,
    )
    expect(view.srs?.mastered).toBe(true)
    expect(strengthOf([view]).parts.retention).toBe(1)
  })

  it('averages over revised problems only', () => {
    const revised = viewOf(EASY, [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'help')], TODAY)
    const fresh = viewOf(EASY_2, [attempt('2026-11-01', 'easy')], TODAY)
    expect(strengthOf([revised, fresh]).parts.retention).toBe(0)
  })
})

describe('drill', () => {
  it('is smoothed so a few cards cannot score 0 or 1', () => {
    expect(strengthOf([], { seen: 4, correct: 3 }).parts.drill).toBeCloseTo(4 / 6)
    expect(strengthOf([], { seen: 1, correct: 1 }).parts.drill).toBeCloseTo(2 / 3)
    expect(strengthOf([], { seen: 1, correct: 0 }).parts.drill).toBeCloseTo(1 / 3)
  })

  it('is null with no cards, not 0.5', () => {
    expect(strengthOf([], NO_DRILL).parts.drill).toBeNull()
  })
})

describe('strength', () => {
  it('is a whole number from 0 to 100', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    expect(strengthOf([view]).strength).toBe(100)
    const helped = viewOf(EASY, [attempt('2026-11-01', 'help')], TODAY)
    expect(strengthOf([helped]).strength).toBe(15)
  })

  it('averages only the ingredients that have data', () => {
    // ratings 1 (weight 0.4) and drill 1/10 (weight 0.2): (0.4 + 0.02) / 0.6 = 0.7
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    expect(strengthOf([view], { seen: 8, correct: 0 }).strength).toBe(70)
  })

  it('is not scored from the drill alone: nothing solved means no strength, no confidence, no weakness', () => {
    const result = strengthOf([viewOf(EASY, [], TODAY)], { seen: 2, correct: 2 })
    expect(result.strength).toBeNull()
    expect(result.confidence).toBe('none')
    expect(result.weakness).toBeNull()
    // The drill figure is still reported, for a screen that wants to show it as drill-only.
    expect(result.parts.drill).toBe(0.75)
    expect(result.parts.ratings).toBeNull()
  })

  it('stays null for a topic with no problems at all, even with a perfect drill', () => {
    const result = strengthOf([], { seen: 30, correct: 30 })
    expect(result).toMatchObject({ strength: null, confidence: 'none', weakness: null })
  })

  it('is scored as soon as one problem is solved', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    expect(strengthOf([view], { seen: 8, correct: 8 }).strength).not.toBeNull()
  })

  it('combines all four with the stated weights', () => {
    const view = viewOf(
      EASY,
      [attempt('2026-11-01', 'easy', { minutes: 22.5 }), attempt('2026-11-05', 'help')],
      TODAY,
    )
    const { parts, strength } = strengthOf([view], { seen: 2, correct: 0 })
    const expected =
      100 *
      (0.4 * parts.ratings! + 0.25 * parts.retention! + 0.2 * parts.drill! + 0.15 * parts.pace!)
    expect(strength).toBe(Math.round(expected))
  })
})

describe('confidence', () => {
  // One solved problem with one attempt, so evidence is 1 + cards.
  const solvedOnce = [viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)]
  const withEvidence = (cards: number) => strengthOf(solvedOnce, { seen: cards, correct: cards }).confidence

  it('counts attempts and drill cards together, with thresholds at 1, 4 and 12', () => {
    expect(strengthOf([], { seen: 0, correct: 0 }).confidence).toBe('none')
    expect(withEvidence(0)).toBe('low') // 1 attempt
    expect(withEvidence(2)).toBe('low') // 3
    expect(withEvidence(3)).toBe('medium') // 4
    expect(withEvidence(10)).toBe('medium') // 11
    expect(withEvidence(11)).toBe('high') // 12
  })

  it('is none while nothing is solved, however many cards were answered', () => {
    expect(strengthOf([viewOf(EASY, [], TODAY)], { seen: 40, correct: 40 }).confidence).toBe('none')
  })

  it('adds attempts to cards', () => {
    const views = [
      viewOf(EASY, [attempt('2026-11-01', 'easy'), attempt('2026-11-03', 'easy')], TODAY),
      viewOf(EASY_2, [attempt('2026-11-01', 'easy')], TODAY),
    ]
    expect(strengthOf(views).confidence).toBe('low')
    expect(strengthOf(views, { seen: 1, correct: 1 }).confidence).toBe('medium')
  })
})

describe('weakness', () => {
  it('is null when every ingredient is at 0.6 or better', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy', { minutes: 10 })], TODAY)
    expect(strengthOf([view], { seen: 4, correct: 4 }).weakness).toBeNull()
  })

  it('names slow solves with the ratio to target', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy', { minutes: 24 })], TODAY)
    expect(strengthOf([view]).weakness).toBe('solve times run about 1.6× target')
  })

  it('names shaky ratings with their average', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'help')], TODAY)
    expect(strengthOf([view]).weakness).toBe('recent ratings average 15%')
  })

  it('names lapses in revision', () => {
    const lapsed = (slug: string) =>
      viewOf(slug, [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'help')], TODAY)
    expect(strengthOf([lapsed(EASY)]).weakness).toBe('one lapse in revision')
    expect(strengthOf([lapsed(EASY), lapsed(EASY_2)]).weakness).toBe('two lapses in revision')
  })

  it('says revisions are early when retention is low without lapses', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'struggled'), attempt('2026-11-05', 'struggled')], TODAY)
    expect(view.srs?.lapses).toBe(0)
    expect(strengthOf([view]).weakness).toBe('revisions are still early on the ladder')
  })

  it('names the drill with the cards answered', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    expect(strengthOf([view], { seen: 10, correct: 2 }).weakness).toBe('2 of 10 drill cards right')
  })

  it('names only the lowest ingredient', () => {
    // ratings 0.15, pace 0.4: the ratings are lower.
    const view = viewOf(EASY, [attempt('2026-11-01', 'help', { minutes: 24 })], TODAY)
    expect(strengthOf([view]).weakness).toBe('recent ratings average 15%')
  })

  it('is null for an unexplored topic', () => {
    expect(strengthOf([viewOf(EASY, [], TODAY)]).weakness).toBeNull()
  })
})

describe('a few weeks of history', () => {
  it('scores a steady climber well and a struggling one low', () => {
    const steady = [
      viewOf(EASY, [attempt('2026-10-15', 'easy', { minutes: 9 }), attempt('2026-10-18', 'easy', { minutes: 5 }), attempt('2026-11-02', 'easy', { minutes: 5 })], TODAY),
      viewOf(EASY_2, [attempt('2026-10-16', 'easy', { minutes: 12 }), attempt('2026-10-19', 'easy', { minutes: 6 })], TODAY),
      viewOf(MEDIUM, [attempt('2026-10-20', 'easy', { minutes: 22 })], TODAY),
    ]
    const shaky = [
      viewOf(EASY, [attempt('2026-10-15', 'struggled', { minutes: 28 }), attempt('2026-10-18', 'help', { minutes: 20 }), attempt('2026-10-19', 'struggled', { minutes: 14 })], TODAY),
      viewOf(MEDIUM, [attempt('2026-10-20', 'help', { minutes: 45 }), attempt('2026-10-27', 'help')], TODAY),
    ]
    const good = strengthOf(steady, { seen: 6, correct: 5 })
    const poor = strengthOf(shaky, { seen: 6, correct: 1 })
    expect(good.strength!).toBeGreaterThanOrEqual(80)
    expect(good.confidence).toBe('high')
    expect(good.weakness).toBeNull()
    expect(poor.strength!).toBeLessThan(40)
    expect(poor.weakness).not.toBeNull()
  })
})

describe('edge cases', () => {
  it('hand-checked: all four ingredients on one problem', () => {
    // ratings (0.15 + 0.6 * 1) / 1.6 = 0.46875; pace 0.5 (22.5 of 15 minutes); retention 0
    // (step 0, one revision, one lapse); drill (0 + 1) / (2 + 2) = 0.25.
    // 100 * (0.4 * 0.46875 + 0.25 * 0 + 0.2 * 0.25 + 0.15 * 0.5) = 31.25
    const view = viewOf(
      EASY,
      [attempt('2026-11-01', 'easy', { minutes: 22.5 }), attempt('2026-11-05', 'help')],
      TODAY,
    )
    const result = strengthOf([view], { seen: 2, correct: 0 })
    expect(result.parts.ratings).toBeCloseTo(0.46875)
    expect(result.parts.pace).toBeCloseTo(0.5)
    expect(result.parts.retention).toBe(0)
    expect(result.parts.drill).toBe(0.25)
    expect(result.strength).toBe(31)
  })

  it('names the heavier ingredient when two tie for lowest', () => {
    // Ratings 0.55 and drill 11/20 = 0.55 exactly.
    const view = viewOf(EASY, [attempt('2026-11-01', 'struggled')], TODAY)
    const result = strengthOf([view], { seen: 18, correct: 10 })
    expect(result.parts.drill).toBe(result.parts.ratings)
    expect(result.weakness).toBe('recent ratings average 55%')
  })

  it('does not name an ingredient that is exactly 0.6', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    const result = strengthOf([view], { seen: 3, correct: 2 })
    expect(result.parts.drill).toBe(0.6)
    expect(result.weakness).toBeNull()
  })

  it('names an ingredient under 0.6', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    expect(strengthOf([view], { seen: 8, correct: 4 }).weakness).toBe('4 of 8 drill cards right')
  })

  it('treats a second attempt on the same day as a revision, held to 60% of the target', () => {
    const view = viewOf(
      EASY,
      [attempt('2026-11-01', 'easy', { minutes: 15 }), attempt('2026-11-01', 'easy', { minutes: 9 })],
      TODAY,
    )
    // Both on target for what they are.
    expect(strengthOf([view]).parts.pace).toBe(1)
    // The same-day revision is a revision, and does not climb the ladder: 0.6 * (1 / 5) + 0.4.
    expect(strengthOf([view]).parts.retention).toBeCloseTo(0.52)
  })

  it('orders same-day attempts by when they were logged', () => {
    const first = attempt('2026-11-01', 'help')
    const second = attempt('2026-11-01', 'easy')
    const view = viewOf(EASY, [second, first], TODAY)
    expect(strengthOf([view]).parts.ratings).toBeCloseTo((1 + 0.6 * 0.15) / 1.6)
  })

  it('stays finite over a year of daily attempts on one problem', () => {
    const attempts = Array.from({ length: 365 }, (_, i) =>
      attempt(new Date(Date.UTC(2025, 10, 12 + i)).toISOString().slice(0, 10), i % 3 === 0 ? 'help' : 'easy', {
        minutes: 5 + (i % 20),
      }),
    )
    const view = viewOf(EASY, attempts, TODAY)
    const result = strengthOf([view])
    for (const value of Object.values(result.parts)) expect(value === null || Number.isFinite(value)).toBe(true)
    expect(result.parts.drill).toBeNull()
    expect(result.strength!).toBeGreaterThanOrEqual(0)
    expect(result.strength!).toBeLessThanOrEqual(100)
    expect(result.confidence).toBe('high')
    // The last attempt is index 364, an easy one, and counts most.
    expect(result.parts.ratings!).toBeGreaterThan(0.7)
  })

  it('scores a topic of mastered, quickly solved problems near the top with nothing to flag', () => {
    const mastered = (slug: string) =>
      viewOf(
        slug,
        [
          attempt('2026-09-01', 'easy', { minutes: 5 }),
          attempt('2026-09-05', 'easy', { minutes: 3 }),
          attempt('2026-09-20', 'easy', { minutes: 3 }),
          attempt('2026-11-05', 'easy', { minutes: 3 }),
        ],
        TODAY,
      )
    const result = strengthOf([mastered(EASY), mastered(EASY_2)], { seen: 10, correct: 10 })
    expect(result.parts).toMatchObject({ ratings: 1, pace: 1, retention: 1 })
    expect(result.strength).toBe(98) // drill 11/12 pulls it just under 100
    expect(result.weakness).toBeNull()
    expect(result.confidence).toBe('high')
  })

  it('scores a topic of nothing but failures at the floor of the scale, not below', () => {
    const view = viewOf(
      EASY,
      [attempt('2026-11-01', 'help', { minutes: 99 }), attempt('2026-11-05', 'help', { minutes: 99 })],
      TODAY,
    )
    const result = strengthOf([view], { seen: 50, correct: 0 })
    expect(result.strength!).toBeGreaterThanOrEqual(0)
    expect(result.strength!).toBeLessThan(15)
    expect(result.parts.pace).toBe(0)
  })

  it('does not change the views it is given', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy', { minutes: 10 }), attempt('2026-11-05', 'help')], TODAY)
    const before = JSON.stringify(view)
    strengthOf(Object.freeze([view]) as unknown as ReturnType<typeof viewOf>[], { seen: 3, correct: 1 })
    expect(JSON.stringify(view)).toBe(before)
  })

  it('is deterministic', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'struggled', { minutes: 20 })], TODAY)
    expect(strengthOf([view], { seen: 5, correct: 3 })).toEqual(strengthOf([view], { seen: 5, correct: 3 }))
  })

  it('counts an untimed topic with drill cards only toward the ingredients that exist', () => {
    const view = viewOf(EASY, [attempt('2026-11-01', 'easy')], TODAY)
    const { parts } = strengthOf([view], { seen: 4, correct: 4 })
    expect(parts.pace).toBeNull()
    expect(parts.retention).toBeNull()
  })

  it('reads a lapse count from every problem in the topic, in words up to nine and digits after', () => {
    const lapsed = (slug: string) =>
      viewOf(slug, [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'help'), attempt('2026-11-06', 'help')], TODAY)
    expect(strengthOf([lapsed(EASY), lapsed(EASY_2)]).weakness).toBe('four lapses in revision')
  })
})

describe('pace at the boundary', () => {
  const view = (minutes: number) =>
    viewOf(EASY, [attempt('2026-11-01', 'easy'), attempt('2026-11-05', 'easy', { minutes })], TODAY)

  it('scores a revision exactly on its target as 1 even where 0.6 x target is inexact in floating point', () => {
    // 0.6 * 6 is 3.5999999999999996, so a naive comparison would score 3.6 minutes just under 1.
    const targets = { easy: 6, medium: 25, hard: 40 }
    expect(topicStrength([view(3.6)], NO_DRILL, targets).parts.pace).toBe(1)
    expect(topicStrength([view(7.2)], NO_DRILL, targets).parts.pace).toBe(0)
  })

  it('scores twice the revision target as exactly 0 and one and a half times as 0.5', () => {
    expect(strengthOf([view(18)]).parts.pace).toBe(0)
    expect(strengthOf([view(13.5)]).parts.pace).toBeCloseTo(0.5)
  })
})
