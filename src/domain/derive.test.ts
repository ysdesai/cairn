import { describe, expect, it } from 'vitest'
import { PATTERNS, PROBLEMS, ROADMAP_ORDER, TOPICS } from '../data'
import { createEmptyData, logAttempt, recordDrill } from '../state/reducers'
import type { AppData, Attempt, ISODate, MockSession, SessionPlan } from '../state/schema'
import { addDays, diffDays } from './dates'
import { derive } from './derive'
import { attempt, record } from './testing'

const TODAY = '2026-11-12'
const T0 = Date.UTC(2026, 10, 12, 12, 0, 0)

describe('derive on an empty document', () => {
  const data = createEmptyData(TODAY, T0)
  const d = derive(data, TODAY)

  it('lists all 150 problems, none started', () => {
    expect(d.list).toHaveLength(150)
    expect(Object.keys(d.problems)).toHaveLength(150)
    expect(d.list.every((v) => v.status === 'todo' && !v.solved && v.record === null)).toBe(true)
    expect(d.counts).toEqual({ total: 150, solved: 0, mastered: 0, learning: 0, due: 0, todo: 150 })
  })

  it('has a view for every topic and recommends Arrays & Hashing alone', () => {
    expect(d.topicList.map((t) => t.topic.id)).toEqual(TOPICS.map((t) => t.id))
    expect(d.topicList.reduce((n, t) => n + t.total, 0)).toBe(150)
    expect(d.topics['arrays-hashing']).toMatchObject({ state: 'ready', recommended: true, solved: 0, strength: null })
    expect(d.topicList.filter((t) => t.recommended).map((t) => t.topic.id)).toEqual(['arrays-hashing'])
  })

  it('has nothing to revise, and starts at base camp', () => {
    expect(d.queue).toEqual({ cap: 5, doneToday: 0, today: [], waiting: [], totalDue: 0 })
    expect(d.suggestion).toMatchObject({ kind: 'start', topic: 'arrays-hashing' })
    expect(d.suggestion.problem?.slug).toBe('contains-duplicate')
    expect(d.recommendations).toHaveLength(6)
    expect(d.recommendations[0]).toMatchObject({ reason: 'new-topic' })
    expect(d.recommendations[0].problem.slug).toBe('contains-duplicate')
  })

  it('forecasts fourteen days of zeros starting today', () => {
    expect(d.forecast).toHaveLength(14)
    d.forecast.forEach((day, i) => {
      expect(day).toEqual({ date: addDays(TODAY, i), offset: i, scheduled: 0, carried: 0 })
    })
  })

  it('has a plan that has not started', () => {
    expect(d.plan).toMatchObject({
      status: 'not-started',
      startDate: TODAY,
      totalDays: 84,
      dayNumber: 1,
      daysLeft: 84,
      solved: 0,
      remaining: 150,
      projectedFinish: null,
    })
    expect(d.plan.series).toHaveLength(84)
  })

  it('has no activity, streak, mistakes, drill results, session or mock', () => {
    expect(d.today).toBe(TODAY)
    expect(d.streak).toMatchObject({ current: 0, best: 0, activeToday: false, lastActive: null })
    expect(d.streak.recent).toEqual(Array(14).fill(false))
    expect(d.activity).toMatchObject({ days: {}, max: 1, activeDays: 0, totalMinutes: 0 })
    expect(d.mistakes.total).toBe(0)
    expect(d.mistakes.byTopic).toEqual([])
    expect(d.difficulty.map((s) => [s.difficulty, s.total, s.solved])).toEqual([
      ['easy', 28, 0],
      ['medium', 101, 0],
      ['hard', 21, 0],
    ])
    expect(d.drill).toMatchObject({ total: 0, correct: 0, accuracy: null, today: 0 })
    expect(d.session).toBeNull()
    expect(d.activeMock).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// Three weeks of history, worked out by hand from the rules in srs.ts (ladder 1, 3, 7, 21, 45).

const slug = (i: number) => PROBLEMS[i].slug
const CONTAINS_DUPLICATE = slug(0)
const VALID_ANAGRAM = slug(1)
const TWO_SUM = slug(2)
const GROUP_ANAGRAMS = slug(3)
const TOP_K = slug(4)
const PRODUCT = slug(5)
const VALID_SUDOKU = slug(6)
const ENCODE_DECODE = slug(7)
const LONGEST_CONSECUTIVE = slug(8)
const VALID_PALINDROME = slug(9)
const TWO_SUM_II = slug(10)
const THREE_SUM = slug(11)

function history(): Record<string, Attempt[]> {
  return {
    // Easy, then an easy revision three weeks later: waited well past the plan, so it climbs three
    // rungs. Step 4, ease 1.2, next in 45 * 1.2 = 54 days. The revision counts against today's cap.
    [CONTAINS_DUPLICATE]: [attempt('2026-10-22', 'easy', { minutes: 12 }), attempt(TODAY, 'easy')],
    // Easy three times, each revision on its due date: step 1 (due in 3 days), 3 (due in 25), 5. Mastered.
    [VALID_ANAGRAM]: [
      attempt('2026-10-04', 'easy', { minutes: 8 }),
      attempt('2026-10-07', 'easy'),
      attempt('2026-11-01', 'easy'),
    ],
    // Due 3 days after Oct 30: overdue by 10.
    [TWO_SUM]: [attempt('2026-10-30', 'easy', { minutes: 10 })],
    // Needed help: back to step 0, due the next day, overdue by 14.
    [GROUP_ANAGRAMS]: [attempt('2026-10-28', 'help', { mistakes: ['wrong-pattern', 'edge-case'] })],
    // Struggled: due two days later, overdue by 5.
    [TOP_K]: [attempt('2026-11-05', 'struggled')],
    // Easy two days ago: due tomorrow.
    [PRODUCT]: [attempt('2026-11-10', 'easy')],
    // Help, then struggled a day later: step 1, ease 0.8, due in 2 days from Oct 24, overdue by 17. Help on the solve is not a lapse.
    [VALID_SUDOKU]: [attempt('2026-10-23', 'help', { mistakes: ['off-by-one'] }), attempt('2026-10-24', 'struggled')],
    [ENCODE_DECODE]: [attempt(TODAY, 'easy')],
    [VALID_PALINDROME]: [attempt('2026-11-11', 'easy')],
    [TWO_SUM_II]: [attempt(TODAY, 'easy')],
    [THREE_SUM]: [attempt(TODAY, 'help', { mistakes: ['wrong-pattern'] })],
  }
}

const PLAN: SessionPlan = {
  date: TODAY,
  budget: 40,
  createdAt: T0,
  items: [
    { kind: 'drill', minutes: 5, reason: 'Warm-up' },
    { kind: 'review', slug: GROUP_ANAGRAMS, minutes: 10, reason: 'Due' },
    { kind: 'new', slug: ENCODE_DECODE, minutes: 30, reason: 'Next' },
  ],
}

function build(cap: number): AppData {
  const base = createEmptyData('2026-10-22', T0)
  const problems = Object.fromEntries(Object.entries(history()).map(([s, attempts]) => [s, record(attempts)]))
  // Notes alone do not make a problem solved.
  problems[LONGEST_CONSECUTIVE] = record([], { insight: 'Only start from the beginning of a run.' })
  const patternId = PATTERNS[0].id
  const drill = { slug: TWO_SUM, answer: patternId, picked: patternId, correct: true, ms: 1200 }
  return {
    ...base,
    settings: { ...base.settings, dailyReviewCap: cap },
    problems,
    drills: [
      { ...drill, at: T0, date: TODAY },
      { ...drill, at: T0 + 1, date: '2026-11-11', correct: false },
    ],
    session: PLAN,
  }
}

describe('derive on three weeks of history', () => {
  const d = derive(build(2), TODAY)

  it('gives each problem the status the rules lead to', () => {
    const status = (s: string) => d.problems[s].status
    expect(status(CONTAINS_DUPLICATE)).toBe('learning')
    expect(status(VALID_ANAGRAM)).toBe('mastered')
    expect(status(TWO_SUM)).toBe('due')
    expect(status(GROUP_ANAGRAMS)).toBe('due')
    expect(status(TOP_K)).toBe('due')
    expect(status(PRODUCT)).toBe('learning')
    expect(status(VALID_SUDOKU)).toBe('due')
    expect(status(ENCODE_DECODE)).toBe('learning')
    expect(status(VALID_PALINDROME)).toBe('learning')
    expect(status(TWO_SUM_II)).toBe('learning')
    expect(status(THREE_SUM)).toBe('learning')
    expect(status(LONGEST_CONSECUTIVE)).toBe('todo')
    expect(d.problems[LONGEST_CONSECUTIVE].hasNotes).toBe(true)
    expect(d.problems[slug(100)].status).toBe('todo')
  })

  it('schedules each problem on the ladder', () => {
    const dueIn = (s: string) => d.problems[s].dueIn
    expect(dueIn(CONTAINS_DUPLICATE)).toBe(54)
    expect(dueIn(VALID_ANAGRAM)).toBeNull()
    expect(dueIn(TWO_SUM)).toBe(-10)
    expect(dueIn(GROUP_ANAGRAMS)).toBe(-14)
    expect(dueIn(TOP_K)).toBe(-5)
    expect(dueIn(PRODUCT)).toBe(1)
    expect(dueIn(VALID_SUDOKU)).toBe(-17)
    expect(dueIn(ENCODE_DECODE)).toBe(3)
    expect(dueIn(VALID_PALINDROME)).toBe(2)
    expect(dueIn(TWO_SUM_II)).toBe(3)
    expect(dueIn(THREE_SUM)).toBe(1)
    expect(d.problems[VALID_SUDOKU].srs).toMatchObject({ step: 1, lapses: 0, reviews: 1 })
  })

  it('counts the statuses', () => {
    expect(d.counts).toEqual({ total: 150, solved: 11, mastered: 1, learning: 6, due: 4, todo: 139 })
  })

  it('puts the most urgent and weakest revisions first, within the cap of 2', () => {
    // One revision is already done today (Contains Duplicate), leaving one slot.
    expect(d.queue.cap).toBe(2)
    expect(d.queue.doneToday).toBe(1)
    expect(d.queue.today.map((v) => v.problem.slug)).toEqual([GROUP_ANAGRAMS])
    expect(d.queue.waiting.map((v) => v.problem.slug)).toEqual([VALID_SUDOKU, TWO_SUM, TOP_K])
    expect(d.queue.totalDue).toBe(4)
  })

  it('shows every due problem when the cap allows', () => {
    const roomy = derive(build(5), TODAY).queue
    expect(roomy.today.map((v) => v.problem.slug)).toEqual([GROUP_ANAGRAMS, VALID_SUDOKU, TWO_SUM, TOP_K])
    expect(roomy.waiting).toEqual([])
  })

  it('works out topic states and where to work next', () => {
    const state = (id: (typeof ROADMAP_ORDER)[number]) => d.topics[id].state
    // 8 of 9 and 3 of 5 solved.
    expect(state('arrays-hashing')).toBe('active')
    expect(state('two-pointers')).toBe('active')
    expect(d.topics['arrays-hashing']).toMatchObject({ solved: 8, total: 9, mastered: 1, due: 4 })
    expect(d.topics['arrays-hashing'].next?.slug).toBe(LONGEST_CONSECUTIVE)
    expect(d.topics['two-pointers']).toMatchObject({ solved: 3, total: 5, mastered: 0, due: 0 })
    // Two Pointers is exactly 60% done, which opens the topics that depend on it.
    for (const id of ['stack', 'sliding-window', 'binary-search', 'linked-list'] as const) expect(state(id)).toBe('ready')
    expect(state('trees')).toBe('ahead')
    expect(d.topicList.filter((t) => t.recommended).map((t) => t.topic.id)).toEqual([
      'arrays-hashing',
      'two-pointers',
      'stack',
    ])
    expect(d.recommendations[0].problem.slug).toBe(LONGEST_CONSECUTIVE)
    expect(d.recommendations[0].reason).toBe('continue')
  })

  it('suggests clearing the queue, since more revisions wait than one day allows', () => {
    expect(d.suggestion.kind).toBe('revise')
    expect(d.suggestion.problem?.slug).toBe(GROUP_ANAGRAMS)
  })

  it('counts a streak of three days and a best of three', () => {
    expect(d.streak).toMatchObject({ current: 3, best: 3, activeToday: true, lastActive: TODAY })
    // Oct 30 to Nov 12, oldest first: active on Oct 30, Nov 1, 5, 10, 11 and 12.
    expect(d.streak.recent).toEqual([
      true, false, true, false, false, false, true, false, false, false, false, true, true, true,
    ])
    expect(d.activity.activeDays).toBe(12)
    expect(d.activity.days[TODAY]).toMatchObject({ solves: 3, reviews: 1, total: 4 })
    expect(d.activity.max).toBe(4)
    expect(d.activity.totalMinutes).toBe(30)
  })

  it('measures the plan against the straight line', () => {
    // Day 22 of 84; round(150 * 22 / 84) is 39 expected, 11 solved.
    expect(d.plan).toMatchObject({
      dayNumber: 22,
      totalDays: 84,
      daysLeft: 63,
      solved: 11,
      remaining: 139,
      expected: 39,
      delta: -28,
      status: 'behind',
    })
    expect(d.plan.neededPerDay).toBeCloseTo(139 / 63)
    // Seven first solves in the last 14 days, and 11 in 22 days: half a problem a day either way.
    expect(d.plan.recentPerDay).toBe(0.5)
    expect(d.plan.overallPerDay).toBe(0.5)
    expect(d.plan.projectedFinish).toBe(addDays(TODAY, 278))
    expect(d.plan.series).toHaveLength(84)
    expect(d.plan.series.find((p) => p.date === TODAY)?.actual).toBe(11)
  })

  it('forecasts with the cap applied', () => {
    expect(d.forecast).toHaveLength(14)
    // Four due, one slot left today.
    expect(d.forecast[0]).toMatchObject({ date: TODAY, scheduled: 1, carried: 3 })
    // Tomorrow: three carried plus Product and Three Sum, two let through.
    expect(d.forecast[1]).toMatchObject({ scheduled: 2, carried: 3 })
    for (const day of d.forecast) expect(day.scheduled).toBeLessThanOrEqual(2)
  })

  it('tallies mistakes and difficulty', () => {
    expect(d.mistakes.total).toBe(4)
    expect(d.mistakes.byTag[0]).toEqual({ tag: 'wrong-pattern', count: 2 })
    expect(d.mistakes.byTopic.map((t) => [t.topic, t.total])).toEqual([
      ['arrays-hashing', 3],
      ['two-pointers', 1],
    ])
    const easy = d.difficulty[0]
    expect(easy).toMatchObject({ difficulty: 'easy', solved: 4, mastered: 1, target: 15 })
    expect(easy.avgMinutes).toBe(10)
  })

  it('reads the drill and the session for today', () => {
    expect(d.drill).toMatchObject({ total: 2, correct: 1, accuracy: 0.5, today: 1 })
    expect(d.session).toMatchObject({ budget: 40, plannedMinutes: 45, doneCount: 1, nextIndex: 0 })
    expect(d.session?.items.map((i) => i.done)).toEqual([false, false, true])
  })

  it('ignores a session built on another day', () => {
    const stale = { ...build(2), session: { ...PLAN, date: '2026-11-11' } }
    expect(derive(stale, TODAY).session).toBeNull()
  })

  it('moves with the date: the same history a week later has more due', () => {
    const later = addDays(TODAY, 7) as ISODate
    const week = derive(build(5), later)
    expect(diffDays(TODAY, week.today)).toBe(7)
    expect(week.counts.due).toBeGreaterThan(d.counts.due)
    expect(week.problems[PRODUCT].status).toBe('due')
  })

  it('reports a running mock, and none once it is done', () => {
    const base = build(2)
    const mock: MockSession = {
      id: 'm1',
      startedAt: T0,
      config: { mix: 'any', pool: 'any', topics: [], minutes: 45 },
      slugs: [TWO_SUM],
      status: 'running',
      endedAt: null,
      marks: {},
      results: {},
    }
    expect(derive({ ...base, mocks: [{ ...mock, id: 'old', status: 'done' }, mock] }, TODAY).activeMock?.id).toBe('m1')
    expect(derive({ ...base, mocks: [{ ...mock, status: 'done' }] }, TODAY).activeMock).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// Speed. derive() runs on every change to the document, so a heavy year of use must stay cheap.

function syntheticYear(): { data: AppData; today: ISODate } {
  const today = TODAY
  const start = addDays(today, -364)
  let data = createEmptyData(start, T0)
  let at = T0
  // Every problem: a solve and five revisions, fifty days apart.
  PROBLEMS.forEach((problem, i) => {
    const first = (i * 2) % 100
    for (let k = 0; k < 6; k++) {
      const rating = (['easy', 'struggled', 'help'] as const)[(i + k) % 3]
      const date = addDays(start, first + k * 50)
      data = logAttempt(data, problem.slug, { rating, date, minutes: 10 + ((i + k) % 30), mistakes: k === 2 ? ['bug'] : [] }, today, (at += 1))
    }
  })
  for (let j = 0; j < 3000; j++) {
    const problem = PROBLEMS[j % PROBLEMS.length]
    const answer = problem.pattern
    const picked = j % 4 === 0 ? PATTERNS[j % PATTERNS.length].id : answer
    const day = addDays(start, j % 365)
    data = recordDrill(data, { slug: problem.slug, answer, picked, correct: picked === answer, ms: 800 + (j % 5000) }, day, (at += 1))
  }
  return { data, today }
}

describe('derive performance', () => {
  it('stays under 50 ms on average for a year of heavy use', () => {
    const { data, today } = syntheticYear()
    expect(Object.keys(data.problems)).toHaveLength(150)
    expect(data.drills).toHaveLength(3000)

    // The first run pays for compiling the code; the app runs it far more often than once.
    const warm = derive(data, today)
    expect(warm.counts.solved).toBe(150)
    expect(warm.drill.total).toBe(3000)

    const runs = 20
    const started = performance.now()
    for (let i = 0; i < runs; i++) derive(data, today)
    const average = (performance.now() - started) / runs
    expect(average).toBeLessThan(50)
  })
})
