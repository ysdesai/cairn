import { describe, expect, it } from 'vitest'
import { PATTERN_BY_ID, PROBLEMS, PROBLEMS_BY_TOPIC, ROADMAP_ORDER, getProblem, recordByTopic } from '../data'
import type { PatternId, TopicId } from '../data/types'
import { DEFAULT_TARGETS, type Attempt, type Rating } from '../state/schema'
import { MAX_PER_TOPIC, MAX_RECOMMENDATIONS, SHORE_UP_BELOW, buildSuggestion, recommendNext } from './recommend'
import { WEAK_BELOW } from './strength'
import { buildTopicViews } from './roadmap'
import { attempt, listWith, viewOf } from './testing'
import type { Counts, DrillStats, PatternStat, Recommendation, ReviewQueue, SessionView, TopicView } from './types'

const TODAY = '2026-11-12'

function drillStats(patterns: Partial<Record<PatternId, { seen: number; correct: number }>> = {}): DrillStats {
  const byPattern: PatternStat[] = Object.entries(patterns).map(([id, tally]) => ({
    pattern: PATTERN_BY_ID[id as PatternId],
    seen: tally.seen,
    correct: tally.correct,
    accuracy: tally.seen ? tally.correct / tally.seen : null,
    confusedWith: [],
  }))
  return {
    total: 0,
    correct: 0,
    accuracy: null,
    today: 0,
    byPattern,
    weakest: [],
    byTopic: recordByTopic(() => ({ seen: 0, correct: 0 })),
  }
}

function solved(topic: TopicId, count = Infinity, rating: Rating = 'easy', extra: Partial<Attempt> = {}) {
  const history: Record<string, Attempt[]> = {}
  for (const p of PROBLEMS_BY_TOPIC[topic].slice(0, count)) history[p.slug] = [attempt('2026-11-01', rating, extra)]
  return history
}

function topicsFor(history: Record<string, Attempt[]>) {
  return buildTopicViews(listWith(history, TODAY), drillStats(), DEFAULT_TARGETS)
}

const slugs = (recs: Recommendation[]) => recs.map((r) => r.problem.slug)
const titleOf = (slug: string) => getProblem(slug)!.title

describe('recommendNext', () => {
  describe('with no history', () => {
    const recs = recommendNext(topicsFor({}))

    it('leads with the first problem of Arrays & Hashing, as a new topic', () => {
      expect(recs[0]).toMatchObject({
        problem: PROBLEMS_BY_TOPIC['arrays-hashing'][0],
        reason: 'new-topic',
        note: 'New topic · Arrays & Hashing',
      })
    })

    it('gives six Arrays & Hashing problems in order, rather than looking ahead', () => {
      expect(recs).toHaveLength(MAX_RECOMMENDATIONS)
      expect(slugs(recs)).toEqual(PROBLEMS_BY_TOPIC['arrays-hashing'].slice(0, 6).map((p) => p.slug))
      expect(recs.map((r) => r.reason)).toEqual(Array(6).fill('new-topic'))
      expect(recs.every((r) => r.note === 'New topic · Arrays & Hashing')).toBe(true)
    })
  })

  describe('following the roadmap', () => {
    // Arrays done, Two Pointers 3 of 5: it is the focus, and what hangs off it is ready.
    const topics = topicsFor({ ...solved('arrays-hashing'), ...solved('two-pointers', 3) })
    const recs = recommendNext(topics)

    it('continues the first active topic with its first unsolved problem', () => {
      expect(recs[0]).toMatchObject({
        problem: PROBLEMS_BY_TOPIC['two-pointers'][3],
        reason: 'continue',
        note: 'Continue Two Pointers · 3 of 5',
      })
      expect(recs[1]).toMatchObject({ problem: PROBLEMS_BY_TOPIC['two-pointers'][4], reason: 'continue' })
    })

    it('then opens the ready topics in roadmap order', () => {
      expect(recs.slice(2).map((r) => [r.problem.topic, r.reason])).toEqual([
        ['stack', 'new-topic'],
        ['stack', 'new-topic'],
        ['stack', 'new-topic'],
        ['sliding-window', 'new-topic'],
      ])
    })
  })

  it('uses the first active topic in roadmap order, not listing order', () => {
    // Stack and Linked List both begun; Stack comes first on the roadmap.
    const recs = recommendNext(topicsFor({ ...solved('arrays-hashing'), ...solved('linked-list', 1), ...solved('stack', 1) }))
    expect(recs[0].problem).toBe(PROBLEMS_BY_TOPIC.stack[1])
  })

  it('skips solved problems wherever they are in the topic', () => {
    const [first, , third] = PROBLEMS_BY_TOPIC['two-pointers']
    const topics = topicsFor({
      ...solved('arrays-hashing'),
      [first.slug]: [attempt('2026-11-01', 'easy')],
      [third.slug]: [attempt('2026-11-01', 'easy')],
    })
    const recs = recommendNext(topics)
    expect(slugs(recs).slice(0, 3)).toEqual([
      PROBLEMS_BY_TOPIC['two-pointers'][1].slug,
      PROBLEMS_BY_TOPIC['two-pointers'][3].slug,
      PROBLEMS_BY_TOPIC['two-pointers'][4].slug,
    ])
  })

  describe('weak areas', () => {
    // Arrays is the focus and doing well; two other topics are begun and weak.
    const struggling = (slug: string, minutes: number | null, rating: Rating) => ({
      [slug]: [attempt('2026-11-01', rating, { minutes })],
    })
    const topics = topicsFor({
      ...solved('arrays-hashing', 3),
      ...struggling('valid-palindrome', null, 'struggled'),
      ...struggling('valid-parentheses', null, 'help'),
    })

    it('has the strengths the scenario needs', () => {
      expect(topics['arrays-hashing'].strength).toBe(100)
      expect(topics['two-pointers'].strength).toBe(55)
      expect(topics.stack.strength).toBe(15)
    })

    it('slots a weak active topic in second', () => {
      const recs = recommendNext(topics)
      expect(recs[0]).toMatchObject({ reason: 'continue', note: 'Continue Arrays & Hashing · 3 of 9' })
      expect(recs[1]).toMatchObject({
        problem: PROBLEMS_BY_TOPIC.stack[1],
        reason: 'weak-area',
        note: 'Weak area · Stack at 15',
      })
      expect(recs[2]).toMatchObject({ problem: PROBLEMS_BY_TOPIC['arrays-hashing'][4], reason: 'continue' })
    })

    it('does not treat a score of exactly 55 as weak', () => {
      const recs = recommendNext(topics)
      expect(recs.filter((r) => r.reason === 'weak-area').map((r) => r.problem.topic)).toEqual(['stack'])
    })

    it('puts the weakest first when several are weak', () => {
      const several = topicsFor({
        ...solved('arrays-hashing', 3),
        ...struggling('valid-palindrome', 40, 'struggled'),
        ...struggling('valid-parentheses', null, 'help'),
      })
      expect(several['two-pointers'].strength).toBe(40)
      const weak = recommendNext(several).filter((r) => r.reason === 'weak-area')
      expect(weak.map((r) => r.problem.topic)).toEqual(['stack', 'two-pointers'])
      expect(weak.map((r) => r.note)).toEqual(['Weak area · Stack at 15', 'Weak area · Two Pointers at 40'])
    })

    it('calls the focus topic a continuation even when it is the weak one', () => {
      const recs = recommendNext(topicsFor(struggling('contains-duplicate', null, 'help')))
      expect(recs[0].reason).toBe('continue')
    })

    it('leaves a strong active topic to the later slots', () => {
      const strong = topicsFor({ ...solved('arrays-hashing', 3), ...solved('two-pointers', 1) })
      const recs = recommendNext(strong)
      expect(recs.map((r) => r.reason)).not.toContain('weak-area')
      expect(slugs(recs).slice(0, 3)).toEqual(PROBLEMS_BY_TOPIC['arrays-hashing'].slice(3, 6).map((p) => p.slug))
      expect(recs[3]).toMatchObject({ problem: PROBLEMS_BY_TOPIC['two-pointers'][1], reason: 'continue' })
    })
  })

  describe('limits', () => {
    it('holds each open topic to three while the list is full', () => {
      // Arrays is the only open topic until it is done, so use a case with two open topics.
      const recs = recommendNext(topicsFor({ ...solved('arrays-hashing'), ...solved('two-pointers', 3) }), 6)
      const perTopic = new Map<TopicId, number>()
      for (const r of recs) perTopic.set(r.problem.topic, (perTopic.get(r.problem.topic) ?? 0) + 1)
      expect(Math.max(...perTopic.values())).toBe(MAX_PER_TOPIC)
      expect(new Set(slugs(recs)).size).toBe(recs.length)
    })

    it('lifts the cap once the open topics are all that is left, never reaching for ahead topics', () => {
      const recs = recommendNext(topicsFor({}), 1000)
      // Only Arrays & Hashing is open: all nine of its problems, in order, and no explore picks.
      expect(slugs(recs)).toEqual(PROBLEMS_BY_TOPIC['arrays-hashing'].map((p) => p.slug))
      expect(recs.every((r) => r.reason === 'new-topic')).toBe(true)
    })

    it('takes more from a lone open topic with fewer than six problems left', () => {
      // Five left in Arrays & Hashing; Two Pointers etc. are still ahead.
      const topics = topicsFor(solved('arrays-hashing', 4))
      expect(topics['two-pointers'].state).toBe('ahead')
      const recs = recommendNext(topics)
      expect(slugs(recs)).toEqual(PROBLEMS_BY_TOPIC['arrays-hashing'].slice(4).map((p) => p.slug))
      expect(recs.map((r) => r.reason)).toEqual(Array(5).fill('continue'))
    })

    it('lifts the cap in order: the focus topic, other active topics, then ready topics', () => {
      // Two Pointers is the focus (2 left), Stack is active (6 left); Sliding Window, Binary Search
      // and Linked List are ready. The capped pass yields 2 + 3 + 3 + 3 + 3 = 14.
      const topics = topicsFor({ ...solved('arrays-hashing'), ...solved('two-pointers', 3), ...solved('stack', 1) })
      const recs = recommendNext(topics, 20)
      const group = (from: number, to: number) => recs.slice(from, to).map((r) => [r.problem.topic, r.reason])
      expect(group(0, 5)).toEqual([
        ['two-pointers', 'continue'],
        ['two-pointers', 'continue'],
        ['stack', 'continue'],
        ['stack', 'continue'],
        ['stack', 'continue'],
      ])
      expect(recs.slice(5, 14).every((r) => r.reason === 'new-topic')).toBe(true)
      // Then the cap comes off: the rest of Stack (active) before more of the ready topics.
      expect(group(14, 17)).toEqual(Array(3).fill(['stack', 'continue']))
      expect(group(17, 20)).toEqual(Array(3).fill(['sliding-window', 'new-topic']))
      expect(recs.filter((r) => r.problem.topic === 'stack')).toHaveLength(6)
      expect(new Set(slugs(recs)).size).toBe(recs.length)
    })

    it('honors a smaller or zero limit', () => {
      const topics = topicsFor({})
      expect(recommendNext(topics, 2)).toHaveLength(2)
      expect(recommendNext(topics, 0)).toEqual([])
    })

    it('defaults to six', () => {
      expect(recommendNext(topicsFor({ ...solved('arrays-hashing', 2) }))).toHaveLength(6)
    })

    it('never looks ahead while any open topic has a problem left', () => {
      const topics = topicsFor({ ...solved('arrays-hashing') })
      const recs = recommendNext(topics, 1000)
      expect(recs.map((r) => r.reason)).not.toContain('explore')
      expect(recs.every((r) => topics[r.problem.topic].state === 'ready')).toBe(true)
    })

    it('looks ahead, three per topic, only when nothing at all is open', () => {
      const topics = topicsFor({})
      const closed = { ...topics }
      for (const id of ROADMAP_ORDER) closed[id] = { ...topics[id], state: 'ahead' }
      const recs = recommendNext(closed, 1000)
      expect(recs).toHaveLength(ROADMAP_ORDER.length * MAX_PER_TOPIC)
      expect(recs.every((r) => r.reason === 'explore')).toBe(true)
      expect(recs[0].problem.topic).toBe('arrays-hashing')
      expect(recs[0].note).toBe('Looking ahead · Arrays & Hashing')
      expect(new Set(slugs(recs)).size).toBe(recs.length)
    })
  })

  it('offers nothing once every problem is solved', () => {
    const history: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS) history[p.slug] = [attempt('2026-11-01', 'easy')]
    expect(recommendNext(topicsFor(history))).toEqual([])
  })

  it('never recommends a solved problem', () => {
    const history = { ...solved('arrays-hashing', 4), ...solved('two-pointers', 2) }
    const done = new Set(Object.keys(history))
    expect(recommendNext(topicsFor(history), 1000).every((r) => !done.has(r.problem.slug))).toBe(true)
  })
})

describe('buildSuggestion', () => {
  const queueWith = (over: Partial<ReviewQueue> = {}): ReviewQueue => ({
    cap: 5,
    doneToday: 0,
    today: [],
    waiting: [],
    totalDue: 0,
    ...over,
  })
  const countsWith = (over: Partial<Counts> = {}): Counts => ({
    total: 150,
    solved: 12,
    mastered: 0,
    learning: 12,
    due: 0,
    todo: 138,
    ...over,
  })
  const dueViews = (n: number) =>
    PROBLEMS.slice(0, n).map((p) => viewOf(p.slug, [attempt('2026-10-01', 'easy')], TODAY))

  function suggest(
    history: Record<string, Attempt[]>,
    over: { queue?: Partial<ReviewQueue>; counts?: Partial<Counts>; drill?: DrillStats } = {},
  ) {
    const topics = topicsFor(history)
    return buildSuggestion({
      topics,
      queue: queueWith(over.queue),
      counts: countsWith(over.counts),
      drill: over.drill ?? drillStats(),
      recommendations: recommendNext(topics),
    })
  }

  /** Real topics with one topic's strength and confidence overridden. */
  function suggestWith(overrides: Partial<Record<TopicId, Partial<TopicView>>>, over: Parameters<typeof suggest>[1] = {}) {
    const history = { ...solved('arrays-hashing', 2), ...solved('two-pointers', 1) }
    const topics = { ...topicsFor(history) }
    for (const id of Object.keys(overrides) as TopicId[]) topics[id] = { ...topics[id], ...overrides[id] }
    return buildSuggestion({
      topics,
      queue: queueWith(over.queue),
      counts: countsWith(over.counts),
      drill: over.drill ?? drillStats(),
      recommendations: recommendNext(topics),
    })
  }

  describe('start', () => {
    it('begins at base camp when nothing is solved', () => {
      const s = suggest({}, { counts: { solved: 0, learning: 0, todo: 150 } })
      expect(s).toMatchObject({
        kind: 'start',
        topic: 'arrays-hashing',
        problem: PROBLEMS_BY_TOPIC['arrays-hashing'][0],
        headline: 'Start at base camp: Arrays & Hashing.',
      })
      expect(s.detail).toContain('Contains Duplicate')
    })

    it('comes before everything else', () => {
      const drill = drillStats({ hashing: { seen: 5, correct: 0 } })
      const s = suggest({}, { counts: { solved: 0 }, queue: { waiting: dueViews(6), totalDue: 6 }, drill })
      expect(s.kind).toBe('start')
    })
  })

  describe('summit', () => {
    it('is reached when everything is solved and mastered', () => {
      const s = suggest({}, { counts: { solved: 150, mastered: 150, learning: 0, todo: 0 } })
      expect(s).toMatchObject({ kind: 'summit', topic: null, problem: null, headline: 'You have reached the summit.' })
      expect(s.detail).toContain('150')
    })

    it('is not reached while any problem is only solved', () => {
      const s = suggest({}, { counts: { solved: 150, mastered: 149, learning: 1, todo: 0 } })
      expect(s.kind).not.toBe('summit')
    })
  })

  describe('shore-up', () => {
    it('names an explored topic under 50, with the reason and the number', () => {
      // Four attempts that needed help: medium confidence, strength 15.
      const history: Record<string, Attempt[]> = {}
      PROBLEMS_BY_TOPIC['two-pointers'].slice(0, 4).forEach((p) => {
        history[p.slug] = [attempt('2026-11-01', 'help')]
      })
      const s = suggest({ ...solved('arrays-hashing'), ...history })
      expect(s).toMatchObject({ kind: 'shore-up', topic: 'two-pointers', headline: 'Shore up Two Pointers.' })
      expect(s.detail).toBe('Strength is 15, and recent ratings average 15%.')
      expect(s.problem?.topic).toBe('two-pointers')
    })

    it('waits for at least medium confidence', () => {
      const lowEvidence = { 'valid-palindrome': [attempt('2026-11-01', 'help')] }
      expect(suggest({ ...solved('arrays-hashing'), ...lowEvidence }).kind).toBe('advance')
    })

    it('uses the same weak line as the Insights chart: 55 is fine and 54 is weak', () => {
      const at = (strength: number) => suggestWith({ 'two-pointers': { strength, confidence: 'medium' } })
      expect(SHORE_UP_BELOW).toBe(WEAK_BELOW)
      expect(at(WEAK_BELOW).kind).not.toBe('shore-up')
      expect(at(WEAK_BELOW - 1).kind).toBe('shore-up')
      // What the headline calls weak (Linked List at 52) is what the card works on.
      expect(at(52)).toMatchObject({ kind: 'shore-up', topic: 'two-pointers' })
    })

    it('says the route\'s revisions come first when some are still to do', () => {
      const s = suggestWith(
        { 'two-pointers': { strength: 30, confidence: 'high' } },
        { queue: { today: dueViews(3), waiting: dueViews(8), totalDue: 11 } },
      )
      expect(s.kind).toBe('shore-up')
      expect(s.detail).toMatch(/The 3 revisions in today's route come first\.$/)
      const none = suggestWith({ 'two-pointers': { strength: 30, confidence: 'high' } })
      expect(none.detail).not.toMatch(/come first/)
    })

    it('ignores an unexplored topic', () => {
      expect(suggestWith({ 'two-pointers': { strength: null, confidence: 'none' } }).kind).not.toBe('shore-up')
    })

    it('picks the lowest score, and the earlier topic on a tie', () => {
      const weak = (strength: number) => ({ strength, confidence: 'high' as const })
      expect(suggestWith({ 'arrays-hashing': weak(30), 'two-pointers': weak(20) }).topic).toBe('two-pointers')
      expect(suggestWith({ 'arrays-hashing': weak(30), 'two-pointers': weak(30) }).topic).toBe('arrays-hashing')
    })

    it('takes precedence over a full revision queue', () => {
      const s = suggestWith(
        { 'two-pointers': { strength: 30, confidence: 'high' } },
        { queue: { waiting: dueViews(8), totalDue: 8 } },
      )
      expect(s.kind).toBe('shore-up')
    })

    it('sends you to the shakiest solved problem of the topic', () => {
      const [a, b] = PROBLEMS_BY_TOPIC['two-pointers']
      const history = {
        [a.slug]: [attempt('2026-11-01', 'easy')],
        [b.slug]: [attempt('2026-11-01', 'help')],
      }
      const topics = { ...topicsFor(history) }
      topics['two-pointers'] = { ...topics['two-pointers'], strength: 30, confidence: 'high' }
      const s = buildSuggestion({
        topics,
        queue: queueWith(),
        counts: countsWith(),
        drill: drillStats(),
        recommendations: [],
      })
      expect(s.problem).toBe(b)
    })
  })

  describe('revise', () => {
    it('starts with today\'s revisions when more are waiting than one day allows', () => {
      const s = suggest(solved('arrays-hashing', 2), {
        queue: { cap: 5, today: dueViews(5), waiting: dueViews(6), totalDue: 11 },
      })
      expect(s).toMatchObject({ kind: 'revise', topic: null, headline: "Start with today's revisions." })
      expect(s.detail).toBe(
        "5 revisions in today's route. 6 more are due beyond the day's limit of 5; they come up over the next days.",
      )
      expect(s.problem?.slug).toBe(PROBLEMS[0].slug)
    })

    it('never says to clear the queue and never fires once the day\'s cap is done', () => {
      const done = suggest(solved('arrays-hashing', 2), {
        queue: { cap: 5, doneToday: 5, today: [], waiting: dueViews(14), totalDue: 14 },
      })
      expect(done.kind).toBe('advance')
      expect(done.headline).not.toMatch(/clear/i)
      expect(done.detail).toMatch(/14 more revisions come up over the next days\.$/)
      expect(done.detail).not.toMatch(/limit|overdue|late/i)
    })

    it('agrees with the stored route: only its revisions still to do count', () => {
      const topics = topicsFor(solved('arrays-hashing', 2))
      const [a, b] = PROBLEMS
      const session = (doneA: boolean, doneB: boolean): SessionView => ({
        budget: 60,
        plannedMinutes: 30,
        doneCount: 0,
        nextIndex: 0,
        items: [
          { kind: 'drill', minutes: 5, reason: 'Warm-up', done: false, problem: null },
          { kind: 'review', slug: a.slug, minutes: 10, reason: 'Due today', done: doneA, problem: a },
          { kind: 'review', slug: b.slug, minutes: 10, reason: 'Due today', done: doneB, problem: b },
        ],
      })
      const base = {
        topics,
        queue: queueWith({ cap: 5, today: dueViews(5), waiting: dueViews(9), totalDue: 14 }),
        counts: countsWith(),
        drill: drillStats(),
        recommendations: recommendNext(topics),
      }
      const partway = buildSuggestion({ ...base, session: session(true, false) })
      expect(partway).toMatchObject({ kind: 'revise', headline: "Start with today's revisions." })
      expect(partway.problem?.slug).toBe(b.slug)
      expect(partway.detail).toMatch(/^1 revision in today's route\./)
      // Every revision in the route is done: the card moves on to the next thing.
      expect(buildSuggestion({ ...base, session: session(true, true) }).kind).toBe('advance')
    })

    it('does not trigger when the waiting list only equals the cap', () => {
      const s = suggest(solved('arrays-hashing', 2), {
        queue: { cap: 5, today: dueViews(5), waiting: dueViews(5), totalDue: 10 },
      })
      expect(s.kind).toBe('advance')
    })

    it('beats a weak drill pattern', () => {
      const drill = drillStats({ hashing: { seen: 5, correct: 0 } })
      const s = suggest(solved('arrays-hashing', 2), {
        queue: { cap: 2, today: dueViews(2), waiting: dueViews(3), totalDue: 5 },
        drill,
      })
      expect(s.kind).toBe('revise')
    })
  })

  describe('drill', () => {
    const history = solved('arrays-hashing', 2)

    it('picks a pattern seen three or more times under 50%', () => {
      const s = suggest(history, { drill: drillStats({ 'sliding-window': { seen: 3, correct: 1 } }) })
      expect(s).toMatchObject({ kind: 'drill', topic: 'sliding-window', problem: null })
      expect(s.headline).toBe('Drill Sliding window.')
      expect(s.detail).toBe('You picked it 1 of 3 times (33%).')
    })

    it('needs three cards before it counts', () => {
      expect(suggest(history, { drill: drillStats({ hashing: { seen: 2, correct: 0 } }) }).kind).toBe('advance')
    })

    it('treats exactly 50% as fine', () => {
      expect(suggest(history, { drill: drillStats({ hashing: { seen: 4, correct: 2 } }) }).kind).toBe('advance')
    })

    it('picks the lowest accuracy, then the one seen more often', () => {
      const lowest = suggest(history, {
        drill: drillStats({ hashing: { seen: 4, correct: 1 }, stack: { seen: 5, correct: 0 } }),
      })
      expect(lowest.topic).toBe('stack')
      const tie = suggest(history, {
        drill: drillStats({ hashing: { seen: 4, correct: 1 }, stack: { seen: 8, correct: 2 } }),
      })
      expect(tie.topic).toBe('stack')
    })
  })

  describe('advance', () => {
    it('otherwise follows the first recommendation', () => {
      const topics = topicsFor({ ...solved('arrays-hashing'), ...solved('two-pointers', 3) })
      const recommendations = recommendNext(topics)
      const s = buildSuggestion({ topics, queue: queueWith(), counts: countsWith(), drill: drillStats(), recommendations })
      expect(s).toMatchObject({
        kind: 'advance',
        topic: 'two-pointers',
        problem: recommendations[0].problem,
        headline: `Next up: ${titleOf('container-with-most-water')}.`,
      })
      expect(s.detail).toBe('You are 3 of 5 through Two Pointers, and Container With Most Water is the next one on the route.')
    })

    it('explains a weak area and a look ahead', () => {
      const topics = topicsFor({ ...solved('arrays-hashing', 3) })
      const rec = (reason: Recommendation['reason'], topic: TopicId): Recommendation => ({
        problem: PROBLEMS_BY_TOPIC[topic][0],
        reason,
        note: '',
      })
      const detailOf = (recommendation: Recommendation) =>
        buildSuggestion({
          topics,
          queue: queueWith(),
          counts: countsWith(),
          drill: drillStats(),
          recommendations: [recommendation],
        }).detail
      expect(detailOf(rec('weak-area', 'stack'))).toBe('Stack is under 55, so it gets a turn before you move on.')
      expect(detailOf(rec('explore', 'trees'))).toBe('Nothing else is open on the route, so this looks ahead to Trees.')
    })

    it('explains a new topic', () => {
      const topics = topicsFor({})
      const s = buildSuggestion({
        topics,
        queue: queueWith(),
        counts: countsWith(),
        drill: drillStats(),
        recommendations: recommendNext(topics),
      })
      expect(s.kind).toBe('advance')
      expect(s.detail).toBe('Arrays & Hashing is next on the roadmap: 9 problems, none started.')
    })
  })

  describe('when every problem is solved but not all mastered', () => {
    const all: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS) all[p.slug] = [attempt('2026-11-01', 'easy')]
    const done = { counts: { solved: 150, mastered: 10, learning: 140, todo: 0 } }

    it('turns to the revisions that are due', () => {
      const s = suggest(all, { ...done, queue: { today: dueViews(3), totalDue: 3 } })
      expect(s).toMatchObject({ kind: 'revise', headline: 'Revise 3 problems today.' })
      expect(s.detail).toBe('Every problem is solved; 3 are due for another look.')
    })

    it('suggests a drill when nothing is due today', () => {
      const s = suggest(all, done)
      expect(s).toMatchObject({ kind: 'drill', topic: null, problem: null })
    })
  })
})

describe('recommendNext edge cases', () => {
  it('treats a negative or fractional limit sensibly', () => {
    const topics = topicsFor({})
    expect(recommendNext(topics, -3)).toEqual([])
    expect(recommendNext(topics, 1)).toHaveLength(1)
  })

  it('returns only what exists when the limit is larger than the list', () => {
    // One problem left in the whole set.
    const history: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS.slice(0, -1)) history[p.slug] = [attempt('2026-11-01', 'easy')]
    const recs = recommendNext(topicsFor(history), 50)
    expect(slugs(recs)).toEqual([PROBLEMS[PROBLEMS.length - 1].slug])
    expect(recs[0].reason).toBe('continue')
  })

  it('does not change the topic views it is given', () => {
    const topics = topicsFor({ ...solved('arrays-hashing', 3), ...solved('stack', 1, 'help') })
    const before = JSON.stringify(topics)
    recommendNext(topics)
    expect(JSON.stringify(topics)).toBe(before)
  })

  it('gives the same list twice', () => {
    const topics = topicsFor({ ...solved('arrays-hashing', 3), ...solved('stack', 1, 'help') })
    expect(recommendNext(topics)).toEqual(recommendNext(topics))
  })

  it('lists a weak topic once as weak, then carries on with it as an ordinary continuation', () => {
    const topics = topicsFor({ ...solved('arrays-hashing', 3), ...solved('stack', 1, 'help') })
    const recs = recommendNext(topics, 1000)
    const stack = recs.filter((r) => r.problem.topic === 'stack')
    // One solved of seven: the weak slot, then the other five as continuations (cap lifted).
    expect(stack.map((r) => r.reason)).toEqual(['weak-area', ...Array(5).fill('continue')])
    expect(new Set(slugs(recs)).size).toBe(recs.length)
  })

  it('reads a realistic few weeks: finish the base, then follow the newest active topic', () => {
    const history: Record<string, Attempt[]> = {
      ...solved('arrays-hashing'),
      ...solved('two-pointers', 4),
      ...solved('stack', 2),
      ...solved('sliding-window', 1),
    }
    const recs = recommendNext(topicsFor(history))
    // Two Pointers comes first in the roadmap; strong ratings mean no weak-area slots.
    expect(recs.map((r) => r.reason)).not.toContain('weak-area')
    expect(slugs(recs)).toEqual([
      PROBLEMS_BY_TOPIC['two-pointers'][4].slug,
      ...PROBLEMS_BY_TOPIC.stack.slice(2, 5).map((p) => p.slug),
      ...PROBLEMS_BY_TOPIC['sliding-window'].slice(1, 3).map((p) => p.slug),
    ])
    expect(recs[0].note).toBe('Continue Two Pointers · 4 of 5')
    expect(recs).toHaveLength(MAX_RECOMMENDATIONS)
  })
})

describe('buildSuggestion edge cases', () => {
  const queueWith = (over: Partial<ReviewQueue> = {}): ReviewQueue => ({
    cap: 5,
    doneToday: 0,
    today: [],
    waiting: [],
    totalDue: 0,
    ...over,
  })
  const countsWith = (over: Partial<Counts> = {}): Counts => ({
    total: 150,
    solved: 12,
    mastered: 0,
    learning: 12,
    due: 0,
    todo: 138,
    ...over,
  })
  const dueViews = (n: number) =>
    PROBLEMS.slice(0, n).map((p) => viewOf(p.slug, [attempt('2026-10-01', 'easy')], TODAY))

  function suggest(
    history: Record<string, Attempt[]>,
    over: { queue?: Partial<ReviewQueue>; counts?: Partial<Counts>; drill?: DrillStats } = {},
  ) {
    const topics = topicsFor(history)
    return buildSuggestion({
      topics,
      queue: queueWith(over.queue),
      counts: countsWith(over.counts),
      drill: over.drill ?? drillStats(),
      recommendations: recommendNext(topics),
    })
  }

  it('starts with the revisions with a daily cap of 1 once two are waiting, not one', () => {
    const history = solved('arrays-hashing', 2)
    expect(suggest(history, { queue: { cap: 1, today: dueViews(1), waiting: dueViews(1), totalDue: 2 } }).kind).toBe(
      'advance',
    )
    expect(suggest(history, { queue: { cap: 1, today: dueViews(1), waiting: dueViews(2), totalDue: 3 } }).kind).toBe(
      'revise',
    )
  })

  it('starts with the revisions with a daily cap of 30 only past thirty waiting', () => {
    const history = solved('arrays-hashing', 2)
    const waiting = (n: number) => ({ cap: 30, today: dueViews(30), waiting: dueViews(n), totalDue: 30 + n })
    expect(suggest(history, { queue: waiting(30) }).kind).toBe('advance')
    expect(suggest(history, { queue: waiting(31) }).kind).toBe('revise')
  })

  it('moves on to the next suggestion when the day is already full but a backlog remains', () => {
    const s = suggest(solved('arrays-hashing', 2), {
      queue: { cap: 2, doneToday: 2, today: [], waiting: dueViews(3), totalDue: 3 },
    })
    expect(s.kind).toBe('advance')
    expect(s.problem).not.toBeNull()
  })

  it('reaches the summit before it looks at a weak topic or a backlog', () => {
    const topics = { ...topicsFor({}) }
    topics['two-pointers'] = { ...topics['two-pointers'], strength: 10, confidence: 'high' }
    const s = buildSuggestion({
      topics,
      queue: queueWith({ cap: 1, waiting: dueViews(5), totalDue: 5 }),
      counts: countsWith({ solved: 150, mastered: 150, learning: 0, todo: 0 }),
      drill: drillStats({ hashing: { seen: 9, correct: 0 } }),
      recommendations: [],
    })
    expect(s.kind).toBe('summit')
  })

  it('does not call an empty set of problems a summit', () => {
    const s = buildSuggestion({
      topics: topicsFor({}),
      queue: queueWith(),
      counts: countsWith({ total: 0, solved: 0, mastered: 0, learning: 0, todo: 0 }),
      drill: drillStats(),
      recommendations: [],
    })
    expect(s.kind).toBe('start')
  })

  it('rounds the drill percentage up at a true half', () => {
    // 57 of 200 is 28.5%, which floating point computes as 28.499999999999996.
    const s = suggest(solved('arrays-hashing', 2), { drill: drillStats({ hashing: { seen: 200, correct: 57 } }) })
    expect(s.detail).toBe('You picked it 57 of 200 times (29%).')
  })

  it('is deterministic and leaves its input alone', () => {
    const topics = topicsFor({ ...solved('arrays-hashing', 3), ...solved('stack', 1, 'help') })
    const input = {
      topics,
      queue: queueWith(),
      counts: countsWith(),
      drill: drillStats({ hashing: { seen: 5, correct: 1 } }),
      recommendations: recommendNext(topics),
    }
    const before = JSON.stringify(input)
    const first = buildSuggestion(input)
    expect(buildSuggestion(input)).toEqual(first)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('says so when the day is full but every problem is solved and a backlog waits', () => {
    const all: Record<string, Attempt[]> = {}
    for (const p of PROBLEMS) all[p.slug] = [attempt('2026-11-01', 'easy')]
    const s = suggest(all, {
      counts: { solved: 150, mastered: 10, learning: 140, todo: 0 },
      queue: { cap: 5, doneToday: 5, today: [], waiting: dueViews(3), totalDue: 3 },
    })
    expect(s.kind).toBe('drill')
    expect(s.detail).toBe("Every problem is solved and today's revisions are done; 3 more can wait for tomorrow.")
  })

  it('shores up the weakest of several explored topics over a multi-week history', () => {
    const history: Record<string, Attempt[]> = {
      ...solved('arrays-hashing', 9, 'easy', { minutes: 10 }),
    }
    for (const p of PROBLEMS_BY_TOPIC['two-pointers']) {
      history[p.slug] = [attempt('2026-10-20', 'struggled', { minutes: 40 }), attempt('2026-10-27', 'help')]
    }
    const s = suggest(history)
    expect(s).toMatchObject({ kind: 'shore-up', topic: 'two-pointers' })
    expect(s.problem?.topic).toBe('two-pointers')
  })
})
