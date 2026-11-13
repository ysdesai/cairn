import { describe, expect, it } from 'vitest'
import { CHEATSHEETS, EXPECTED_COUNTS, getProblem, PATTERN_BY_ID, PATTERNS, PROBLEMS, PROBLEMS_BY_TOPIC, TOPIC_EDGES, TOPICS } from './index'
import { DETAILS } from './details'

describe('the problem list', () => {
  it('has exactly 150 problems', () => {
    expect(PROBLEMS).toHaveLength(150)
  })

  it('matches the per-topic counts', () => {
    for (const topic of TOPICS) {
      expect(PROBLEMS_BY_TOPIC[topic.id], topic.name).toHaveLength(EXPECTED_COUNTS[topic.id])
      expect(topic.count).toBe(EXPECTED_COUNTS[topic.id])
    }
    expect(TOPICS).toHaveLength(18)
  })

  it('has unique slugs and numbers, and well-formed links', () => {
    expect(new Set(PROBLEMS.map((p) => p.slug)).size).toBe(150)
    expect(new Set(PROBLEMS.map((p) => p.number)).size).toBe(150)
    for (const p of PROBLEMS) {
      expect(p.url).toBe(`https://leetcode.com/problems/${p.slug}/`)
      expect(p.slug).toMatch(/^[a-z0-9-]+$/)
      expect(p.order).toBeGreaterThan(0)
    }
    expect(PROBLEMS.map((p) => p.order)).toEqual(Array.from({ length: 150 }, (_, i) => i + 1))
  })

  it('has the known difficulty split and Premium set', () => {
    const count = (d: string) => PROBLEMS.filter((p) => p.difficulty === d).length
    expect([count('easy'), count('medium'), count('hard')]).toEqual([28, 101, 21])
    expect(PROBLEMS.filter((p) => p.premium).map((p) => p.number).sort((a, b) => a - b)).toEqual([
      252, 253, 261, 269, 271, 286, 323,
    ])
  })
})

describe('the roadmap', () => {
  it('has the 22 dependency edges and no cycles', () => {
    expect(TOPIC_EDGES).toHaveLength(22)
    for (const topic of TOPICS) {
      for (const dep of topic.deps) {
        const from = TOPICS.find((t) => t.id === dep)!
        expect(from.level, `${dep} → ${topic.id}`).toBeLessThan(topic.level)
        expect(from.unlocks).toContain(topic.id)
      }
    }
    expect(TOPICS.filter((t) => t.deps.length === 0).map((t) => t.id)).toEqual(['arrays-hashing'])
    expect(Math.max(...TOPICS.map((t) => t.level))).toBe(7)
  })
})

describe('problem details', () => {
  it('exist for every problem and nothing else', () => {
    const slugs = new Set(PROBLEMS.map((p) => p.slug))
    expect(Object.keys(DETAILS).filter((s) => !slugs.has(s))).toEqual([])
    expect(PROBLEMS.filter((p) => !DETAILS[p.slug]).map((p) => p.slug)).toEqual([])
  })

  it('are complete and consistent', () => {
    for (const p of PROBLEMS) {
      const where = p.slug
      expect(PATTERN_BY_ID[p.pattern], where).toBeDefined()
      expect(p.tags.length, where).toBeGreaterThanOrEqual(2)
      expect(p.tags.length, where).toBeLessThanOrEqual(4)
      for (const tag of p.tags) expect(tag, where).toBe(tag.toLowerCase())
      expect(p.summary.length, where).toBeGreaterThan(40)
      expect(p.summary.length, where).toBeLessThan(340)
      expect(p.clue.length, where).toBeGreaterThan(30)
      expect(p.clue.length, where).toBeLessThan(320)
      expect(p.decoys.length, where).toBeGreaterThanOrEqual(2)
      expect(p.decoys.length, where).toBeLessThanOrEqual(3)
      expect(new Set(p.decoys).size, where).toBe(p.decoys.length)
      expect(p.decoys, where).not.toContain(p.pattern)
      for (const d of p.decoys) expect(PATTERN_BY_ID[d], `${where}: ${d}`).toBeDefined()
    }
  })

  it('give every card three clean decoys, none of them an accepted alternative', () => {
    for (const p of PROBLEMS) {
      const alt = new Set(p.alt ?? [])
      expect(alt.has(p.pattern), p.slug).toBe(false)
      expect(p.decoys.filter((d) => alt.has(d)), p.slug).toEqual([])
      expect(p.decoys.length, p.slug).toBe(3)
    }
  })

  it('accept the alternatives a careful solver would name', () => {
    const alt = (slug: string) => [...(getProblem(slug)?.alt ?? [])].sort()
    expect(alt('sliding-window-maximum')).toEqual(['heap', 'sliding-window'])
    expect(alt('word-search-ii')).toEqual(['backtracking'])
    expect(alt('remove-nth-node-from-end-of-list')).toEqual(['linked-list', 'two-pointers'])
    expect(alt('coin-change')).toContain('dp-linear')
    expect(alt('coin-change-ii')).toEqual(['dp-linear'])
    expect(alt('longest-increasing-path-in-a-matrix')).toContain('graph-traversal')
    for (const slug of [
      'longest-substring-without-repeating-characters',
      'permutation-in-string',
      'minimum-window-substring',
    ]) {
      expect(alt(slug), slug).toContain('two-pointers')
    }
    expect(alt('time-based-key-value-store')).toContain('hashing')
  })

  it('keep summaries to one or two sentences', () => {
    for (const p of PROBLEMS) {
      // A sentence ends at ., ? or ! followed by a space or the end; "(from, to, time)" and "n + 1" do not count.
      const sentences = p.summary.split(/[.?!](?:\s+|$)/).filter((x) => x.trim() !== '')
      expect(sentences.length, p.slug).toBeLessThanOrEqual(2)
    }
  })

  it('keep summaries free of structure names and complexity bounds', () => {
    const leaks: [RegExp, string][] = [
      [/O\(log/i, 'a log bound'],
      [/\bconstant (extra )?(amount of )?(extra )?(memory|space)/i, 'a memory limit'],
      [/\bO\(1\)/, 'a constant bound'],
      [/\btrie\b|prefix tree/i, 'the trie'],
      [/binary search tree|\bbst\b/i, 'the BST'],
      [/\b(design|implement) a (stack|trie)/i, 'the structure'],
      [/better than sorting|single pass|in one pass/i, 'a hint about the method'],
    ]
    for (const p of PROBLEMS) {
      for (const [pattern, what] of leaks) {
        // LRU Cache is defined by its O(1) operations; that is the task, not a hint.
        if (p.slug === 'lru-cache' && what === 'a constant bound') continue
        expect(p.summary, `${p.slug}: ${what}`).not.toMatch(pattern)
      }
    }
  })

  it('use every pattern at least once', () => {
    const used = new Set(PROBLEMS.map((p) => p.pattern))
    expect(PATTERNS.filter((p) => !used.has(p.id)).map((p) => p.id)).toEqual([])
  })
})

describe('field guides', () => {
  it('are complete for all 18 topics', () => {
    for (const topic of TOPICS) {
      const sheet = CHEATSHEETS[topic.id]
      const where = topic.id
      expect(sheet.clues.length, where).toBeGreaterThanOrEqual(4)
      expect(sheet.clues.length, where).toBeLessThanOrEqual(6)
      expect(sheet.idea.length, where).toBeGreaterThan(80)
      expect(sheet.template.length, where).toBeGreaterThan(60)
      expect(sheet.template.split('\n').length, where).toBeLessThanOrEqual(32)
      expect(sheet.templateNote.length, where).toBeGreaterThan(10)
      expect(sheet.mistakes.length, where).toBeGreaterThanOrEqual(3)
      expect(sheet.mistakes.length, where).toBeLessThanOrEqual(5)
    }
  })
})
