import { describe, expect, it } from 'vitest'
import { PROBLEMS } from '../data'
import type { Difficulty, Problem, TopicId } from '../data/types'
import { DEFAULT_MOCK_MINUTES, type MockConfig } from '../state/schema'
import { MOCK_PROBLEM_COUNT, mockPoolSize, pickMockProblems } from './mock'
import { viewProblem } from './problemView'
import { mulberry32 } from './rng'
import { attempt, listWith, record } from './testing'
import type { ProblemView } from './types'

const TODAY = '2026-11-12'

const config = (over: Partial<MockConfig> = {}): MockConfig => ({
  mix: 'any',
  pool: 'any',
  topics: [],
  minutes: DEFAULT_MOCK_MINUTES,
  ...over,
})

/** A problem view with the difficulty and topic given, and whether it has been solved. */
function view(slug: string, difficulty: Difficulty, topic: TopicId, solved = false): ProblemView {
  const problem = { ...PROBLEMS[0], slug, id: slug, difficulty, topic } as Problem
  return viewProblem(problem, solved ? record([attempt('2026-11-01', 'easy')]) : null, TODAY)
}

const difficulties = (picked: Problem[]) => picked.map((p) => p.difficulty)
const slugs = (picked: Problem[]) => picked.map((p) => p.slug)

describe('mockPoolSize', () => {
  const list = [
    view('a', 'easy', 'arrays-hashing', true),
    view('b', 'medium', 'arrays-hashing'),
    view('c', 'medium', 'trees', true),
    view('d', 'hard', 'trees'),
    view('e', 'hard', 'heap'),
  ]

  it('counts everything for any pool and every topic', () => {
    expect(mockPoolSize(config(), list)).toBe(5)
  })

  it('counts solved problems only', () => {
    expect(mockPoolSize(config({ pool: 'solved' }), list)).toBe(2)
  })

  it('counts unsolved problems only', () => {
    expect(mockPoolSize(config({ pool: 'unsolved' }), list)).toBe(3)
  })

  it('narrows to the chosen topics', () => {
    expect(mockPoolSize(config({ topics: ['trees'] }), list)).toBe(2)
    expect(mockPoolSize(config({ topics: ['trees', 'heap'] }), list)).toBe(3)
  })

  it('combines the pool and the topics', () => {
    expect(mockPoolSize(config({ pool: 'unsolved', topics: ['trees'] }), list)).toBe(1)
    expect(mockPoolSize(config({ pool: 'solved', topics: ['heap'] }), list)).toBe(0)
  })

  it('is zero for an empty list', () => {
    expect(mockPoolSize(config(), [])).toBe(0)
  })

  it('ignores the mix', () => {
    expect(mockPoolSize(config({ mix: 'medium-hard' }), list)).toBe(5)
  })

  it('covers the whole list, with a revised problem counting as solved', () => {
    const real = listWith({ [PROBLEMS[0].slug]: [attempt('2026-10-01', 'easy'), attempt('2026-10-09', 'easy')] }, TODAY)
    expect(mockPoolSize(config(), real)).toBe(150)
    expect(mockPoolSize(config({ pool: 'solved' }), real)).toBe(1)
    expect(mockPoolSize(config({ pool: 'unsolved' }), real)).toBe(149)
  })
})

describe('pickMockProblems', () => {
  it('asks for two problems', () => {
    expect(MOCK_PROBLEM_COUNT).toBe(2)
  })

  describe('with a fixed mix', () => {
    const list = [
      view('e1', 'easy', 'arrays-hashing'),
      view('e2', 'easy', 'two-pointers'),
      view('m1', 'medium', 'trees'),
      view('m2', 'medium', 'heap'),
      view('h1', 'hard', 'graphs'),
      view('h2', 'hard', 'dp-2d'),
    ]

    it('draws an easy then a medium', () => {
      for (let seed = 0; seed < 30; seed++) {
        const picked = pickMockProblems(config({ mix: 'easy-medium' }), list, mulberry32(seed))
        expect(difficulties(picked)).toEqual(['easy', 'medium'])
      }
    })

    it('draws two mediums', () => {
      for (let seed = 0; seed < 30; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-medium' }), list, mulberry32(seed))
        expect(difficulties(picked)).toEqual(['medium', 'medium'])
        expect(new Set(slugs(picked)).size).toBe(2)
      }
    })

    it('draws a medium then a hard, easier first', () => {
      for (let seed = 0; seed < 30; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(seed))
        expect(difficulties(picked)).toEqual(['medium', 'hard'])
      }
    })

    it('varies the choice with the seed', () => {
      const seen = new Set<string>()
      for (let seed = 0; seed < 60; seed++) {
        seen.add(slugs(pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(seed))).join())
      }
      expect(seen).toEqual(new Set(['m1,h1', 'm1,h2', 'm2,h1', 'm2,h2']))
    })

    it('gives the same pair for the same seed', () => {
      const a = pickMockProblems(config({ mix: 'easy-medium' }), list, mulberry32(9))
      const b = pickMockProblems(config({ mix: 'easy-medium' }), list, mulberry32(9))
      expect(slugs(a)).toEqual(slugs(b))
    })
  })

  describe('topics', () => {
    it('prefers different topics', () => {
      const list = [
        view('m1', 'medium', 'trees'),
        view('m2', 'medium', 'trees'),
        view('m3', 'medium', 'heap'),
        view('m4', 'medium', 'heap'),
      ]
      for (let seed = 0; seed < 40; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-medium' }), list, mulberry32(seed))
        expect(new Set(picked.map((p) => p.topic)).size).toBe(2)
      }
    })

    it('accepts one topic when the pool has no other', () => {
      const list = [view('m1', 'medium', 'trees'), view('m2', 'medium', 'trees'), view('m3', 'medium', 'trees')]
      const picked = pickMockProblems(config({ mix: 'medium-medium' }), list, mulberry32(1))
      expect(picked).toHaveLength(2)
      expect(picked.every((p) => p.topic === 'trees')).toBe(true)
    })

    it('accepts one topic when the mix needs it', () => {
      // The only hard problem shares a topic with the only medium; the other topic has an easy.
      const list = [view('m', 'medium', 'trees'), view('h', 'hard', 'trees'), view('e', 'easy', 'heap')]
      const picked = pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(1))
      expect(slugs(picked)).toEqual(['m', 'h'])
    })

    it('draws from the chosen topics only', () => {
      const list = [
        view('a', 'medium', 'trees'),
        view('b', 'medium', 'heap'),
        view('c', 'medium', 'graphs'),
        view('d', 'medium', 'tries'),
      ]
      for (let seed = 0; seed < 30; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-medium', topics: ['trees', 'heap'] }), list, mulberry32(seed))
        expect([...slugs(picked)].sort()).toEqual(['a', 'b'])
      }
    })
  })

  describe('pool', () => {
    const list = [
      view('s1', 'medium', 'trees', true),
      view('s2', 'medium', 'heap', true),
      view('u1', 'medium', 'graphs'),
      view('u2', 'medium', 'tries'),
    ]

    it('draws solved problems only', () => {
      for (let seed = 0; seed < 20; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-medium', pool: 'solved' }), list, mulberry32(seed))
        expect([...slugs(picked)].sort()).toEqual(['s1', 's2'])
      }
    })

    it('draws unsolved problems only', () => {
      for (let seed = 0; seed < 20; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-medium', pool: 'unsolved' }), list, mulberry32(seed))
        expect([...slugs(picked)].sort()).toEqual(['u1', 'u2'])
      }
    })
  })

  describe('a surprise mix', () => {
    const list = [
      view('e', 'easy', 'arrays-hashing'),
      view('m', 'medium', 'trees'),
      view('h', 'hard', 'graphs'),
      view('h2', 'hard', 'dp-2d'),
    ]

    it('draws any two problems, easier first', () => {
      const rank = { easy: 0, medium: 1, hard: 2 }
      for (let seed = 0; seed < 60; seed++) {
        const [first, second] = pickMockProblems(config(), list, mulberry32(seed))
        expect(rank[first.difficulty]).toBeLessThanOrEqual(rank[second.difficulty])
        expect(first.slug).not.toBe(second.slug)
      }
    })

    it('reaches every combination across seeds', () => {
      const seen = new Set<string>()
      for (let seed = 0; seed < 200; seed++) {
        seen.add(
          slugs(pickMockProblems(config(), list, mulberry32(seed)))
            .sort()
            .join(),
        )
      }
      expect(seen.size).toBe(6)
    })

    it('still prefers different topics', () => {
      const same = [view('a', 'easy', 'trees'), view('b', 'easy', 'trees'), view('c', 'hard', 'heap')]
      for (let seed = 0; seed < 30; seed++) {
        const picked = pickMockProblems(config(), same, mulberry32(seed))
        expect(new Set(picked.map((p) => p.topic)).size).toBe(2)
      }
    })
  })

  describe('when the pool cannot satisfy the mix', () => {
    it('relaxes a hard to the nearest difficulty', () => {
      const list = [view('m1', 'medium', 'trees'), view('m2', 'medium', 'heap'), view('e', 'easy', 'graphs')]
      const picked = pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(1))
      expect(difficulties(picked)).toEqual(['medium', 'medium'])
    })

    it('relaxes a medium, keeping the easy', () => {
      const list = [view('e', 'easy', 'trees'), view('h', 'hard', 'heap')]
      expect(slugs(pickMockProblems(config({ mix: 'easy-medium' }), list, mulberry32(1)))).toEqual(['e', 'h'])
    })

    it('keeps the exact slot when only the other must give way', () => {
      const list = [view('m', 'medium', 'trees'), view('e', 'easy', 'heap'), view('e2', 'easy', 'graphs')]
      for (let seed = 0; seed < 20; seed++) {
        const picked = pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(seed))
        expect(slugs(picked)).toContain('m')
        expect(picked).toHaveLength(2)
      }
    })

    it('uses what exists when only one difficulty is available', () => {
      const list = [view('h1', 'hard', 'trees'), view('h2', 'hard', 'heap')]
      const picked = pickMockProblems(config({ mix: 'easy-medium' }), list, mulberry32(1))
      expect(difficulties(picked)).toEqual(['hard', 'hard'])
    })

    it('chooses the nearer relaxation', () => {
      // Medium + Hard with one easy and one hard: the hard fits, and the easy stands in for the medium.
      const list = [view('e', 'easy', 'trees'), view('h', 'hard', 'heap')]
      expect(slugs(pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(1)))).toEqual(['e', 'h'])
    })

    it('returns one problem when the pool has one', () => {
      const list = [view('m', 'medium', 'trees')]
      expect(slugs(pickMockProblems(config({ mix: 'medium-hard' }), list, mulberry32(1)))).toEqual(['m'])
    })

    it('returns nothing when the pool is empty', () => {
      expect(pickMockProblems(config(), [], mulberry32(1))).toEqual([])
      const list = [view('m', 'medium', 'trees', true)]
      expect(pickMockProblems(config({ pool: 'unsolved' }), list, mulberry32(1))).toEqual([])
      expect(pickMockProblems(config({ topics: ['heap'] }), list, mulberry32(1))).toEqual([])
    })
  })

  it('returns both problems of a pool of exactly two, easier first, whatever the mix', () => {
    const list = [view('h', 'hard', 'trees'), view('e', 'easy', 'trees')]
    for (const mix of ['any', 'easy-medium', 'medium-medium', 'medium-hard'] as const) {
      expect(slugs(pickMockProblems(config({ mix }), list, mulberry32(2)))).toEqual(['e', 'h'])
    }
  })

  it('meets every fixed mix on the real list, in different topics', () => {
    const list = listWith({}, TODAY)
    const wanted = {
      'easy-medium': ['easy', 'medium'],
      'medium-medium': ['medium', 'medium'],
      'medium-hard': ['medium', 'hard'],
    } as const
    for (const [mix, expected] of Object.entries(wanted)) {
      for (let seed = 0; seed < 25; seed++) {
        const picked = pickMockProblems(config({ mix: mix as keyof typeof wanted }), list, mulberry32(seed))
        expect(difficulties(picked)).toEqual(expected)
        expect(picked[0].topic).not.toBe(picked[1].topic)
      }
    }
  })

  it('draws a surprise mix from the whole real list, two different problems', () => {
    const list = listWith({}, TODAY)
    const rank = { easy: 0, medium: 1, hard: 2 }
    for (let seed = 0; seed < 25; seed++) {
      const [a, b] = pickMockProblems(config(), list, mulberry32(seed))
      expect(a.slug).not.toBe(b.slug)
      expect(rank[a.difficulty]).toBeLessThanOrEqual(rank[b.difficulty])
    }
  })

  it('draws two problems from a single chosen topic when that is all there is', () => {
    const list = listWith({}, TODAY)
    const picked = pickMockProblems(config({ topics: ['tries'], mix: 'medium-medium' }), list, mulberry32(1))
    expect(picked).toHaveLength(2)
    expect(picked.every((p) => p.topic === 'tries')).toBe(true)
  })

  it('returns one problem when a topic and pool leave exactly one', () => {
    const list = [view('a', 'easy', 'trees', true), view('b', 'easy', 'trees'), view('c', 'easy', 'heap', true)]
    expect(slugs(pickMockProblems(config({ pool: 'solved', topics: ['trees'] }), list, mulberry32(1)))).toEqual(['a'])
  })

  it('ignores topics it does not know', () => {
    const list = [view('a', 'easy', 'trees'), view('b', 'easy', 'heap')]
    expect(pickMockProblems(config({ topics: ['nowhere' as TopicId] }), list, mulberry32(1))).toEqual([])
  })

  it('does not change the config', () => {
    const cfg = config({ topics: ['trees', 'heap'] })
    const list = [view('a', 'easy', 'trees'), view('b', 'medium', 'heap')]
    pickMockProblems(cfg, list, mulberry32(1))
    expect(cfg.topics).toEqual(['trees', 'heap'])
  })

  it('does not change the list', () => {
    const list = [view('a', 'hard', 'trees'), view('b', 'easy', 'heap'), view('c', 'medium', 'graphs')]
    pickMockProblems(config(), list, mulberry32(1))
    expect(list.map((v) => v.problem.slug)).toEqual(['a', 'b', 'c'])
  })

  it('works on the real list with a history', () => {
    const solved = Object.fromEntries(PROBLEMS.slice(0, 40).map((p) => [p.slug, [attempt('2026-11-01', 'easy')]]))
    const list = listWith(solved, TODAY)
    for (let seed = 0; seed < 30; seed++) {
      const picked = pickMockProblems(config({ mix: 'medium-hard', pool: 'unsolved' }), list, mulberry32(seed))
      expect(difficulties(picked)).toEqual(['medium', 'hard'])
      expect(picked[0].topic).not.toBe(picked[1].topic)
      expect(picked.every((p) => !solved[p.slug])).toBe(true)
    }
  })
})
