import { describe, expect, it } from 'vitest'
import { getProblem, PATTERN_BY_ID, PATTERNS, PROBLEMS, TOPIC_BY_ID, TOPICS } from '../data'
import type { PatternId, Problem } from '../data/types'
import type { DrillResult } from '../state/schema'
import {
  buildDrillStats,
  DRILL_DECK_SIZES,
  DRILL_OPTION_COUNT,
  drillOptions,
  nextDrillCard,
  patternWeight,
} from './drill'
import { mulberry32 } from './rng'
import type { PatternStat } from './types'

const TODAY = '2026-11-12'

function fake(slug: string, pattern: PatternId, over: Partial<Problem> = {}): Problem {
  return {
    slug,
    id: slug,
    number: 1,
    title: slug,
    difficulty: 'easy',
    topic: PATTERN_BY_ID[pattern].topic,
    premium: false,
    tags: [],
    pattern,
    summary: 'Asks for something.',
    clue: 'A clue.',
    decoys: [],
    order: 1,
    indexInTopic: 1,
    url: '',
    videoUrl: null,
    ...over,
  }
}

let at = 0
function result(
  answer: PatternId,
  picked: PatternId,
  extra: Partial<DrillResult> = {},
): DrillResult {
  at += 1
  return { at, date: TODAY, slug: PROBLEMS[0].slug, answer, picked, correct: answer === picked, ms: 4000, ...extra }
}

function statOf(pattern: PatternId, seen: number, correct: number): PatternStat {
  return {
    pattern: PATTERN_BY_ID[pattern],
    seen,
    correct,
    accuracy: seen ? correct / seen : null,
    confusedWith: [],
  }
}

describe('constants', () => {
  it('offers four options and three deck sizes', () => {
    expect(DRILL_OPTION_COUNT).toBe(4)
    expect(DRILL_DECK_SIZES).toEqual([10, 20, 40])
  })
})

describe('buildDrillStats', () => {
  it('is empty with no drills', () => {
    const s = buildDrillStats([], TODAY)
    expect(s.total).toBe(0)
    expect(s.correct).toBe(0)
    expect(s.accuracy).toBeNull()
    expect(s.today).toBe(0)
    expect(s.weakest).toEqual([])
    expect(s.byPattern).toHaveLength(PATTERNS.length)
    expect(s.byPattern.every((p) => p.seen === 0 && p.accuracy === null && p.confusedWith.length === 0)).toBe(true)
    expect(TOPICS.every((t) => s.byTopic[t.id].seen === 0)).toBe(true)
  })

  it('lists patterns in PATTERNS order', () => {
    const s = buildDrillStats([result('trie', 'trie')], TODAY)
    expect(s.byPattern.map((p) => p.pattern.id)).toEqual(PATTERNS.map((p) => p.id))
  })

  it('totals cards and accuracy', () => {
    const s = buildDrillStats(
      [result('hashing', 'hashing'), result('hashing', 'stack'), result('heap', 'heap'), result('heap', 'heap')],
      TODAY,
    )
    expect(s.total).toBe(4)
    expect(s.correct).toBe(3)
    expect(s.accuracy).toBe(0.75)
  })

  it('counts only cards dated today', () => {
    const s = buildDrillStats(
      [
        result('hashing', 'hashing', { date: '2026-11-11' }),
        result('hashing', 'hashing'),
        result('heap', 'stack'),
        result('heap', 'heap', { date: '2026-11-13' }),
      ],
      TODAY,
    )
    expect(s.today).toBe(2)
    expect(s.total).toBe(4)
  })

  it('tracks each pattern by its correct answer', () => {
    const s = buildDrillStats(
      [result('hashing', 'hashing'), result('hashing', 'stack'), result('hashing', 'stack'), result('stack', 'stack')],
      TODAY,
    )
    const hashing = s.byPattern.find((p) => p.pattern.id === 'hashing')!
    expect(hashing.seen).toBe(3)
    expect(hashing.correct).toBe(1)
    expect(hashing.accuracy).toBeCloseTo(1 / 3)
    const stack = s.byPattern.find((p) => p.pattern.id === 'stack')!
    expect(stack.seen).toBe(1)
    expect(stack.accuracy).toBe(1)
  })

  it('names the wrong picks, most common first, at most three', () => {
    const wrong: PatternId[] = ['stack', 'heap', 'heap', 'greedy', 'greedy', 'greedy', 'trie']
    const drills = [result('hashing', 'hashing'), ...wrong.map((p) => result('hashing', p))]
    const confused = buildDrillStats(drills, TODAY).byPattern.find((p) => p.pattern.id === 'hashing')!.confusedWith
    expect(confused).toEqual([
      { pattern: 'greedy', count: 3 },
      { pattern: 'heap', count: 2 },
      { pattern: 'stack', count: 1 },
    ])
  })

  it('has no confusions for a pattern that is always right', () => {
    const s = buildDrillStats([result('trie', 'trie'), result('trie', 'trie')], TODAY)
    expect(s.byPattern.find((p) => p.pattern.id === 'trie')!.confusedWith).toEqual([])
  })

  it('files cards under the topic of the problem shown', () => {
    const tree = PROBLEMS.find((p) => p.topic === 'trees')!
    const s = buildDrillStats(
      [
        result('tree-dfs', 'tree-dfs', { slug: tree.slug }),
        result('tree-dfs', 'bst', { slug: tree.slug }),
        result('hashing', 'hashing'),
      ],
      TODAY,
    )
    expect(s.byTopic.trees).toEqual({ seen: 2, correct: 1 })
    expect(s.byTopic['arrays-hashing']).toEqual({ seen: 1, correct: 1 })
    expect(s.byTopic.heap).toEqual({ seen: 0, correct: 0 })
  })

  it('falls back to the home topic of the pattern when the problem is gone', () => {
    const s = buildDrillStats([result('trie', 'trie', { slug: 'no-such-problem' })], TODAY)
    expect(s.byTopic.tries).toEqual({ seen: 1, correct: 1 })
  })

  it('has an entry for every topic', () => {
    const s = buildDrillStats([], TODAY)
    expect(Object.keys(s.byTopic).sort()).toEqual(TOPICS.map((t) => t.id).sort())
  })

  describe('weakest', () => {
    const cards = (answer: PatternId, right: number, wrong: number) => [
      ...Array.from({ length: right }, () => result(answer, answer)),
      ...Array.from({ length: wrong }, () => result(answer, answer === 'stack' ? 'heap' : 'stack')),
    ]

    it('needs three sightings', () => {
      const s = buildDrillStats([...cards('hashing', 0, 2), ...cards('trie', 1, 2)], TODAY)
      expect(s.weakest.map((p) => p.pattern.id)).toEqual(['trie'])
    })

    it('puts the lowest accuracy first', () => {
      const s = buildDrillStats([...cards('hashing', 2, 1), ...cards('trie', 0, 3), ...cards('heap', 1, 2)], TODAY)
      expect(s.weakest.map((p) => p.pattern.id)).toEqual(['trie', 'heap', 'hashing'])
    })

    it('breaks a tie in favor of the pattern seen more often, then the pattern order', () => {
      const s = buildDrillStats(
        [...cards('heap', 1, 2), ...cards('hashing', 2, 4), ...cards('trie', 1, 2)],
        TODAY,
      )
      expect(s.weakest.map((p) => p.pattern.id)).toEqual(['hashing', 'trie', 'heap'])
    })

    it('keeps the five weakest', () => {
      const ids: PatternId[] = ['hashing', 'two-pointers', 'trie', 'heap', 'greedy', 'math', 'design']
      const drills = ids.flatMap((id, i) => cards(id, i, 3))
      const s = buildDrillStats(drills, TODAY)
      expect(s.weakest).toHaveLength(5)
      expect(s.weakest.map((p) => p.pattern.id)).toEqual(['hashing', 'two-pointers', 'trie', 'heap', 'greedy'])
    })

    it('never calls a pattern weak that the user gets right, however few are tested', () => {
      expect(buildDrillStats(cards('hashing', 3, 0), TODAY).weakest).toEqual([])
      // 4 of 5 is exactly 80%: fine. 3 of 4 is 75%: weak.
      expect(buildDrillStats(cards('hashing', 4, 1), TODAY).weakest).toEqual([])
      expect(buildDrillStats(cards('hashing', 3, 1), TODAY).weakest.map((p) => p.pattern.id)).toEqual(['hashing'])
    })

    it('leaves perfect patterns out while a missed one is listed', () => {
      const s = buildDrillStats([...cards('hashing', 5, 0), ...cards('trie', 1, 2), ...cards('heap', 3, 0)], TODAY)
      expect(s.weakest.map((p) => p.pattern.id)).toEqual(['trie'])
    })
  })

  it('counts a folded archive exactly as it would count the results themselves', () => {
    const hit = (n: number) => result('hashing', 'hashing', { at: n })
    const miss = (n: number) => result('hashing', 'stack', { at: n })
    const all = [hit(1), miss(2), hit(3), miss(4), miss(5), result('heap', 'heap', { at: 6 })]
    const whole = buildDrillStats(all, TODAY)
    // The first four results folded away; only the last two are kept as they are.
    const archive = [
      { topic: 'arrays-hashing' as const, answer: 'hashing' as const, picked: 'hashing' as const, correct: true, count: 2 },
      { topic: 'arrays-hashing' as const, answer: 'hashing' as const, picked: 'stack' as const, correct: false, count: 2 },
    ]
    const folded = buildDrillStats(all.slice(4), TODAY, archive)
    expect(folded.total).toBe(whole.total)
    expect(folded.correct).toBe(whole.correct)
    expect(folded.accuracy).toBe(whole.accuracy)
    expect(folded.byTopic).toEqual(whole.byTopic)
    expect(folded.byPattern.map((p) => [p.pattern.id, p.seen, p.correct, p.confusedWith])).toEqual(
      whole.byPattern.map((p) => [p.pattern.id, p.seen, p.correct, p.confusedWith]),
    )
    // Folded answers are never "today", whatever their date was.
    expect(folded.today).toBe(whole.today - 4)
  })

  it('does not change the list it is given', () => {
    const drills = Object.freeze([result('hashing', 'stack'), result('heap', 'heap')])
    expect(() => buildDrillStats(drills, TODAY)).not.toThrow()
    expect(drills.map((d) => d.answer)).toEqual(['hashing', 'heap'])
  })

  it('still counts a card whose answer is no longer a known pattern', () => {
    const s = buildDrillStats([result('retired' as PatternId, 'hashing', { slug: 'no-such-problem' })], TODAY)
    expect(s.total).toBe(1)
    expect(s.correct).toBe(0)
    expect(s.byPattern.every((p) => p.seen === 0)).toBe(true)
    expect(TOPICS.every((t) => s.byTopic[t.id].seen === 0)).toBe(true)
  })

  it('counts every card of a day, however many answer the same problem', () => {
    const drills = Array.from({ length: 12 }, () => result('hashing', 'hashing'))
    const s = buildDrillStats(drills, TODAY)
    expect(s.today).toBe(12)
    expect(s.accuracy).toBe(1)
    expect(s.byPattern.find((p) => p.pattern.id === 'hashing')!.seen).toBe(12)
  })

  it('has accuracy 0, not null, when every card was wrong', () => {
    const s = buildDrillStats([result('hashing', 'stack')], TODAY)
    expect(s.accuracy).toBe(0)
    expect(s.byPattern.find((p) => p.pattern.id === 'hashing')!.accuracy).toBe(0)
  })

  it('summarizes a realistic month of cards', () => {
    const drills: DrillResult[] = []
    const days = ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', TODAY]
    days.forEach((date, week) => {
      // Hash maps get easier each week; heaps stay hard.
      for (let i = 0; i < 4; i++) drills.push(result('hashing', week > i ? 'hashing' : 'stack', { date }))
      for (let i = 0; i < 2; i++) drills.push(result('heap', i === 0 && week === 4 ? 'heap' : 'two-heaps', { date }))
    })
    const s = buildDrillStats(drills, TODAY)
    expect(s.total).toBe(30)
    expect(s.today).toBe(6)
    const hashing = s.byPattern.find((p) => p.pattern.id === 'hashing')!
    expect(hashing.seen).toBe(20)
    expect(hashing.correct).toBe(10)
    expect(hashing.confusedWith).toEqual([{ pattern: 'stack', count: 10 }])
    const heap = s.byPattern.find((p) => p.pattern.id === 'heap')!
    expect(heap.correct).toBe(1)
    expect(heap.confusedWith).toEqual([{ pattern: 'two-heaps', count: 9 }])
    expect(s.weakest.map((p) => p.pattern.id)).toEqual(['heap', 'hashing'])
  })
})

describe('drillOptions', () => {
  const rng = () => mulberry32(7)

  it('returns four distinct patterns including the answer', () => {
    for (let seed = 0; seed < 40; seed++) {
      const p = fake('p', 'tree-dfs', { decoys: ['bst', 'tree-bfs', 'graph-traversal'] })
      const options = drillOptions(p, mulberry32(seed))
      expect(options).toHaveLength(DRILL_OPTION_COUNT)
      expect(new Set(options).size).toBe(DRILL_OPTION_COUNT)
      expect(options).toContain('tree-dfs')
    }
  })

  it('offers the decoys when there are three', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['bst', 'tree-bfs', 'graph-traversal'] })
    expect([...drillOptions(p, rng())].sort()).toEqual(['bst', 'graph-traversal', 'tree-bfs', 'tree-dfs'])
  })

  it('uses no more than the first three decoys', () => {
    const p = fake('p', 'hashing', { decoys: ['stack', 'heap', 'greedy', 'trie', 'math'] })
    expect([...drillOptions(p, rng())].sort()).toEqual(['greedy', 'hashing', 'heap', 'stack'])
  })

  it('ignores a decoy that repeats itself or the answer', () => {
    const p = fake('p', 'hashing', { decoys: ['hashing', 'stack', 'stack', 'heap'] })
    const options = drillOptions(p, rng())
    expect(options).toHaveLength(4)
    expect(new Set(options).size).toBe(4)
    expect(options).toEqual(expect.arrayContaining(['hashing', 'stack', 'heap']))
  })

  it('ignores a decoy that is not a known pattern', () => {
    const p = fake('p', 'hashing', { decoys: ['made-up' as PatternId, 'stack', 'heap', 'greedy'] })
    const options = drillOptions(p, rng())
    expect(options).not.toContain('made-up')
    expect([...options].sort()).toEqual(['greedy', 'hashing', 'heap', 'stack'])
  })

  it('never fills from the problem\'s own topic: a same-topic pattern may be another valid answer', () => {
    // Trees holds tree-dfs, tree-bfs and bst. With a single decoy the filler must look elsewhere.
    const p = fake('p', 'tree-dfs', { decoys: ['hashing'] })
    for (let seed = 0; seed < 40; seed++) {
      const options = drillOptions(p, mulberry32(seed))
      expect(options).toEqual(expect.arrayContaining(['tree-dfs', 'hashing']))
      expect(options).not.toContain('tree-bfs')
      expect(options).not.toContain('bst')
      expect(new Set(options).size).toBe(DRILL_OPTION_COUNT)
    }
  })

  it('still offers a hand-picked decoy from its own topic', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['bst', 'hashing', 'heap'] })
    for (let seed = 0; seed < 10; seed++) expect(drillOptions(p, mulberry32(seed))).toContain('bst')
  })

  it('never offers the real solutions of the shipped problems that once drew same-topic filler', () => {
    for (const slug of ['coin-change', 'coin-change-ii', 'remove-nth-node-from-end-of-list', 'climbing-stairs']) {
      const problem = getProblem(slug)!
      const forbidden = new Set<PatternId>([...(problem.alt ?? [])])
      for (let seed = 0; seed < 60; seed++) {
        const options = drillOptions(problem, mulberry32(seed))
        expect(options.filter((o) => forbidden.has(o)), slug).toEqual([])
        expect(new Set(options).size, slug).toBe(DRILL_OPTION_COUNT)
      }
    }
  })

  it('offers only the problem\'s own decoys when it has three clean ones', () => {
    for (const problem of PROBLEMS) {
      const options = drillOptions(problem, mulberry32(11))
      expect([...options].sort(), problem.slug).toEqual([problem.pattern, ...problem.decoys].sort())
    }
  })

  it('fills from neighboring topics when the topic has too few patterns', () => {
    // Tries has one pattern. Its neighbors are trees (a dependency) and nothing else.
    const p = fake('p', 'trie')
    const neighbors = new Set([...TOPIC_BY_ID.tries.deps, ...TOPIC_BY_ID.tries.unlocks])
    const near = PATTERNS.filter((x) => neighbors.has(x.topic)).length
    expect(near).toBeGreaterThanOrEqual(3)
    for (let seed = 0; seed < 20; seed++) {
      const options = drillOptions(p, mulberry32(seed))
      for (const id of options.filter((o) => o !== 'trie')) expect(neighbors.has(PATTERN_BY_ID[id].topic)).toBe(true)
    }
  })

  it('takes same-topic patterns before neighbors, and neighbors before the rest', () => {
    // Greedy: same topic has no other pattern; heap is its dependency and holds two patterns.
    const p = fake('p', 'greedy')
    for (let seed = 0; seed < 20; seed++) {
      expect(drillOptions(p, mulberry32(seed))).toEqual(expect.arrayContaining(['greedy', 'heap', 'two-heaps']))
    }
  })

  it('treats the topic of the answer pattern as the same topic', () => {
    // A problem filed under Arrays & Hashing whose pattern lives in Stack: neither topic's patterns
    // are filler, because either could be another way to solve it.
    const p = fake('p', 'monotonic-stack', { topic: 'arrays-hashing' })
    for (let seed = 0; seed < 20; seed++) {
      const options = drillOptions(p, mulberry32(seed))
      for (const id of ['stack', 'hashing', 'prefix-suffix'] as const) expect(options).not.toContain(id)
    }
  })

  it('falls back to any pattern when nothing nearby is left', () => {
    const p = fake('p', 'design')
    const options = drillOptions(p, rng())
    expect(options).toHaveLength(4)
    expect(options).toContain('design')
  })

  it('is deterministic for a given seed', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['bst'] })
    expect(drillOptions(p, mulberry32(3))).toEqual(drillOptions(p, mulberry32(3)))
  })

  it('shuffles, so the answer lands in every position over many cards', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['bst', 'tree-bfs', 'graph-traversal'] })
    const positions = new Set<number>()
    for (let seed = 0; seed < 60; seed++) positions.add(drillOptions(p, mulberry32(seed)).indexOf('tree-dfs'))
    expect([...positions].sort()).toEqual([0, 1, 2, 3])
  })

  it('gives four distinct patterns for every pattern as the answer, with no decoys at all', () => {
    for (const pattern of PATTERNS) {
      for (let seed = 0; seed < 5; seed++) {
        const options = drillOptions(fake('p', pattern.id), mulberry32(seed))
        expect(options).toHaveLength(DRILL_OPTION_COUNT)
        expect(new Set(options).size).toBe(DRILL_OPTION_COUNT)
        expect(options).toContain(pattern.id)
      }
    }
  })

  it('keeps every option valid for the real problems, whatever their content', () => {
    const known = new Set(PATTERNS.map((p) => p.id))
    for (const problem of PROBLEMS) {
      const options = drillOptions(problem, mulberry32(4))
      expect(options).toHaveLength(DRILL_OPTION_COUNT)
      expect(new Set(options).size).toBe(DRILL_OPTION_COUNT)
      expect(options).toContain(problem.pattern)
      expect(options.every((o) => known.has(o))).toBe(true)
    }
  })

  it('keeps the decoys that fit and fills the rest when some are invalid', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['made-up' as PatternId, 'bst'] })
    const options = drillOptions(p, rng())
    expect(options).toEqual(expect.arrayContaining(['tree-dfs', 'bst']))
    expect(options).not.toContain('tree-bfs')
    expect(options).toHaveLength(4)
  })

  it('never offers a pattern from alt, even when it is one of the decoys', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['bst', 'tree-bfs', 'graph-traversal'], alt: ['bst'] })
    for (let seed = 0; seed < 40; seed++) {
      const options = drillOptions(p, mulberry32(seed))
      expect(options).not.toContain('bst')
      expect(options).toHaveLength(DRILL_OPTION_COUNT)
      expect(new Set(options).size).toBe(DRILL_OPTION_COUNT)
      expect(options).toEqual(expect.arrayContaining(['tree-dfs', 'tree-bfs', 'graph-traversal']))
    }
  })

  it('keeps alt patterns of its own topic out of the filler', () => {
    // Without alt, tree-bfs and bst would fill the gaps beside the decoy.
    const p = fake('p', 'tree-dfs', { decoys: ['hashing'], alt: ['tree-bfs', 'bst'] })
    for (let seed = 0; seed < 40; seed++) {
      const options = drillOptions(p, mulberry32(seed))
      expect(options).not.toContain('tree-bfs')
      expect(options).not.toContain('bst')
      expect(options).toHaveLength(DRILL_OPTION_COUNT)
      expect(new Set(options).size).toBe(DRILL_OPTION_COUNT)
      expect(options).toEqual(expect.arrayContaining(['tree-dfs', 'hashing']))
    }
  })

  it('keeps every real problem free of its own alt patterns', () => {
    for (const problem of PROBLEMS) {
      const options = drillOptions(problem, mulberry32(9))
      for (const a of problem.alt ?? []) expect(options).not.toContain(a)
    }
  })

  it('does not change the problem', () => {
    const p = fake('p', 'tree-dfs', { decoys: ['bst', 'tree-bfs'] })
    drillOptions(p, rng())
    expect(p.decoys).toEqual(['bst', 'tree-bfs'])
  })
})

describe('patternWeight', () => {
  it('weighs an unseen pattern 1.6', () => {
    expect(patternWeight(statOf('hashing', 0, 0))).toBe(1.6)
  })

  it('smooths accuracy with one imagined hit and one imagined miss', () => {
    // 1 of 2: smoothed 2/4 = 0.5 -> 0.4 + 2 * 0.5
    expect(patternWeight(statOf('hashing', 2, 1))).toBeCloseTo(1.4)
    // 0 of 4: smoothed 1/6
    expect(patternWeight(statOf('hashing', 4, 0))).toBeCloseTo(0.4 + 2 * (5 / 6))
    // 10 of 10: smoothed 11/12
    expect(patternWeight(statOf('hashing', 10, 10))).toBeCloseTo(0.4 + 2 * (1 / 12))
  })

  it('never reaches zero, even when always right', () => {
    expect(patternWeight(statOf('hashing', 1000, 1000))).toBeGreaterThan(0.4)
  })

  it('rises as accuracy falls', () => {
    expect(patternWeight(statOf('hashing', 10, 2))).toBeGreaterThan(patternWeight(statOf('hashing', 10, 8)))
  })

  it('puts a pattern missed once above an unseen one', () => {
    expect(patternWeight(statOf('hashing', 1, 0))).toBeGreaterThan(1.6)
  })

  it('puts a well-known pattern below an unseen one', () => {
    expect(patternWeight(statOf('hashing', 6, 6))).toBeLessThan(1.6)
  })
})

describe('nextDrillCard', () => {
  const fresh = buildDrillStats([], TODAY)

  function share(
    pool: Problem[],
    stats: ReturnType<typeof buildDrillStats>,
    recent: string[],
    slug: string,
    draws = 4000,
  ): number {
    const rng = mulberry32(11)
    let hits = 0
    for (let i = 0; i < draws; i++) if (nextDrillCard({ stats, pool, recent, rng })!.slug === slug) hits += 1
    return hits / draws
  }

  it('returns null for an empty pool', () => {
    expect(nextDrillCard({ stats: fresh, pool: [], recent: [], rng: mulberry32(1) })).toBeNull()
  })

  it('skips problems without a summary', () => {
    const pool = [fake('a', 'hashing', { summary: '' }), fake('b', 'heap', { summary: '   ' }), fake('c', 'trie')]
    for (let seed = 0; seed < 30; seed++) {
      expect(nextDrillCard({ stats: fresh, pool, recent: [], rng: mulberry32(seed) })!.slug).toBe('c')
    }
  })

  it('returns null when no problem has a summary', () => {
    const pool = [fake('a', 'hashing', { summary: '' }), fake('b', 'heap', { summary: '' })]
    expect(nextDrillCard({ stats: fresh, pool, recent: [], rng: mulberry32(1) })).toBeNull()
  })

  it('returns the only card, even when it was just shown', () => {
    const pool = [fake('a', 'hashing')]
    expect(nextDrillCard({ stats: fresh, pool, recent: ['a'], rng: mulberry32(1) })!.slug).toBe('a')
  })

  it('favors patterns you get wrong', () => {
    const stats = buildDrillStats(
      [
        ...Array.from({ length: 10 }, () => result('heap', 'heap')),
        ...Array.from({ length: 4 }, () => result('hashing', 'stack')),
      ],
      TODAY,
    )
    const pool = [fake('a', 'hashing'), fake('b', 'heap')]
    const weak = patternWeight(stats.byPattern.find((p) => p.pattern.id === 'hashing')!)
    const strong = patternWeight(stats.byPattern.find((p) => p.pattern.id === 'heap')!)
    expect(share(pool, stats, [], 'a')).toBeCloseTo(weak / (weak + strong), 1)
    expect(share(pool, stats, [], 'a')).toBeGreaterThan(0.7)
  })

  it('weighs an unseen pattern above a mastered one', () => {
    const stats = buildDrillStats(
      Array.from({ length: 10 }, () => result('heap', 'heap')),
      TODAY,
    )
    const pool = [fake('a', 'hashing'), fake('b', 'heap')]
    // 1.6 against 0.4 + 2 * (1 / 12)
    expect(share(pool, stats, [], 'a')).toBeCloseTo(1.6 / (1.6 + 0.4 + 2 / 12), 1)
  })

  it('divides a pattern weight among its problems so big patterns do not crowd out small ones', () => {
    const pool = [fake('a1', 'hashing'), fake('a2', 'hashing'), fake('a3', 'hashing'), fake('b', 'heap')]
    // Both patterns unseen: the three share 1.6 between them, the single card gets 1.6.
    expect(share(pool, fresh, [], 'b')).toBeCloseTo(0.5, 1)
  })

  it('does not count skipped problems when sharing a pattern weight', () => {
    const pool = [
      fake('a1', 'hashing'),
      fake('a2', 'hashing', { summary: '' }),
      fake('a3', 'hashing', { summary: '' }),
      fake('b', 'heap'),
    ]
    expect(share(pool, fresh, [], 'b')).toBeCloseTo(0.5, 1)
  })

  it('rarely repeats a recent card', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'hashing')]
    // 0.15 against 1.
    expect(share(pool, fresh, ['a'], 'a')).toBeCloseTo(0.15 / 1.15, 1)
  })

  it('still repeats a recent card when the rest of the pool is empty', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'hashing', { summary: '' })]
    expect(nextDrillCard({ stats: fresh, pool, recent: ['a'], rng: mulberry32(2) })!.slug).toBe('a')
  })

  it('treats a pattern missing from the stats as unseen', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap')]
    const sparse = { ...fresh, byPattern: fresh.byPattern.filter((p) => p.pattern.id !== 'hashing') }
    expect(share(pool, sparse, [], 'a')).toBeCloseTo(0.5, 1)
  })

  it('does not change the recent list', () => {
    const recent = ['a']
    nextDrillCard({ stats: fresh, pool: [fake('a', 'hashing'), fake('b', 'heap')], recent, rng: mulberry32(1) })
    expect(recent).toEqual(['a'])
  })

  it('treats a recent card the same as any other when the whole pool is recent', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap')]
    expect(share(pool, fresh, ['a', 'b'], 'a')).toBeCloseTo(0.5, 1)
  })

  it('ignores recent slugs that are not in the pool', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap')]
    expect(share(pool, fresh, ['zzz'], 'a')).toBeCloseTo(0.5, 1)
  })

  it('always returns a card from the pool', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap'), fake('c', 'trie')]
    const rng = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      expect(['a', 'b', 'c']).toContain(nextDrillCard({ stats: fresh, pool, recent: [], rng })!.slug)
    }
  })

  it('is deterministic for a given seed', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap'), fake('c', 'trie')]
    const draw = (seed: number) => {
      const rng = mulberry32(seed)
      return Array.from({ length: 10 }, () => nextDrillCard({ stats: fresh, pool, recent: [], rng })!.slug)
    }
    expect(draw(5)).toEqual(draw(5))
  })

  it('does not change the pool', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap', { summary: '' })]
    nextDrillCard({ stats: fresh, pool, recent: [], rng: mulberry32(1) })
    expect(pool.map((p) => p.slug)).toEqual(['a', 'b'])
  })

  it('walks a deck, drifting towards the weak pattern as answers come in', () => {
    const pool = [fake('a', 'hashing'), fake('b', 'heap'), fake('c', 'trie')]
    const rng = mulberry32(21)
    const history: DrillResult[] = []
    const shown: string[] = []
    for (let i = 0; i < 300; i++) {
      const stats = buildDrillStats(history, TODAY)
      const card = nextDrillCard({ stats, pool, recent: shown.slice(-2), rng })!
      shown.push(card.slug)
      // Always right except on hash-map cards.
      history.push(result(card.pattern, card.slug === 'a' ? 'stack' : card.pattern))
    }
    const count = (slug: string) => shown.filter((s) => s === slug).length
    expect(count('a')).toBeGreaterThan(count('b'))
    expect(count('a')).toBeGreaterThan(count('c'))
    expect(count('b')).toBeGreaterThan(0)
    expect(count('c')).toBeGreaterThan(0)
  })
})
