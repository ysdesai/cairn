import { describe, expect, it } from 'vitest'
import { EXPECTED_COUNTS, PROBLEMS, PROBLEMS_BY_TOPIC, ROADMAP_ORDER, TOPICS, recordByTopic } from '../data'
import type { TopicId } from '../data/types'
import { DEFAULT_TARGETS, type Attempt, type Rating } from '../state/schema'
import { MAX_RECOMMENDED, READY_THRESHOLD, buildTopicViews } from './roadmap'
import { attempt, listWith } from './testing'
import type { DrillStats, TopicView } from './types'

const TODAY = '2026-11-12'

function drillStats(byTopic: Partial<Record<TopicId, { seen: number; correct: number }>> = {}): DrillStats {
  return {
    total: 0,
    correct: 0,
    accuracy: null,
    today: 0,
    byPattern: [],
    weakest: [],
    byTopic: recordByTopic((id) => byTopic[id] ?? { seen: 0, correct: 0 }),
  }
}

/** The first `count` problems of a topic (all of them by default), each solved once on `date`. */
function solved(topic: TopicId, count = Infinity, rating: Rating = 'easy', date = '2026-11-01') {
  const history: Record<string, Attempt[]> = {}
  for (const p of PROBLEMS_BY_TOPIC[topic].slice(0, count)) history[p.slug] = [attempt(date, rating)]
  return history
}

function viewsFor(history: Record<string, Attempt[]>, drill = drillStats()) {
  return buildTopicViews(listWith(history, TODAY), drill, DEFAULT_TARGETS)
}

/** Recommended topics, listed in roadmap order. */
const recommended = (views: Record<TopicId, TopicView>) => ROADMAP_ORDER.filter((id) => views[id].recommended)

describe('with no history', () => {
  const views = viewsFor({})

  it('has a view for every topic, with its problems in order', () => {
    expect(Object.keys(views)).toHaveLength(TOPICS.length)
    for (const topic of TOPICS) {
      const view = views[topic.id]
      expect(view.topic).toBe(topic)
      expect(view.total).toBe(EXPECTED_COUNTS[topic.id])
      expect(view.problems.map((v) => v.problem.slug)).toEqual(PROBLEMS_BY_TOPIC[topic.id].map((p) => p.slug))
    }
    expect(Object.values(views).reduce((n, v) => n + v.total, 0)).toBe(PROBLEMS.length)
  })

  it('starts at base camp: Arrays & Hashing is ready, everything else is ahead', () => {
    expect(views['arrays-hashing'].state).toBe('ready')
    for (const topic of TOPICS) if (topic.id !== 'arrays-hashing') expect(views[topic.id].state).toBe('ahead')
  })

  it('recommends Arrays & Hashing alone', () => {
    expect(recommended(views)).toEqual(['arrays-hashing'])
  })

  it('is unexplored: no counts, no strength', () => {
    for (const view of Object.values(views)) {
      expect(view).toMatchObject({
        solved: 0,
        mastered: 0,
        due: 0,
        progress: 0,
        strength: null,
        confidence: 'none',
        weakness: null,
      })
      expect(view.next).toBe(view.problems[0].problem)
    }
  })
})

describe('state', () => {
  it('is active as soon as one problem is solved', () => {
    const views = viewsFor(solved('arrays-hashing', 1))
    expect(views['arrays-hashing']).toMatchObject({ state: 'active', solved: 1 })
    expect(views['arrays-hashing'].progress).toBeCloseTo(1 / 9)
  })

  it('is complete when every problem is solved', () => {
    const views = viewsFor(solved('arrays-hashing'))
    expect(views['arrays-hashing']).toMatchObject({ state: 'complete', solved: 9, progress: 1, next: null })
  })

  it('treats a prerequisite as far enough along at exactly 60% solved', () => {
    expect(READY_THRESHOLD).toBe(0.6)
    const atThreshold = viewsFor(solved('two-pointers', 3)) // 3 of 5
    expect(atThreshold['sliding-window'].state).toBe('ready')
    expect(atThreshold['binary-search'].state).toBe('ready')
    expect(atThreshold['linked-list'].state).toBe('ready')

    const below = viewsFor(solved('two-pointers', 2)) // 2 of 5
    expect(below['sliding-window'].state).toBe('ahead')
  })

  it('needs every prerequisite, not just one', () => {
    // Trees depends on binary search, sliding window and linked list.
    const history = {
      ...solved('binary-search'),
      ...solved('sliding-window'),
      ...solved('linked-list', 5), // 5 of 11 is under 60%
    }
    expect(viewsFor(history).trees.state).toBe('ahead')
    expect(viewsFor({ ...history, ...solved('linked-list', 7) }).trees.state).toBe('ready')
  })

  it('stays active, not ahead, when a topic has progress but its prerequisite does not', () => {
    const views = viewsFor(solved('trees', 1))
    expect(views.trees.state).toBe('active')
  })

  it('never locks a topic: next still names its first problem while ahead', () => {
    const views = viewsFor({})
    expect(views.tries.state).toBe('ahead')
    expect(views.tries.next?.slug).toBe(PROBLEMS_BY_TOPIC.tries[0].slug)
  })
})

describe('next', () => {
  it('is the first unsolved problem, even when later ones are solved', () => {
    const [first, second, third] = PROBLEMS_BY_TOPIC['two-pointers']
    const views = viewsFor({ [first.slug]: [attempt('2026-11-01', 'easy')], [third.slug]: [attempt('2026-11-01', 'easy')] })
    expect(views['two-pointers'].next).toBe(second)
  })
})

describe('recommended', () => {
  it('includes active and ready topics together', () => {
    // Arrays done and Stack begun: Stack is active, Two Pointers ready.
    const views = viewsFor({ ...solved('arrays-hashing'), ...solved('stack', 1) })
    expect(views.stack.state).toBe('active')
    expect(views['two-pointers'].state).toBe('ready')
    expect(recommended(views)).toEqual(['two-pointers', 'stack'])
  })

  it('stops at three, taking ready topics in roadmap order', () => {
    expect(MAX_RECOMMENDED).toBe(3)
    const views = viewsFor({ ...solved('arrays-hashing'), ...solved('two-pointers') })
    expect(views.stack.state).toBe('ready')
    expect(views['linked-list'].state).toBe('ready')
    expect(recommended(views)).toEqual(['stack', 'sliding-window', 'binary-search'])
    expect(views['linked-list'].recommended).toBe(false)
  })

  it('lets active topics take the places first', () => {
    const history = {
      ...solved('arrays-hashing', 1),
      ...solved('two-pointers', 1),
      ...solved('stack', 1),
      ...solved('sliding-window', 1),
    }
    const views = viewsFor(history)
    expect(recommended(views)).toEqual(['arrays-hashing', 'two-pointers', 'stack'])
    expect(views['sliding-window'].recommended).toBe(false)
  })

  it('never includes a complete topic', () => {
    const views = viewsFor(solved('arrays-hashing'))
    expect(views['arrays-hashing'].recommended).toBe(false)
  })

  it('is empty once everything is solved', () => {
    const history: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS) history[p.slug] = [attempt('2026-11-01', 'easy')]
    const views = viewsFor(history)
    expect(recommended(views)).toEqual([])
    expect(Object.values(views).every((v) => v.state === 'complete')).toBe(true)
  })
})

describe('mastered and due', () => {
  it('counts each status within the topic', () => {
    const [a, b, c] = PROBLEMS_BY_TOPIC['arrays-hashing']
    const views = viewsFor({
      // Easy on 10-01 is due on 10-04, long past by 11-12.
      [a.slug]: [attempt('2026-10-01', 'easy')],
      // Easy on 11-10 is not due until later.
      [b.slug]: [attempt('2026-11-10', 'easy')],
      // The whole ladder, cleared.
      [c.slug]: [
        attempt('2026-09-01', 'easy'),
        attempt('2026-09-05', 'easy'),
        attempt('2026-09-20', 'easy'),
        attempt('2026-11-05', 'easy'),
      ],
    })
    expect(views['arrays-hashing']).toMatchObject({ solved: 3, due: 1, mastered: 1 })
    expect(views['two-pointers']).toMatchObject({ solved: 0, due: 0, mastered: 0 })
  })
})

describe('strength', () => {
  it('uses the topic problems and that topic drill tally', () => {
    const views = viewsFor({ ...solved('arrays-hashing', 2, 'help') }, drillStats({ trees: { seen: 4, correct: 4 } }))
    expect(views['arrays-hashing'].strength).toBe(15)
    expect(views['arrays-hashing'].parts.ratings).toBe(0.15)
    expect(views['arrays-hashing'].weakness).toBe('recent ratings average 15%')
    // Trees has nothing solved but has been drilled: the drill figure is reported, the topic is not scored.
    expect(views.trees.parts.drill).toBeCloseTo(5 / 6)
    expect(views.trees.strength).toBeNull()
    expect(views.trees.confidence).toBe('none')
    expect(views.trees.weakness).toBeNull()
    expect(views.trees.state).toBe('ahead')
    expect(views['two-pointers'].strength).toBeNull()
  })
})

describe('a few weeks in', () => {
  it('reads as a climber who has finished the base and is partway up the next topics', () => {
    const history: Record<string, Attempt[]> = {}
    // Arrays & Hashing: all nine over a week, the first four revised once.
    PROBLEMS_BY_TOPIC['arrays-hashing'].forEach((p, i) => {
      history[p.slug] = [attempt(`2026-10-${String(12 + i).padStart(2, '0')}`, 'easy', { minutes: 12 })]
      if (i < 4) history[p.slug].push(attempt('2026-10-28', 'easy', { minutes: 7 }))
    })
    // Two Pointers: three solved, one needed help.
    PROBLEMS_BY_TOPIC['two-pointers'].slice(0, 3).forEach((p, i) => {
      history[p.slug] = [attempt(`2026-11-0${2 + i}`, i === 1 ? 'help' : 'struggled', { minutes: 30 })]
    })
    const views = viewsFor(history, drillStats({ 'arrays-hashing': { seen: 6, correct: 5 } }))

    expect(views['arrays-hashing'].state).toBe('complete')
    expect(views['arrays-hashing'].strength!).toBeGreaterThan(70)
    expect(views['arrays-hashing'].confidence).toBe('high')
    expect(views['two-pointers']).toMatchObject({ state: 'active', solved: 3, next: PROBLEMS_BY_TOPIC['two-pointers'][3] })
    expect(views['two-pointers'].strength!).toBeLessThan(55)
    expect(views['two-pointers'].weakness).not.toBeNull()
    // Two Pointers is at 3 of 5, so what hangs off it is ready.
    expect(recommended(views)).toEqual(['two-pointers', 'stack', 'sliding-window'])
  })
})

describe('edge cases', () => {
  it('does not change the list or the views it is given', () => {
    const list = listWith({ ...solved('arrays-hashing', 2), ...solved('stack', 1) }, TODAY)
    const frozen = Object.freeze([...list])
    const before = JSON.stringify(frozen)
    buildTopicViews(frozen, drillStats(), DEFAULT_TARGETS)
    expect(JSON.stringify(frozen)).toBe(before)
  })

  it('gives the same answer twice', () => {
    const history = { ...solved('arrays-hashing'), ...solved('two-pointers', 2) }
    const first = viewsFor(history)
    const second = viewsFor(history)
    expect(recommended(first)).toEqual(recommended(second))
    expect(ROADMAP_ORDER.map((id) => first[id].state)).toEqual(ROADMAP_ORDER.map((id) => second[id].state))
  })

  it('copes with an empty list: nothing solved, no NaN', () => {
    const views = buildTopicViews([], drillStats(), DEFAULT_TARGETS)
    for (const view of Object.values(views)) {
      expect(view).toMatchObject({ total: 0, solved: 0, progress: 0, strength: null, next: null })
    }
    expect(views['arrays-hashing'].state).toBe('ready')
    expect(views.tries.state).toBe('ahead')
  })

  it('calls a topic complete even when its prerequisites are untouched', () => {
    const views = viewsFor(solved('tries'))
    expect(views.tries).toMatchObject({ state: 'complete', progress: 1, next: null, recommended: false })
    expect(views.trees.state).toBe('ahead')
  })

  it('opens what hangs off a complete topic only when every prerequisite is there', () => {
    const views = viewsFor(solved('arrays-hashing'))
    expect(views['two-pointers'].state).toBe('ready')
    expect(views.stack.state).toBe('ready')
    expect(views['sliding-window'].state).toBe('ahead')
  })

  it('reads progress from the exact fraction', () => {
    const views = viewsFor(solved('linked-list', 4))
    expect(views['linked-list'].progress).toBeCloseTo(4 / 11)
    expect(views['linked-list'].solved).toBe(4)
  })

  it('offers only the first three active topics when more are begun', () => {
    const history = {
      ...solved('arrays-hashing', 1),
      ...solved('two-pointers', 1),
      ...solved('stack', 1),
      ...solved('binary-search', 1),
      ...solved('linked-list', 1),
    }
    const views = viewsFor(history)
    expect(recommended(views)).toEqual(['arrays-hashing', 'two-pointers', 'stack'])
    expect(views['binary-search'].recommended).toBe(false)
  })

  it('counts several attempts on one day as one solved problem', () => {
    const [first] = PROBLEMS_BY_TOPIC['arrays-hashing']
    const views = viewsFor({
      [first.slug]: [attempt(TODAY, 'help'), attempt(TODAY, 'easy'), attempt(TODAY, 'easy')],
    })
    expect(views['arrays-hashing']).toMatchObject({ solved: 1, total: 9 })
  })

  it('reads a topic with everything mastered', () => {
    const history: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS_BY_TOPIC['arrays-hashing']) {
      history[p.slug] = [
        attempt('2026-09-01', 'easy', { minutes: 10 }),
        attempt('2026-09-05', 'easy', { minutes: 5 }),
        attempt('2026-09-20', 'easy', { minutes: 5 }),
        attempt('2026-11-05', 'easy', { minutes: 5 }),
      ]
    }
    const view = viewsFor(history)['arrays-hashing']
    expect(view).toMatchObject({ state: 'complete', mastered: 9, due: 0, solved: 9, strength: 100, weakness: null })
    expect(view.confidence).toBe('high')
  })

  it('a year of history on one topic stays within 0 to 100 with no NaN', () => {
    const history: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS_BY_TOPIC['two-pointers']) {
      history[p.slug] = Array.from({ length: 60 }, (_, i) => {
        const day = new Date(Date.UTC(2025, 10, 12 + i * 6)).toISOString().slice(0, 10)
        return attempt(day, i % 7 === 0 ? 'help' : 'easy', { minutes: 8 + (i % 5) })
      })
    }
    const view = viewsFor(history)['two-pointers']
    expect(view.strength).not.toBeNull()
    expect(view.strength!).toBeGreaterThanOrEqual(0)
    expect(view.strength!).toBeLessThanOrEqual(100)
    expect(Object.values(view.parts).every((p) => p === null || Number.isFinite(p))).toBe(true)
  })
})
