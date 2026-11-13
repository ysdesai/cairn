import { describe, expect, it } from 'vitest'
import { getProblem } from '../data'
import { EMPTY_NOTES } from '../state/schema'
import { addDays, diffDays } from './dates'
import { hasNotes, viewProblem } from './problemView'
import { attempt, record, viewOf } from './testing'

const TODAY = '2026-11-12'
const day = (n: number) => addDays(TODAY, n)
const SLUG = 'two-sum'

describe('hasNotes', () => {
  it('is false without a record', () => {
    expect(hasNotes(null)).toBe(false)
  })

  it('is false for empty notes', () => {
    expect(hasNotes(record([]))).toBe(false)
  })

  it('is true when any one field has text', () => {
    for (const field of ['insight', 'time', 'space', 'pitfalls'] as const) {
      expect(hasNotes(record([], { [field]: 'x' }))).toBe(true)
    }
  })

  it('ignores blank and whitespace-only fields', () => {
    expect(hasNotes(record([], { insight: '   ', time: '\n\t', space: ' ', pitfalls: '' }))).toBe(false)
  })

  it('ignores the update time on its own', () => {
    expect(hasNotes(record([], { updatedAt: 1_700_000_000_000 }))).toBe(false)
  })

  it('counts text with surrounding whitespace', () => {
    expect(hasNotes(record([], { time: '  O(n)  ' }))).toBe(true)
  })
})

describe('viewProblem: untouched problem', () => {
  it('is todo with nothing derived', () => {
    const view = viewOf(SLUG, [], TODAY)
    expect(view).toMatchObject({
      record: null,
      attempts: [],
      status: 'todo',
      solved: false,
      srs: null,
      dueIn: null,
      hasNotes: false,
      lastMinutes: null,
      bestMinutes: null,
      mistakes: [],
      touchedToday: false,
    })
    expect(view.problem).toBe(getProblem(SLUG))
  })

  it('stays todo with a record that holds only notes', () => {
    const view = viewOf(SLUG, [], TODAY, { insight: 'hash map of complements' })
    expect(view.record).not.toBeNull()
    expect(view).toMatchObject({ status: 'todo', solved: false, srs: null, dueIn: null, hasNotes: true })
  })

  it('handles a stored record with no attempts and empty notes', () => {
    const problem = getProblem(SLUG)!
    const view = viewProblem(problem, { attempts: [], notes: { ...EMPTY_NOTES } }, TODAY)
    expect(view).toMatchObject({ status: 'todo', solved: false, hasNotes: false })
    expect(view.record).not.toBeNull()
  })
})

describe('viewProblem: status and dueIn', () => {
  it('is learning with a positive dueIn while the revision is ahead', () => {
    // Easy yesterday: interval 3, due in 2 days.
    const view = viewOf(SLUG, [attempt(day(-1), 'easy')], TODAY)
    expect(view).toMatchObject({ status: 'learning', solved: true, dueIn: 2 })
    expect(view.srs?.due).toBe(day(2))
  })

  it('is due with dueIn 0 on the due date', () => {
    const view = viewOf(SLUG, [attempt(day(-3), 'easy')], TODAY)
    expect(view).toMatchObject({ status: 'due', dueIn: 0 })
  })

  it('is due with a negative dueIn once overdue', () => {
    const view = viewOf(SLUG, [attempt(day(-10), 'easy')], TODAY)
    expect(view).toMatchObject({ status: 'due', dueIn: -7 })
  })

  it('is mastered with no dueIn once the ladder is cleared', () => {
    const view = viewOf(SLUG, [attempt(day(-40), 'easy'), attempt(day(-37), 'easy'), attempt(day(-12), 'easy')], TODAY)
    expect(view).toMatchObject({ status: 'mastered', solved: true, dueIn: null })
    expect(view.srs).toMatchObject({ mastered: true, due: null })
  })

  it('returns a lapsed mastered problem to rotation', () => {
    const view = viewOf(
      SLUG,
      [attempt(day(-40), 'easy'), attempt(day(-37), 'easy'), attempt(day(-12), 'easy'), attempt(day(-1), 'help')],
      TODAY,
    )
    expect(view).toMatchObject({ status: 'due', dueIn: 0 })
  })

  it('depends on today', () => {
    const attempts = [attempt('2026-11-01', 'easy')]
    expect(viewOf(SLUG, attempts, '2026-11-03').status).toBe('learning')
    expect(viewOf(SLUG, attempts, '2026-11-04').status).toBe('due')
  })

  it('treats history dated after today as solved and not yet due', () => {
    const view = viewOf(SLUG, [attempt(day(5), 'easy')], TODAY)
    expect(view).toMatchObject({ status: 'learning', solved: true, dueIn: 8, touchedToday: false })
  })

  it('exposes the replayed schedule', () => {
    const view = viewOf(SLUG, [attempt(day(-20), 'easy'), attempt(day(-17), 'struggled')], TODAY)
    expect(view.srs).toMatchObject({ step: 2, reviews: 1, firstOn: day(-20), lastOn: day(-17), interval: 7 })
    expect(view.dueIn).toBe(-10)
  })
})

describe('viewProblem: attempts', () => {
  it('orders attempts by date, then time logged', () => {
    const late = attempt(day(-1), 'easy')
    const early = attempt(day(-5), 'struggled')
    const sameDayFirst = attempt(day(-1), 'help', { at: late.at - 100 })
    const view = viewOf(SLUG, [late, early, sameDayFirst], TODAY)
    expect(view.attempts).toEqual([early, sameDayFirst, late])
  })

  it('does not reorder the stored record', () => {
    const stored = [attempt(day(-1), 'easy'), attempt(day(-5), 'struggled')]
    const rec = record(stored)
    viewProblem(getProblem(SLUG)!, rec, TODAY)
    expect(rec.attempts[0].date).toBe(day(-1))
    expect(rec.attempts).toHaveLength(2)
  })

  it('keeps the stored record on the view', () => {
    const rec = record([attempt(day(-1), 'easy')], { insight: 'note' })
    expect(viewProblem(getProblem(SLUG)!, rec, TODAY).record).toBe(rec)
  })

  it('gives the same view whatever order the attempts were stored in', () => {
    const a = attempt(day(-9), 'easy')
    const b = attempt(day(-6), 'struggled')
    const c = attempt(day(-6), 'help')
    expect(viewOf(SLUG, [c, a, b], TODAY).srs).toEqual(viewOf(SLUG, [a, b, c], TODAY).srs)
  })
})

describe('viewProblem: minutes', () => {
  it('is null when no attempt was timed', () => {
    const view = viewOf(SLUG, [attempt(day(-5), 'easy'), attempt(day(-2), 'easy')], TODAY)
    expect(view.lastMinutes).toBeNull()
    expect(view.bestMinutes).toBeNull()
  })

  it('takes the most recent timed attempt as last and the fastest as best', () => {
    const view = viewOf(
      SLUG,
      [
        attempt(day(-30), 'easy', { minutes: 30 }),
        attempt(day(-20), 'struggled', { minutes: 12 }),
        attempt(day(-10), 'easy', { minutes: 18 }),
      ],
      TODAY,
    )
    expect(view.lastMinutes).toBe(18)
    expect(view.bestMinutes).toBe(12)
  })

  it('skips untimed attempts when finding the last timed one', () => {
    const view = viewOf(
      SLUG,
      [attempt(day(-20), 'easy', { minutes: 25 }), attempt(day(-10), 'easy', { minutes: null })],
      TODAY,
    )
    expect(view.lastMinutes).toBe(25)
    expect(view.bestMinutes).toBe(25)
  })

  it('uses chronological order, not storage order, for the last attempt', () => {
    const view = viewOf(
      SLUG,
      [attempt(day(-2), 'easy', { minutes: 9 }), attempt(day(-20), 'easy', { minutes: 40 })],
      TODAY,
    )
    expect(view.lastMinutes).toBe(9)
  })

  it('counts a zero as a timed attempt', () => {
    const view = viewOf(SLUG, [attempt(day(-3), 'easy', { minutes: 0 }), attempt(day(-1), 'easy', { minutes: 7 })], TODAY)
    expect(view.bestMinutes).toBe(0)
    expect(view.lastMinutes).toBe(7)
  })
})

describe('viewProblem: mistakes', () => {
  it('lists each tag once across all attempts, in order first seen', () => {
    const view = viewOf(
      SLUG,
      [
        attempt(day(-9), 'help', { mistakes: ['blanked', 'wrong-pattern'] }),
        attempt(day(-5), 'struggled', { mistakes: ['edge-case', 'blanked'] }),
        attempt(day(-1), 'easy', { mistakes: ['edge-case'] }),
      ],
      TODAY,
    )
    expect(view.mistakes).toEqual(['blanked', 'wrong-pattern', 'edge-case'])
  })

  it('is empty when no attempt had mistakes', () => {
    expect(viewOf(SLUG, [attempt(day(-1), 'easy')], TODAY).mistakes).toEqual([])
  })
})

describe('viewProblem: touchedToday', () => {
  it('is true for an attempt dated today, first solve or revision', () => {
    expect(viewOf(SLUG, [attempt(TODAY, 'easy')], TODAY).touchedToday).toBe(true)
    expect(viewOf(SLUG, [attempt(day(-4), 'easy'), attempt(TODAY, 'easy')], TODAY).touchedToday).toBe(true)
  })

  it('is false for yesterday and tomorrow', () => {
    expect(viewOf(SLUG, [attempt(day(-1), 'easy')], TODAY).touchedToday).toBe(false)
    expect(viewOf(SLUG, [attempt(day(1), 'easy')], TODAY).touchedToday).toBe(false)
  })

  it('is true when the dated-today attempt is not the latest in storage', () => {
    const view = viewOf(SLUG, [attempt(day(3), 'easy'), attempt(TODAY, 'easy')], TODAY)
    expect(view.touchedToday).toBe(true)
  })
})

describe('viewProblem: notes', () => {
  it('reports notes alongside attempts', () => {
    const view = viewOf(SLUG, [attempt(day(-1), 'easy')], TODAY, { pitfalls: 'duplicates' })
    expect(view).toMatchObject({ hasNotes: true, solved: true })
  })

  it('does not count whitespace as notes', () => {
    expect(viewOf(SLUG, [attempt(day(-1), 'easy')], TODAY, { insight: '  ' }).hasNotes).toBe(false)
  })
})

describe('viewProblem: several attempts on one day', () => {
  it('keeps them all, in the order logged', () => {
    const first = attempt(day(-2), 'help', { minutes: 30 })
    const second = attempt(day(-2), 'easy', { minutes: 8 })
    const view = viewOf(SLUG, [second, first], TODAY)
    expect(view.attempts).toEqual([first, second])
    expect(view.lastMinutes).toBe(8)
    expect(view.bestMinutes).toBe(8)
  })

  it('does not let a same-day repeat move the due date', () => {
    const view = viewOf(SLUG, [attempt(day(-1), 'easy'), attempt(day(-1), 'easy')], TODAY)
    expect(view).toMatchObject({ status: 'learning', dueIn: 2 })
    expect(view.srs?.reviews).toBe(1)
  })

  it('is touched today once however many attempts are dated today', () => {
    const view = viewOf(SLUG, [attempt(TODAY, 'help'), attempt(TODAY, 'easy')], TODAY)
    expect(view.touchedToday).toBe(true)
    expect(view.solved).toBe(true)
  })
})

describe('viewProblem: long and odd histories', () => {
  it('handles a year of weekly attempts', () => {
    const attempts = Array.from({ length: 52 }, (_, i) =>
      attempt(day(-364 + i * 7), i % 5 === 0 ? 'help' : 'easy', { minutes: 10 + (i % 7), mistakes: i % 5 === 0 ? ['blanked'] : [] }),
    )
    const view = viewOf(SLUG, attempts, TODAY)
    expect(view.attempts).toHaveLength(52)
    expect(view.srs?.firstOn).toBe(day(-364))
    expect(view.srs?.lastOn).toBe(day(-7))
    expect(view.srs?.reviews).toBe(51)
    expect(view.bestMinutes).toBe(10)
    expect(view.mistakes).toEqual(['blanked'])
    // The last attempt was on day -7, so the next due date sits at most a few weeks out.
    expect(view.dueIn).toBe(diffDays(TODAY, view.srs!.due!))
    expect(view.status).toBe(view.dueIn! <= 0 ? 'due' : 'learning')
  })

  it('is not due the day before the due date and is due on it', () => {
    const attempts = [attempt('2026-11-01', 'easy')]
    expect(viewOf(SLUG, attempts, '2026-11-03')).toMatchObject({ status: 'learning', dueIn: 1 })
    expect(viewOf(SLUG, attempts, '2026-11-04')).toMatchObject({ status: 'due', dueIn: 0 })
  })

  it('counts dueIn across a month end', () => {
    const view = viewOf(SLUG, [attempt('2026-11-29', 'easy')], '2026-11-30')
    expect(view.srs?.due).toBe('2026-12-02')
    expect(view.dueIn).toBe(2)
  })

  it('shares nothing mutable with the stored record', () => {
    const rec = record([attempt(day(-5), 'easy'), attempt(day(-9), 'easy')])
    const view = viewProblem(getProblem(SLUG)!, rec, TODAY)
    expect(view.attempts).not.toBe(rec.attempts)
    view.attempts.pop()
    view.mistakes.push('bug')
    expect(rec.attempts).toHaveLength(2)
  })

  it('works on a frozen record', () => {
    const rec = record([Object.freeze(attempt(day(-5), 'easy')), Object.freeze(attempt(day(-9), 'struggled'))])
    Object.freeze(rec.attempts)
    expect(() => viewProblem(getProblem(SLUG)!, rec, TODAY)).not.toThrow()
  })

  it('counts a problem as solved after any rating, including Needed help', () => {
    const view = viewOf(SLUG, [attempt(day(-1), 'help')], TODAY)
    expect(view).toMatchObject({ solved: true, status: 'due', dueIn: 0 })
  })
})
