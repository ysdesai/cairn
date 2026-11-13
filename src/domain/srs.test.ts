import { describe, expect, it } from 'vitest'
import type { Attempt, Rating } from '../state/schema'
import { addDays } from './dates'
import { mulberry32, shuffle } from './rng'
import {
  EASE_DELTA,
  EASE_MAX,
  EASE_MIN,
  EASE_START,
  intervalFor,
  LADDER,
  preview,
  replay,
  sortAttempts,
  statusOf,
} from './srs'
import { attempt } from './testing'
import type { SrsState } from './types'

const START = '2026-11-01'
const day = (n: number) => addDays(START, n)

type Step = [offset: number, rating: Rating]

/** Replay attempts given as [day offset, rating] pairs, logged in the order given. */
const run = (...steps: Step[]): SrsState => {
  const state = replay(steps.map(([n, rating]) => attempt(day(n), rating)))
  if (!state) throw new Error('no attempts')
  return state
}

describe('ladder constants', () => {
  it('uses the documented ladder, ease range and deltas', () => {
    expect(LADDER).toEqual([1, 3, 7, 21, 45])
    expect(EASE_START).toBe(1)
    expect(EASE_MIN).toBe(0.7)
    expect(EASE_MAX).toBe(1.5)
    expect(EASE_DELTA).toEqual({ easy: 0.1, struggled: -0.05, help: -0.15 })
  })
})

describe('intervalFor', () => {
  it('is always one day on step 0, whatever the ease', () => {
    expect(intervalFor(0, 0.7)).toBe(1)
    expect(intervalFor(0, 1.5)).toBe(1)
  })

  it('scales the rung by the ease and rounds', () => {
    expect(intervalFor(1, 1)).toBe(3)
    expect(intervalFor(1, 1.1)).toBe(3)
    expect(intervalFor(2, 1.05)).toBe(7)
    expect(intervalFor(3, 1.2)).toBe(25)
    expect(intervalFor(4, 1.15)).toBe(52)
    expect(intervalFor(4, 1.5)).toBe(68)
  })

  it('rounds halves up even where floating point lands just below', () => {
    // 45 * 0.7 is 31.499999999999996 as a float.
    expect(intervalFor(4, 0.7)).toBe(32)
    expect(intervalFor(2, 0.75)).toBe(5)
    expect(intervalFor(1, 1.5)).toBe(5)
  })

  it('never goes below one day', () => {
    expect(intervalFor(1, 0.1)).toBe(1)
  })

  it('is null once the ladder is cleared', () => {
    expect(intervalFor(LADDER.length, 1)).toBeNull()
    expect(intervalFor(LADDER.length + 3, 1)).toBeNull()
  })

  it('treats a negative step like step 0', () => {
    expect(intervalFor(-1, 1.2)).toBe(1)
  })
})

describe('sortAttempts', () => {
  it('orders by date, then by time logged', () => {
    const a = attempt('2026-11-05', 'easy', { at: 50 })
    const b = attempt('2026-11-03', 'easy', { at: 90 })
    const c = attempt('2026-11-05', 'easy', { at: 10 })
    expect(sortAttempts([a, b, c])).toEqual([b, c, a])
  })

  it('returns a new array and leaves the input alone', () => {
    const input = [attempt('2026-11-05', 'easy'), attempt('2026-11-03', 'easy')]
    const copy = [...input]
    const out = sortAttempts(input)
    expect(out).not.toBe(input)
    expect(input).toEqual(copy)
  })

  it('handles empty input', () => {
    expect(sortAttempts([])).toEqual([])
  })
})

describe('replay: first solve', () => {
  it('is null with no attempts', () => {
    expect(replay([])).toBeNull()
  })

  it('Easy clears the first rung', () => {
    expect(run([0, 'easy'])).toEqual({
      step: 1,
      ease: 1.1,
      interval: 3,
      due: day(3),
      mastered: false,
      lapses: 0,
      reviews: 0,
      firstOn: day(0),
      lastOn: day(0),
      lastRating: 'easy',
    })
  })

  it('Struggled stays on step 0 but comes back in two days, between Needed help and Easy', () => {
    expect(run([0, 'struggled'])).toMatchObject({ step: 0, ease: 0.95, interval: 2, due: day(2), lapses: 0, reviews: 0 })
    const gaps = (['help', 'struggled', 'easy'] as const).map((r) => run([0, r]).interval)
    expect(gaps).toEqual([1, 2, 3])
  })

  it('Needed help stays on step 0 and is not yet a lapse', () => {
    expect(run([0, 'help'])).toMatchObject({ step: 0, ease: 0.85, interval: 1, due: day(1), lapses: 0, lastRating: 'help' })
  })
})

describe('replay: revisions', () => {
  it('Easy moves two rungs, Struggled one, Needed help back to the start', () => {
    // After a Struggled solve on day 0 (step 0, ease 0.95, due day 2), revised on its due day.
    expect(run([0, 'struggled'], [2, 'easy'])).toMatchObject({ step: 2, ease: 1.05, interval: 7, due: day(9), reviews: 1 })
    expect(run([0, 'struggled'], [2, 'struggled'])).toMatchObject({ step: 1, ease: 0.9, interval: 3, due: day(5), reviews: 1 })
    expect(run([0, 'struggled'], [2, 'help'])).toMatchObject({
      step: 0,
      ease: 0.8,
      interval: 1,
      due: day(3),
      lapses: 1,
      reviews: 1,
    })
  })

  it('works from a higher rung', () => {
    // Easy solve: step 1, ease 1.1, due day 3.
    expect(run([0, 'easy'], [3, 'easy'])).toMatchObject({ step: 3, ease: 1.2, interval: 25, due: day(28) })
    expect(run([0, 'easy'], [3, 'struggled'])).toMatchObject({ step: 2, ease: 1.05, interval: 7, due: day(10) })
    expect(run([0, 'easy'], [3, 'help'])).toMatchObject({ step: 0, ease: 0.95, interval: 1, due: day(4), lapses: 1 })
  })

  it('counts every revision and tracks the first and last dates', () => {
    const state = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'])
    expect(state).toMatchObject({ reviews: 2, firstOn: day(0), lastOn: day(10), lastRating: 'struggled' })
  })

  it('counts a lapse for every Needed help revision but not for the solve', () => {
    const state = run([0, 'help'], [1, 'help'], [2, 'help'], [3, 'easy'])
    expect(state.lapses).toBe(2)
    expect(state.reviews).toBe(3)
  })

  it('schedules from the day of the attempt, not from the old due date', () => {
    // Revised on the due day: the next interval counts from that day.
    expect(run([0, 'easy'], [3, 'struggled']).due).toBe(day(3 + 7))
    // And revised late: from the late day.
    expect(run([0, 'easy'], [4, 'struggled']).due).toBe(day(4 + 7))
    // Revised early it is practice: the old due date stands.
    expect(run([0, 'easy'], [1, 'struggled']).due).toBe(day(3))
  })

  it('lets a Needed help revision reset a problem that was far up the ladder', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'struggled'], [80, 'help'])
    expect(state).toMatchObject({ step: 0, interval: 1, due: day(81), lapses: 1, mastered: false })
  })
})

describe('replay: same-day attempts', () => {
  it('cannot climb the ladder', () => {
    const solved = run([0, 'easy'])
    const again = run([0, 'easy'], [0, 'easy'])
    expect(again.step).toBe(solved.step)
    expect(again.due).toBe(solved.due)
    expect(again.interval).toBe(solved.interval)
    expect(again.reviews).toBe(1)
    expect(again.lastRating).toBe('easy')
  })

  it('cannot master a problem in one sitting', () => {
    const state = run([0, 'easy'], [0, 'easy'], [0, 'easy'], [0, 'easy'], [0, 'easy'], [0, 'easy'])
    expect(state.step).toBe(1)
    expect(state.mastered).toBe(false)
    expect(state.due).toBe(day(3))
    expect(state.reviews).toBe(5)
  })

  it('does not climb on Struggled either', () => {
    const state = run([0, 'struggled'], [0, 'struggled'], [0, 'struggled'])
    expect(state).toMatchObject({ step: 0, due: day(2), reviews: 2 })
  })

  it('does not let a same-day Easy rescue a step 0 solve', () => {
    expect(run([0, 'help'], [0, 'easy'])).toMatchObject({ step: 0, due: day(1) })
  })

  it('still resets on Needed help, and that counts as a lapse', () => {
    const state = run([0, 'easy'], [0, 'help'])
    expect(state).toMatchObject({ step: 0, interval: 1, due: day(1), lapses: 1, ease: 0.95 })
  })

  it('does not move the ease on a same-day Easy, so repeats cannot inflate it', () => {
    // Departs from the header ("moves with every attempt") on purpose: a same-day repeat is practice.
    expect(run([0, 'easy'], [0, 'easy'], [0, 'easy']).ease).toBe(1.1)
  })

  it('measures the wait from the latest attempt and the interval from the schedule that stands', () => {
    // Solved and repeated on day 0 (interval 3), revised on day 6 = twice the interval: the bonus applies.
    expect(run([0, 'easy'], [0, 'easy'], [6, 'easy']).step).toBe(4)
    // Struggled revision on day 4 gives step 2 (interval 7, due day 11); the Easy repeat that day
    // changes nothing, so day 11 is only 7 days of a 14-day wait: on time, no bonus.
    expect(run([0, 'easy'], [4, 'struggled'], [4, 'easy'], [11, 'easy'])).toMatchObject({ step: 4, interval: 52, due: day(63) })
  })

  it('keeps a mastered problem mastered', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'], [28, 'easy'])
    expect(state).toMatchObject({ mastered: true, step: 5, due: null, interval: null })
  })

  it('treats an attempt on the due date as a normal revision', () => {
    expect(run([0, 'struggled'], [0, 'easy'], [2, 'easy'])).toMatchObject({ step: 2, due: day(9) })
  })

  it('orders same-date attempts by time logged, not by array order', () => {
    const early = attempt(day(0), 'easy', { at: 1 })
    const late = attempt(day(0), 'help', { at: 2 })
    const helpLast = replay([late, early])
    expect(helpLast).toMatchObject({ step: 0, lapses: 1, lastRating: 'help' })
    // Swap the times and the outcome follows the times.
    const swapped = replay([{ ...early, at: 3 }, late])
    expect(swapped).toMatchObject({ step: 0, lapses: 0, lastRating: 'easy', firstOn: day(0) })
    expect(swapped?.reviews).toBe(1)
  })
})

describe('replay: revising before the due date', () => {
  it('cannot cram a problem to mastered on consecutive days', () => {
    // Easy on days 1 and 2 are both before the day-3 due date: still on the first rung.
    const state = run([0, 'easy'], [1, 'easy'], [2, 'easy'])
    expect(state).toMatchObject({ step: 1, mastered: false, due: day(3), reviews: 2 })
    // Six Struggled attempts on six consecutive days: day 1 is early, day 2 is on time (step 1),
    // then every later day is early again.
    const grind = run([0, 'struggled'], [1, 'struggled'], [2, 'struggled'], [3, 'struggled'], [4, 'struggled'], [5, 'struggled'])
    expect(grind.mastered).toBe(false)
    expect(grind.step).toBeLessThanOrEqual(2)
  })

  it('keeps the due date and climbs no rung, even on Easy', () => {
    const state = run([0, 'easy'], [1, 'easy'])
    expect(state).toMatchObject({ step: 1, due: day(3), ease: 1.1, lastOn: day(1), reviews: 1, lastRating: 'easy' })
  })

  it('keeps due minus the last attempt equal to the interval', () => {
    const state = run([0, 'easy'], [1, 'easy'])
    expect(state.interval).toBe(2)
    expect(addDays(state.lastOn, state.interval!)).toBe(state.due)
  })

  it('still lets a Struggled revision lower the ease', () => {
    expect(run([0, 'easy'], [1, 'struggled'])).toMatchObject({ step: 1, ease: 1.05, due: day(3) })
  })

  it('still resets on Needed help, which counts as a lapse', () => {
    expect(run([0, 'easy'], [1, 'help'])).toMatchObject({ step: 0, interval: 1, due: day(2), lapses: 1 })
  })

  it('counts in full on the due date, and the ladder goes on from there', () => {
    expect(run([0, 'easy'], [1, 'easy'], [3, 'easy'])).toMatchObject({ step: 3, due: day(3 + 25) })
  })

  it('does not apply to a mastered problem, which has no due date', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'], [29, 'easy'])
    expect(state).toMatchObject({ mastered: true, step: 5, due: null })
  })

  it('is shown by the preview: an early Easy keeps the rung and the date', () => {
    const state = run([0, 'easy'], [3, 'easy'])
    expect(preview(state, 'easy', day(5))).toEqual({ step: 3, interval: 23, due: day(28), mastered: false })
    expect(preview(state, 'easy', day(28))).toMatchObject({ step: 5, mastered: true })
  })
})

describe('replay: patience bonus', () => {
  it('gives an Easy revision one extra rung after waiting twice the interval', () => {
    // Interval after an Easy solve is 3 days; day 6 is exactly twice that.
    expect(run([0, 'easy'], [6, 'easy'])).toMatchObject({ step: 4, ease: 1.2, interval: 54, due: day(60) })
  })

  it('does not apply one day short of twice the interval', () => {
    expect(run([0, 'easy'], [5, 'easy']).step).toBe(3)
  })

  it('applies for any wait beyond twice the interval', () => {
    expect(run([0, 'easy'], [60, 'easy']).step).toBe(4)
  })

  it('does not apply when the revision is on time', () => {
    expect(run([0, 'easy'], [3, 'easy']).step).toBe(3)
    expect(run([0, 'easy'], [4, 'easy']).step).toBe(3)
  })

  it('only applies to Easy', () => {
    expect(run([0, 'easy'], [60, 'struggled']).step).toBe(2)
    expect(run([0, 'easy'], [60, 'help']).step).toBe(0)
  })

  it('compares against the planned interval, which includes the ease', () => {
    // Three Struggled attempts: step 2, ease 0.85, so the interval is round(7 * 0.85) = 6, not 7.
    // Twice that is 12 days; an unscaled 7 would have needed 14.
    const base: Step[] = [
      [0, 'struggled'],
      [2, 'struggled'],
      [5, 'struggled'],
    ]
    expect(run(...base)).toMatchObject({ step: 2, ease: 0.85, interval: 6 })
    expect(run(...base, [5 + 11, 'easy']).step).toBe(4)
    expect(run(...base, [5 + 12, 'easy']).step).toBe(5)
    // The same wait with a bigger ease: Easy then Struggled gives step 2, ease 1.05, interval 7.
    const shorter: Step[] = [
      [0, 'easy'],
      [3, 'struggled'],
    ]
    expect(run(...shorter, [3 + 13, 'easy']).step).toBe(4)
    expect(run(...shorter, [3 + 14, 'easy']).step).toBe(5)
  })

  it('applies on step 0 too, where the interval is a single day', () => {
    // Needed help on the solve, interval 1: Easy two days later earns the bonus (0 + 2 + 1).
    expect(run([0, 'help'], [2, 'easy']).step).toBe(3)
    expect(run([0, 'help'], [1, 'easy']).step).toBe(2)
    // A Struggled solve waits two days, so the bonus needs four.
    expect(run([0, 'struggled'], [4, 'easy']).step).toBe(3)
    expect(run([0, 'struggled'], [3, 'easy']).step).toBe(2)
  })

  it('lets a backlog held back by the cap drain quickly', () => {
    // A problem left overdue for a month climbs three rungs from step 1 in one revision.
    expect(run([0, 'struggled'], [2, 'easy'], [30, 'easy']).step).toBe(5)
  })

  it('cannot push past the top of the ladder', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'struggled'], [200, 'easy'])
    expect(state.step).toBe(LADDER.length)
    expect(state.mastered).toBe(true)
  })

  it('is judged against the previous attempt, so an in-between help resets the wait', () => {
    // help on day 20 sets a 1-day interval; Easy on day 21 is on time.
    expect(run([0, 'easy'], [20, 'help'], [21, 'easy']).step).toBe(2)
  })
})

describe('replay: ease', () => {
  it('moves with every attempt', () => {
    expect(run([0, 'easy']).ease).toBe(1.1)
    expect(run([0, 'easy'], [3, 'struggled']).ease).toBe(1.05)
    expect(run([0, 'easy'], [3, 'struggled'], [10, 'help']).ease).toBe(0.9)
  })

  it('is clamped at 1.5 and stays there', () => {
    const eases: number[] = []
    const steps: Step[] = [[0, 'easy']]
    for (let i = 1; i <= 8; i++) {
      steps.push([i * 100, 'easy'])
      eases.push(run(...steps).ease)
    }
    expect(eases).toEqual([1.2, 1.3, 1.4, 1.5, 1.5, 1.5, 1.5, 1.5])
  })

  it('is clamped at 0.7 and stays there', () => {
    const eases: number[] = []
    const steps: Step[] = [[0, 'help']]
    for (let i = 1; i <= 6; i++) {
      steps.push([i, 'help'])
      eases.push(run(...steps).ease)
    }
    expect(eases).toEqual([0.7, 0.7, 0.7, 0.7, 0.7, 0.7])
    expect(run([0, 'help']).ease).toBe(0.85)
  })

  it('clamps a Struggled attempt that would dip under the floor', () => {
    // 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, then clamped.
    const steps: Step[] = [[0, 'struggled']]
    for (let i = 1; i <= 6; i++) steps.push([i * 10, 'struggled'])
    expect(run(...steps).ease).toBe(0.7)
  })

  it('does not accumulate floating point error', () => {
    const state = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'], [31, 'easy'], [60, 'help'], [61, 'struggled'])
    expect(state.ease).toBe(Math.round(state.ease * 100) / 100)
    expect(state.ease).toBe(0.9)
  })

  it('stays inside the range for any rating sequence', () => {
    const rng = mulberry32(7)
    const ratings: Rating[] = ['easy', 'struggled', 'help']
    for (let trial = 0; trial < 40; trial++) {
      const steps: Step[] = []
      let when = 0
      for (let i = 0; i < 25; i++) {
        when += Math.floor(rng() * 40)
        steps.push([when, ratings[Math.floor(rng() * 3)]])
      }
      const state = run(...steps)
      expect(state.ease).toBeGreaterThanOrEqual(EASE_MIN)
      expect(state.ease).toBeLessThanOrEqual(EASE_MAX)
    }
  })

  it('stretches the intervals when it is high and shortens them when it is low', () => {
    // Step 4 after Easy, Easy, Struggled: ease 1.15, so 45 * 1.15.
    expect(run([0, 'easy'], [3, 'easy'], [28, 'struggled'])).toMatchObject({ step: 4, ease: 1.15, interval: 52 })
    // Step 4 with ease at its floor: 45 * 0.7 = 31.5, rounded up.
    const lowSteps: Step[] = [[0, 'struggled']]
    for (let i = 1; i <= 4; i++) lowSteps.push([i * 60, 'struggled'])
    expect(run(...lowSteps)).toMatchObject({ step: 4, ease: 0.75, interval: 34 })
    lowSteps.length = 0
    lowSteps.push([0, 'help'], [60, 'struggled'], [120, 'struggled'], [180, 'struggled'], [240, 'struggled'])
    expect(run(...lowSteps)).toMatchObject({ step: 4, ease: 0.7, interval: 32 })
  })
})

describe('replay: mastery', () => {
  it('is reached by clearing the fifth rung', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'])
    expect(state).toMatchObject({ step: 5, mastered: true, interval: null, due: null, reviews: 2 })
  })

  it('can be reached one rung at a time', () => {
    const steps: Step[] = [[0, 'struggled']]
    for (let i = 1; i <= 4; i++) steps.push([i * 60, 'struggled'])
    expect(run(...steps).mastered).toBe(false)
    steps.push([300, 'struggled'])
    expect(run(...steps)).toMatchObject({ step: 5, mastered: true, due: null, interval: null })
  })

  it('does not overshoot the ladder on a double step', () => {
    const state = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'], [31, 'struggled'], [76, 'easy'])
    expect(state.step).toBe(LADDER.length)
  })

  it('keeps a mastered problem mastered through further Easy and Struggled attempts', () => {
    const base: Step[] = [
      [0, 'easy'],
      [3, 'easy'],
      [28, 'easy'],
    ]
    const easy = run(...base, [100, 'easy'])
    expect(easy).toMatchObject({ mastered: true, step: 5, due: null, interval: null, reviews: 3, ease: 1.4 })
    const struggled = run(...base, [100, 'struggled'])
    expect(struggled).toMatchObject({ mastered: true, step: 5, due: null, interval: null, ease: 1.25 })
  })

  it('returns to rotation after a lapse', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'], [100, 'help'])
    expect(state).toMatchObject({ mastered: false, step: 0, interval: 1, due: day(101), lapses: 1, ease: 1.15 })
  })

  it('climbs the ladder again after the lapse and can be mastered again', () => {
    const lapsed: Step[] = [
      [0, 'easy'],
      [3, 'easy'],
      [28, 'easy'],
      [100, 'help'],
    ]
    // Step 0, ease 1.15: Easy the next day gives step 2, ease 1.25, interval round(7 * 1.25) = 9.
    expect(run(...lapsed, [101, 'easy'])).toMatchObject({ step: 2, interval: 9, mastered: false, lapses: 1 })
    expect(run(...lapsed, [101, 'easy'], [111, 'easy'])).toMatchObject({ step: 4, mastered: false })
    expect(run(...lapsed, [101, 'easy'], [111, 'easy'], [180, 'easy'])).toMatchObject({
      step: 5,
      mastered: true,
      lapses: 1,
      due: null,
    })
  })

  it('treats a same-day Needed help after mastering as a lapse too', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'], [28, 'help'])
    expect(state).toMatchObject({ mastered: false, step: 0, due: day(29), lapses: 1 })
  })
})

describe('replay: input handling', () => {
  const history: Step[] = [
    [0, 'easy'],
    [3, 'struggled'],
    [10, 'help'],
    [11, 'easy'],
    [30, 'easy'],
  ]

  it('gives the same answer for any input order', () => {
    const attempts = history.map(([n, rating]) => attempt(day(n), rating))
    const expected = replay(attempts)
    const rng = mulberry32(99)
    for (let i = 0; i < 20; i++) expect(replay(shuffle(rng, attempts))).toEqual(expected)
  })

  it('does not reorder or modify the array it is given', () => {
    const attempts: Attempt[] = [attempt(day(5), 'easy'), attempt(day(0), 'easy')]
    const snapshot = JSON.parse(JSON.stringify(attempts))
    replay(attempts)
    expect(attempts).toEqual(snapshot)
    expect(attempts[0].date).toBe(day(5))
  })

  it('is stable when an attempt is backdated before the others', () => {
    const attempts = [attempt(day(10), 'easy'), attempt(day(14), 'easy')]
    const before = replay(attempts)
    // A new first attempt dated earlier turns the old first one into a revision.
    const after = replay([...attempts, attempt(day(0), 'struggled')])
    expect(before).toMatchObject({ firstOn: day(10), reviews: 1 })
    expect(after).toMatchObject({ firstOn: day(0), reviews: 2 })
  })

  it('forgets a deleted attempt completely', () => {
    const all = history.map(([n, rating]) => attempt(day(n), rating))
    const withoutHelp = all.filter((a) => a.rating !== 'help')
    expect(replay(withoutHelp)?.lapses).toBe(0)
    expect(replay(all)?.lapses).toBe(1)
    expect(replay(withoutHelp)).toEqual(
      run([0, 'easy'], [3, 'struggled'], [11, 'easy'], [30, 'easy']),
    )
  })

  it('accepts a single attempt dated before the start of any plan', () => {
    expect(replay([attempt('2020-01-01', 'easy')])).toMatchObject({ step: 1, due: '2020-01-04' })
  })
})

describe('replay: realistic histories', () => {
  it('follows a steady learner through to mastery', () => {
    // Easy, then every revision exactly when due.
    const second = run([0, 'easy'], [3, 'struggled'])
    expect(second).toMatchObject({ step: 2, ease: 1.05, interval: 7, due: day(10) })
    const third = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'])
    expect(third).toMatchObject({ step: 3, ease: 1, interval: 21, due: day(31) })
    const fourth = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'], [31, 'struggled'])
    expect(fourth).toMatchObject({ step: 4, ease: 0.95, interval: 43, due: day(74) })
    const fifth = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'], [31, 'struggled'], [74, 'struggled'])
    expect(fifth).toMatchObject({ step: 5, mastered: true, due: null, reviews: 4, lapses: 0 })
  })

  it('recovers from a lapse mid-way', () => {
    const state = run([0, 'easy'], [3, 'struggled'], [10, 'struggled'], [31, 'help'], [32, 'easy'], [39, 'easy'])
    // Ease: 1.1, 1.05, 1.0, 0.85 (help resets to step 0), 0.95 (easy: step 2), 1.05 (easy: step 4).
    expect(state).toMatchObject({ step: 4, ease: 1.05, interval: 47, due: day(86), lapses: 1, reviews: 5 })
  })

  it('lets a patient final revision master the problem', () => {
    const base: Step[] = [
      [0, 'easy'],
      [3, 'struggled'],
      [10, 'struggled'],
      [31, 'help'],
      [32, 'easy'],
    ]
    // Step 2, ease 0.95, interval 7 so patience needs 14 days.
    expect(run(...base, [45, 'easy']).step).toBe(4)
    expect(run(...base, [46, 'easy'])).toMatchObject({ step: 5, mastered: true })
  })
})

describe('replay: calendar edges', () => {
  it('counts the leap day when scheduling', () => {
    expect(replay([attempt('2028-02-27', 'easy')])?.due).toBe('2028-03-01')
    expect(replay([attempt('2027-02-27', 'easy')])?.due).toBe('2027-03-02')
  })

  it('schedules across a year end', () => {
    expect(replay([attempt('2026-12-30', 'easy')])?.due).toBe('2027-01-02')
  })

  it('schedules across a daylight-saving change', () => {
    expect(replay([attempt('2026-03-07', 'easy')])?.due).toBe('2026-03-10')
    expect(replay([attempt('2026-10-30', 'easy')])?.due).toBe('2026-11-02')
  })

  it('treats two attempts years apart as one long wait', () => {
    const state = replay([attempt('2022-01-01', 'easy'), attempt('2026-01-01', 'easy')])
    expect(state).toMatchObject({ step: 4, reviews: 1, lastOn: '2026-01-01' })
  })
})

describe('preview', () => {
  it('shows a first solve when there is no state', () => {
    expect(preview(null, 'easy', day(0))).toEqual({ step: 1, interval: 3, due: day(3), mastered: false })
    expect(preview(null, 'struggled', day(0))).toEqual({ step: 0, interval: 2, due: day(2), mastered: false })
    expect(preview(null, 'help', day(0))).toEqual({ step: 0, interval: 1, due: day(1), mastered: false })
  })

  it('shows what a revision would do', () => {
    const state = run([0, 'easy'])
    expect(preview(state, 'easy', day(3))).toEqual({ step: 3, interval: 25, due: day(28), mastered: false })
    expect(preview(state, 'struggled', day(3))).toEqual({ step: 2, interval: 7, due: day(10), mastered: false })
    expect(preview(state, 'help', day(3))).toEqual({ step: 0, interval: 1, due: day(4), mastered: false })
  })

  it('shows mastery with no due date', () => {
    const state = run([0, 'easy'], [3, 'easy'])
    expect(preview(state, 'easy', day(28))).toEqual({ step: 5, interval: null, due: null, mastered: true })
  })

  it('includes the patience bonus', () => {
    const state = run([0, 'easy'])
    expect(preview(state, 'easy', day(6)).step).toBe(4)
    expect(preview(state, 'easy', day(5)).step).toBe(3)
  })

  it('shows no climb for a same-day repeat', () => {
    const state = run([0, 'easy'])
    expect(preview(state, 'easy', day(0))).toEqual({ step: 1, interval: 3, due: day(3), mastered: false })
    expect(preview(state, 'help', day(0))).toMatchObject({ step: 0, due: day(1) })
  })

  it('shows a lapse from a mastered problem', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'])
    expect(preview(state, 'help', day(40))).toEqual({ step: 0, interval: 1, due: day(41), mastered: false })
  })

  it('treats a date before the latest attempt as that attempt\'s date', () => {
    const state = run([0, 'easy'], [3, 'easy'])
    expect(preview(state, 'struggled', day(1))).toEqual(preview(state, 'struggled', day(3)))
    expect(preview(state, 'easy', day(-30))).toEqual(preview(state, 'easy', day(3)))
  })

  it('does not change the state it is given', () => {
    const state = run([0, 'easy'], [3, 'struggled'])
    const snapshot = JSON.parse(JSON.stringify(state))
    preview(state, 'help', day(10))
    preview(state, 'easy', day(10))
    expect(state).toEqual(snapshot)
  })

  it('agrees with replaying the attempt once it is logged', () => {
    const rng = mulberry32(2026)
    const ratings: Rating[] = ['easy', 'struggled', 'help']
    for (let trial = 0; trial < 60; trial++) {
      const attempts: Attempt[] = []
      let when = 0
      const length = Math.floor(rng() * 8)
      for (let i = 0; i < length; i++) {
        // A zero gap makes same-day attempts common.
        when += Math.floor(rng() * 3) === 0 ? 0 : Math.floor(rng() * 50)
        attempts.push(attempt(day(when), ratings[Math.floor(rng() * 3)]))
      }
      const state = replay(attempts)
      for (const rating of ratings) {
        for (const gap of [0, 1, 2, 7, 90]) {
          const on = day(when + gap)
          const shown = preview(state, rating, on)
          const logged = replay([...attempts, attempt(on, rating)])
          expect(logged).not.toBeNull()
          expect(shown).toEqual({
            step: logged!.step,
            interval: logged!.interval,
            due: logged!.due,
            mastered: logged!.mastered,
          })
        }
      }
    }
  })
})

describe('statusOf', () => {
  const today = day(10)

  it('is todo with no schedule', () => {
    expect(statusOf(null, today)).toBe('todo')
  })

  it('is learning while the due date is ahead', () => {
    expect(statusOf(run([0, 'easy'], [8, 'struggled']), today)).toBe('learning')
  })

  it('is due on the due date and after it', () => {
    const state = run([0, 'easy'])
    expect(statusOf(state, day(2))).toBe('learning')
    expect(statusOf(state, day(3))).toBe('due')
    expect(statusOf(state, day(300))).toBe('due')
  })

  it('is mastered with no due date, whatever the day', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'])
    expect(statusOf(state, day(0))).toBe('mastered')
    expect(statusOf(state, day(1000))).toBe('mastered')
  })

  it('is due again after a lapse on a mastered problem', () => {
    const state = run([0, 'easy'], [3, 'easy'], [28, 'easy'], [100, 'help'])
    expect(statusOf(state, day(100))).toBe('learning')
    expect(statusOf(state, day(101))).toBe('due')
  })

  it('is not due before the first attempt even happened', () => {
    // History dated in the future relative to today.
    expect(statusOf(run([20, 'easy']), today)).toBe('learning')
  })
})
