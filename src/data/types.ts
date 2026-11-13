/** Static content: the problem list, the topic graph, the pattern taxonomy and the field guides. */

export type Difficulty = 'easy' | 'medium' | 'hard'

export type TopicId =
  | 'arrays-hashing'
  | 'two-pointers'
  | 'sliding-window'
  | 'stack'
  | 'binary-search'
  | 'linked-list'
  | 'trees'
  | 'tries'
  | 'heap'
  | 'backtracking'
  | 'graphs'
  | 'advanced-graphs'
  | 'dp-1d'
  | 'dp-2d'
  | 'greedy'
  | 'intervals'
  | 'math-geometry'
  | 'bit-manipulation'

/**
 * The answer space of the pattern drill. Finer than topics (a "Stack" problem may really be a
 * monotonic-stack problem), coarse enough that each problem has one defensible primary pattern.
 */
export type PatternId =
  | 'hashing'
  | 'prefix-suffix'
  | 'two-pointers'
  | 'sliding-window'
  | 'stack'
  | 'monotonic-stack'
  | 'binary-search'
  | 'search-on-answer'
  | 'linked-list'
  | 'fast-slow'
  | 'tree-dfs'
  | 'tree-bfs'
  | 'bst'
  | 'trie'
  | 'heap'
  | 'two-heaps'
  | 'backtracking'
  | 'graph-traversal'
  | 'bfs-shortest'
  | 'topological-sort'
  | 'union-find'
  | 'weighted-paths'
  | 'dp-linear'
  | 'dp-knapsack'
  | 'dp-grid'
  | 'dp-interval'
  | 'greedy'
  | 'intervals'
  | 'matrix'
  | 'math'
  | 'bit-manipulation'
  | 'design'

/** The verified facts about a problem (see catalog.ts). */
export interface ProblemBase {
  slug: string
  /** LeetCode's problem number. */
  number: number
  title: string
  difficulty: Difficulty
  topic: TopicId
  /** Needs LeetCode Premium. */
  premium: boolean
  /** YouTube id of NeetCode's walkthrough. */
  video?: string
}

/** Hand-written learning content for a problem (see details/*.ts). */
export interface ProblemDetail {
  /** 2 to 4 fine-grained technique tags, lower case, e.g. "monotonic stack", "prefix product". */
  tags: string[]
  /** The primary pattern: the correct answer in the pattern drill. */
  pattern: PatternId
  /** One or two sentences on what the problem asks, in plain words, with no hint of the approach. */
  summary: string
  /** Shown after answering a drill card: the detail in the statement that gives the pattern away. */
  clue: string
  /** Two or three tempting but wrong patterns to offer as drill options. */
  decoys: PatternId[]
  /**
   * Other patterns that are also a standard, accepted way to solve it. Never offered as drill
   * options (picking one would be marked wrong unfairly) and shown after answering as "also solved with".
   */
  alt?: PatternId[]
}

export interface Problem extends ProblemBase, ProblemDetail {
  /** Same as slug; the key used everywhere in stored data. */
  id: string
  /** 1-based position in the whole list (topic order, then NeetCode's order within the topic). */
  order: number
  /** 1-based position within its topic. */
  indexInTopic: number
  /** https://leetcode.com/problems/<slug>/ */
  url: string
  /** https://www.youtube.com/watch?v=<id>, when a walkthrough exists. */
  videoUrl: string | null
}

export interface Topic {
  id: TopicId
  name: string
  /** For tight spaces (map labels, chips). */
  short: string
  /** Position in the conventional listing order, 0-based. */
  order: number
  /** Topics that should come first. Recommendation only; nothing is ever locked. */
  deps: TopicId[]
  /** Topics this one leads to. */
  unlocks: TopicId[]
  /** Longest dependency chain from Arrays & Hashing: 0 for the base, 7 for the last summit. */
  level: number
  /** One line on what the topic is about. */
  tagline: string
  /** Number of problems in the topic. */
  count: number
}

export interface Pattern {
  id: PatternId
  name: string
  /** One sentence: what the pattern is and when it applies. */
  hint: string
  /** The topic where this pattern is mostly practised. */
  topic: TopicId
}

/** The per-topic field guide. */
export interface CheatSheet {
  /** Clues in a problem statement that point to this pattern. 4 to 6 short lines. */
  clues: string[]
  /** The core idea in two to four sentences. */
  idea: string
  /** A minimal Python template. */
  template: string
  /** One line under the template: what to adapt, or the typical complexity. */
  templateNote: string
  /** Common mistakes. 3 to 5 short lines. */
  mistakes: string[]
}
