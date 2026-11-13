import type { Topic, TopicId } from './types'

interface TopicSeed {
  id: TopicId
  name: string
  short: string
  deps: TopicId[]
  tagline: string
}

/** Conventional listing order. The dependency edges are the roadmap. */
const SEEDS: TopicSeed[] = [
  { id: 'arrays-hashing', name: 'Arrays & Hashing', short: 'Arrays & Hashing', deps: [], tagline: 'Counting, grouping and constant-time lookups. Everything else builds on this.' },
  { id: 'two-pointers', name: 'Two Pointers', short: 'Two Pointers', deps: ['arrays-hashing'], tagline: 'Two indices closing in on an answer over sorted or symmetric data.' },
  { id: 'sliding-window', name: 'Sliding Window', short: 'Sliding Window', deps: ['two-pointers'], tagline: 'A contiguous range that grows and shrinks while you keep a running summary.' },
  { id: 'stack', name: 'Stack', short: 'Stack', deps: ['arrays-hashing'], tagline: 'Nesting, matching and "the nearest earlier thing that still matters".' },
  { id: 'binary-search', name: 'Binary Search', short: 'Binary Search', deps: ['two-pointers'], tagline: 'Halving a sorted space, including the space of possible answers.' },
  { id: 'linked-list', name: 'Linked List', short: 'Linked List', deps: ['two-pointers'], tagline: 'Rewiring pointers in place without losing the rest of the chain.' },
  { id: 'trees', name: 'Trees', short: 'Trees', deps: ['binary-search', 'sliding-window', 'linked-list'], tagline: 'Recursion you can trust: solve the children, combine at the node.' },
  { id: 'tries', name: 'Tries', short: 'Tries', deps: ['trees'], tagline: 'A tree of characters for prefix questions over many words.' },
  { id: 'heap', name: 'Heap / Priority Queue', short: 'Heap / PQ', deps: ['trees'], tagline: 'Always know the smallest or largest item without sorting everything.' },
  { id: 'backtracking', name: 'Backtracking', short: 'Backtracking', deps: ['trees'], tagline: 'Try a choice, explore, undo. Enumerate every valid arrangement.' },
  { id: 'graphs', name: 'Graphs', short: 'Graphs', deps: ['backtracking'], tagline: 'Traversal, components, ordering and connectivity on anything with edges.' },
  { id: 'advanced-graphs', name: 'Advanced Graphs', short: 'Adv. Graphs', deps: ['heap', 'graphs'], tagline: 'Weighted edges: shortest paths, spanning trees and stranger orderings.' },
  { id: 'dp-1d', name: '1-D Dynamic Programming', short: '1-D DP', deps: ['backtracking'], tagline: 'Turn overlapping subproblems along one axis into a table.' },
  { id: 'dp-2d', name: '2-D Dynamic Programming', short: '2-D DP', deps: ['graphs', 'dp-1d'], tagline: 'Two indices of state: grids, pairs of strings and ranges.' },
  { id: 'greedy', name: 'Greedy', short: 'Greedy', deps: ['heap'], tagline: 'Commit to the locally best move when you can argue it is safe.' },
  { id: 'intervals', name: 'Intervals', short: 'Intervals', deps: ['heap'], tagline: 'Sort, sweep, and reason about overlap.' },
  { id: 'math-geometry', name: 'Math & Geometry', short: 'Math & Geometry', deps: ['graphs', 'bit-manipulation'], tagline: 'Matrices, digits and number tricks where careful indexing is the whole game.' },
  { id: 'bit-manipulation', name: 'Bit Manipulation', short: 'Bit Manipulation', deps: ['dp-1d'], tagline: 'XOR, masks and shifts doing work that looks like magic.' },
]

function levelOf(id: TopicId, seen: Map<TopicId, number>): number {
  const hit = seen.get(id)
  if (hit !== undefined) return hit
  const seed = SEEDS.find((s) => s.id === id)!
  const level = seed.deps.length === 0 ? 0 : 1 + Math.max(...seed.deps.map((d) => levelOf(d, seen)))
  seen.set(id, level)
  return level
}

const levels = new Map<TopicId, number>()

/** Problem counts are filled in by data/index.ts once the catalog is loaded. */
export const TOPIC_SEEDS: Omit<Topic, 'count'>[] = SEEDS.map((s, order) => ({
  id: s.id,
  name: s.name,
  short: s.short,
  order,
  deps: s.deps,
  unlocks: SEEDS.filter((o) => o.deps.includes(s.id)).map((o) => o.id),
  level: levelOf(s.id, levels),
  tagline: s.tagline,
}))

/** Every "A leads to B" edge of the roadmap, 22 in all. */
export const TOPIC_EDGES: readonly { from: TopicId; to: TopicId }[] = SEEDS.flatMap((s) =>
  s.deps.map((from) => ({ from, to: s.id })),
)

/** The problem counts the catalog must match. */
export const EXPECTED_COUNTS: Record<TopicId, number> = {
  'arrays-hashing': 9,
  'two-pointers': 5,
  'sliding-window': 6,
  stack: 7,
  'binary-search': 7,
  'linked-list': 11,
  trees: 15,
  tries: 3,
  heap: 7,
  backtracking: 9,
  graphs: 13,
  'advanced-graphs': 6,
  'dp-1d': 12,
  'dp-2d': 11,
  greedy: 8,
  intervals: 6,
  'math-geometry': 8,
  'bit-manipulation': 7,
}
