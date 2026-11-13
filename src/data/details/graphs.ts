import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'number-of-islands': {
    tags: ['flood fill', 'grid dfs', 'visited marking'],
    pattern: 'graph-traversal',
    summary:
      'Given a grid of 1s (land) and 0s (water), return how many islands it holds. An island is a group of land cells joined horizontally or vertically, and everything beyond the grid edge counts as water.',
    clue: 'Each island is a maximal group of touching land cells, so the first unseen land cell you meet starts exactly one new island. Marking everything reachable from it keeps that island from being counted again.',
    decoys: ['backtracking', 'dp-grid', 'matrix'],
    alt: ['union-find'],
  },
  'clone-graph': {
    tags: ['dfs', 'old-to-new map', 'deep copy'],
    pattern: 'graph-traversal',
    summary:
      'Given a reference to one node of a connected undirected graph, return a deep copy of the whole graph. Each node holds a value and a list of its neighbors.',
    clue: 'The graph has cycles, so a naive recursive copy never ends. Walking from the given node while remembering which nodes already have a copy reaches every node exactly once and lets copied neighbors be reused.',
    decoys: ['tree-dfs', 'linked-list', 'backtracking'],
  },
  'max-area-of-island': {
    tags: ['grid dfs', 'flood fill', 'area count'],
    pattern: 'graph-traversal',
    summary:
      'Given a grid of 1s (land) and 0s (water), return the number of cells in the largest island, where an island is a group of land cells joined horizontally or vertically. Return 0 if there is no land.',
    clue: 'Each island is a group of touching land cells, so a walk from an unseen land cell can report how many cells it covered. Every cell is visited once overall, so keeping the largest count costs nothing extra.',
    decoys: ['dp-grid', 'matrix', 'backtracking'],
  },
  'pacific-atlantic-water-flow': {
    tags: ['reverse dfs', 'multi-source', 'border cells'],
    pattern: 'graph-traversal',
    summary:
      'Given a grid of heights where water flows from a cell to any neighbor of equal or lower height, return every cell whose water can reach both the Pacific (top and left edges) and the Atlantic (bottom and right edges).',
    clue: 'Asking every cell whether it reaches an ocean repeats the same walks. Reversing the question and climbing uphill from each ocean border visits each cell once per ocean, and the answer is the cells both climbs reach.',
    decoys: ['dp-grid', 'backtracking', 'matrix'],
  },
  'surrounded-regions': {
    tags: ['border dfs', 'mark safe cells', 'in-place grid'],
    pattern: 'graph-traversal',
    summary:
      'Given a board of X and O cells, flip to X every group of O cells that is fully enclosed by X, where cells connect horizontally or vertically and a group touching the border is left alone. Change the board in place.',
    clue: 'The cells that survive are exactly the O cells connected to the border, which are easier to identify than the enclosed ones. Traverse from the border O cells to mark the safe ones, then flip everything unmarked.',
    decoys: ['matrix', 'dp-grid', 'backtracking'],
  },
  'rotting-oranges': {
    tags: ['multi-source bfs', 'level by level', 'grid'],
    pattern: 'bfs-shortest',
    summary:
      'Given a grid of empty cells, fresh oranges and rotten oranges, every minute each fresh orange next to a rotten one (up, down, left or right) rots. Return the minutes until no fresh orange is left, or -1 if some never rot.',
    clue: 'Many sources spread at the same time and the answer is a count of minutes, so the rot advances in rings. Put every rotten orange in one queue, count each round, and any fresh orange left at the end means -1.',
    decoys: ['matrix', 'math', 'dp-grid'],
  },
  'walls-and-gates': {
    tags: ['multi-source bfs', 'distance grid', 'in-place fill'],
    pattern: 'bfs-shortest',
    summary:
      'Given a grid of walls (-1), gates (0) and empty rooms (a very large number), fill each empty room with its number of steps to the nearest gate, moving up, down, left or right. A room that no gate can reach keeps its value.',
    clue: 'Every room wants the distance to its nearest gate among many gates. Starting from all gates at once, instead of from each room, means the first time a room is reached is already its shortest distance.',
    decoys: ['dp-grid', 'matrix', 'backtracking'],
  },
  'course-schedule': {
    tags: ['topological sort', 'cycle detection', 'indegree'],
    pattern: 'topological-sort',
    summary:
      'There are numCourses courses and a list of prerequisite pairs, each saying one course must be taken before another. Return whether it is possible to finish all of the courses.',
    clue: 'Prerequisites are directed edges, and all courses can be finished only if those edges contain no cycle. Repeatedly taking courses with no remaining prerequisites either completes the whole list or stalls on a cycle.',
    decoys: ['backtracking', 'union-find', 'binary-search'],
    alt: ['graph-traversal'],
  },
  'course-schedule-ii': {
    tags: ['topological sort', 'kahn algorithm', 'indegree'],
    pattern: 'topological-sort',
    summary:
      'Given numCourses and prerequisite pairs saying one course must come before another, return any order in which all courses can be taken, or an empty list if no such order exists.',
    clue: 'The question moves from whether an order exists to producing one. The sequence in which courses become free of prerequisites is that order, and ending with fewer than all courses exposes a cycle.',
    decoys: ['backtracking', 'union-find', 'binary-search'],
    alt: ['graph-traversal'],
  },
  'redundant-connection': {
    tags: ['union-find', 'cycle edge', 'path compression'],
    pattern: 'union-find',
    summary:
      'A tree of n nodes labeled 1 to n had one extra edge added. Return an edge from the given list whose removal leaves a tree again, choosing the last such edge in the list if several work.',
    clue: 'Going through the edges in order, the answer is the first edge whose two endpoints are already connected. Answering that connected-already question for every edge in near-constant time is what a disjoint-set structure does.',
    decoys: ['tree-dfs', 'hashing', 'backtracking'],
    alt: ['graph-traversal'],
  },
  'number-of-connected-components-in-an-undirected-graph': {
    tags: ['union-find', 'component count', 'path compression'],
    pattern: 'union-find',
    summary:
      'Given n nodes numbered 0 to n-1 and a list of undirected edges between them, return how many separate connected groups the graph has.',
    clue: 'Start with n separate groups and subtract one each time an edge joins two different groups. Tracking which group a node belongs to while groups merge is exactly what union-find maintains.',
    decoys: ['hashing', 'tree-dfs', 'binary-search'],
    alt: ['graph-traversal'],
  },
  'graph-valid-tree': {
    tags: ['union-find', 'cycle detection', 'edge count'],
    pattern: 'union-find',
    summary:
      'Given n nodes numbered 0 to n-1 and a list of undirected edges, return whether the edges form a valid tree: every node connected, with no cycle.',
    clue: 'A tree on n nodes has exactly n - 1 edges and no cycle. Merging the endpoints of each edge into one group rejects an edge whose endpoints are already joined, and n - 1 successful merges leave every node connected.',
    decoys: ['tree-dfs', 'hashing', 'binary-search'],
    alt: ['graph-traversal'],
  },
  'word-ladder': {
    tags: ['bfs', 'wildcard buckets', 'implicit graph'],
    pattern: 'bfs-shortest',
    summary:
      'Given a begin word, an end word and a word list, return the number of words in the shortest sequence from begin to end where each step changes exactly one letter and every word after the first is in the list. Return 0 if none exists.',
    clue: 'Words are nodes, one-letter differences are unweighted edges, and the goal is the fewest steps. Exploring in rings from the begin word makes the first ring containing the end word the answer.',
    decoys: ['backtracking', 'dp-linear', 'trie'],
  },
}
