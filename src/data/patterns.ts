import type { Pattern, PatternId } from './types'

/** The pattern taxonomy used by the drill. Order is the order shown in pattern lists. */
export const PATTERNS: readonly Pattern[] = [
  { id: 'hashing', name: 'Hash map / set', topic: 'arrays-hashing', hint: 'Trade memory for O(1) lookups: seen-before checks, counts, complements, grouping by a key.' },
  { id: 'prefix-suffix', name: 'Prefix & suffix passes', topic: 'arrays-hashing', hint: 'Precompute running aggregates from the left and from the right, then combine them per index.' },
  { id: 'two-pointers', name: 'Two pointers', topic: 'two-pointers', hint: 'Two indices that close in from the ends, or spread out from a center, over sorted or symmetric data.' },
  { id: 'sliding-window', name: 'Sliding window', topic: 'sliding-window', hint: 'Grow and shrink a contiguous range while maintaining a running summary of what is inside it.' },
  { id: 'stack', name: 'Stack', topic: 'stack', hint: 'Last-in-first-out bookkeeping for nesting, matching and undoing the most recent thing.' },
  { id: 'monotonic-stack', name: 'Monotonic stack / deque', topic: 'stack', hint: 'Keep candidates in sorted order and pop the ones a new element makes irrelevant: next greater, window maximum.' },
  { id: 'binary-search', name: 'Binary search', topic: 'binary-search', hint: 'Halve a sorted or partly sorted search space by comparing against the middle.' },
  { id: 'search-on-answer', name: 'Binary search on the answer', topic: 'binary-search', hint: 'Guess a value, test whether it is feasible, and binary-search the smallest or largest guess that works.' },
  { id: 'linked-list', name: 'Linked-list pointer surgery', topic: 'linked-list', hint: 'Rewire next pointers in place: reverse, splice, merge. A dummy head removes the edge cases.' },
  { id: 'fast-slow', name: 'Fast & slow pointers', topic: 'linked-list', hint: 'Two runners at different speeds find cycles and midpoints without extra memory.' },
  { id: 'tree-dfs', name: 'Tree DFS', topic: 'trees', hint: 'Recurse into the children and combine their answers on the way back up.' },
  { id: 'tree-bfs', name: 'Tree BFS (level order)', topic: 'trees', hint: 'Process a tree row by row with a queue when the answer depends on depth.' },
  { id: 'bst', name: 'BST ordering', topic: 'trees', hint: 'Use left < node < right: in-order is sorted, and each comparison discards a subtree.' },
  { id: 'trie', name: 'Trie', topic: 'tries', hint: 'A tree of characters that shares prefixes, for prefix queries and pruning many words at once.' },
  { id: 'heap', name: 'Heap / top-K', topic: 'heap', hint: 'Repeatedly pull the smallest or largest item, or keep only the best K seen so far.' },
  { id: 'two-heaps', name: 'Two heaps', topic: 'heap', hint: 'Balance a max-heap of the lower half against a min-heap of the upper half to track a running median.' },
  { id: 'backtracking', name: 'Backtracking', topic: 'backtracking', hint: 'Build candidates one choice at a time, recurse, then undo the choice. Prune as early as you can.' },
  { id: 'graph-traversal', name: 'Graph DFS / BFS', topic: 'graphs', hint: 'Visit everything reachable while marking what you have seen: components, flood fill, cloning.' },
  { id: 'bfs-shortest', name: 'BFS shortest path', topic: 'graphs', hint: 'Expand in rings from one or many sources; the first time you reach a node is the fewest steps.' },
  { id: 'topological-sort', name: 'Topological sort', topic: 'graphs', hint: 'Order nodes so every prerequisite comes first. A cycle means no valid order exists.' },
  { id: 'union-find', name: 'Union-Find', topic: 'graphs', hint: 'Merge groups and ask "are these already connected?" in near-constant time.' },
  { id: 'weighted-paths', name: 'Weighted shortest path / MST', topic: 'advanced-graphs', hint: 'Edges have costs: Dijkstra, Bellman-Ford or Prim, relaxing the cheapest option next.' },
  { id: 'dp-linear', name: '1-D DP', topic: 'dp-1d', hint: 'The answer at position i depends on a few earlier positions; fill a table (or two variables) left to right.' },
  { id: 'dp-knapsack', name: 'Knapsack DP', topic: 'dp-1d', hint: 'Choose items to reach a target sum or count; the state is how much capacity is left.' },
  { id: 'dp-grid', name: '2-D DP', topic: 'dp-2d', hint: 'State is a pair of indices: a cell in a grid, or a position in each of two sequences.' },
  { id: 'dp-interval', name: 'Interval DP', topic: 'dp-2d', hint: 'Solve every sub-range [l, r] by choosing which element splits it or is handled last.' },
  { id: 'greedy', name: 'Greedy', topic: 'greedy', hint: 'A locally best choice is provably safe, so commit to it and never look back.' },
  { id: 'intervals', name: 'Interval sort & sweep', topic: 'intervals', hint: 'Sort by start or end, then sweep once, merging or counting overlaps as you go.' },
  { id: 'matrix', name: 'Matrix traversal', topic: 'math-geometry', hint: 'Index gymnastics on a grid: layers, boundaries, transposes and in-place markers.' },
  { id: 'math', name: 'Math & simulation', topic: 'math-geometry', hint: 'Digit-by-digit arithmetic, number properties and careful simulation of a stated process.' },
  { id: 'bit-manipulation', name: 'Bit manipulation', topic: 'bit-manipulation', hint: 'XOR, masks and shifts: cancel pairs, count bits, do arithmetic without + and -.' },
  { id: 'design', name: 'Structure or format design', topic: 'linked-list', hint: 'No trick to spot: design a structure or an encoding, often two pieces combined, so every operation meets its bound.' },
]

export const PATTERN_BY_ID: Record<PatternId, Pattern> = Object.fromEntries(PATTERNS.map((p) => [p.id, p])) as Record<
  PatternId,
  Pattern
>

/** The pattern a topic's problems fall back to when no detail has been written. */
export const DEFAULT_PATTERN: Record<string, PatternId> = {
  'arrays-hashing': 'hashing',
  'two-pointers': 'two-pointers',
  'sliding-window': 'sliding-window',
  stack: 'stack',
  'binary-search': 'binary-search',
  'linked-list': 'linked-list',
  trees: 'tree-dfs',
  tries: 'trie',
  heap: 'heap',
  backtracking: 'backtracking',
  graphs: 'graph-traversal',
  'advanced-graphs': 'weighted-paths',
  'dp-1d': 'dp-linear',
  'dp-2d': 'dp-grid',
  greedy: 'greedy',
  intervals: 'intervals',
  'math-geometry': 'math',
  'bit-manipulation': 'bit-manipulation',
}
