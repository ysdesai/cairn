import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'unique-paths': {
    tags: ['grid paths', 'row by row', 'rolling array'],
    pattern: 'dp-grid',
    summary:
      'A robot starts at the top-left cell of an m by n grid and can only move right or down. Return how many different routes lead to the bottom-right cell.',
    clue: 'Every cell is entered from the cell above or the cell to its left, so its count is the sum of those two. The state is a grid position, and each row needs only the row before it.',
    decoys: ['backtracking', 'graph-traversal', 'matrix'],
    alt: ['math'],
  },
  'longest-common-subsequence': {
    tags: ['two strings', 'prefix table', 'common subsequence'],
    pattern: 'dp-grid',
    summary:
      'Given two strings, return the length of their longest common subsequence: characters that appear in both in the same order, not necessarily next to each other. Return 0 if there is none.',
    clue: 'The state is a prefix length of each string. Equal last characters extend the answer for both shorter prefixes, otherwise take the better of dropping one character from either side.',
    decoys: ['two-pointers', 'backtracking', 'hashing'],
  },
  'best-time-to-buy-and-sell-stock-with-cooldown': {
    tags: ['state machine', 'hold sell rest', 'rolling variables'],
    pattern: 'dp-linear',
    summary:
      'Given daily stock prices, return the maximum profit from any number of buy and sell transactions. You can hold at most one share, and after selling you cannot buy on the next day.',
    clue: 'Each day you are holding a share, just sold, or resting, and a sale locks out the next day. The best value in each state depends only on the previous day, so a few running values carried left to right cover every choice.',
    decoys: ['greedy', 'sliding-window', 'two-pointers'],
  },
  'coin-change-ii': {
    tags: ['unbounded knapsack', 'count combinations', 'coin by coin'],
    pattern: 'dp-knapsack',
    summary:
      'Given coin values you can each use any number of times and a target amount, return how many different combinations of coins add up to exactly that amount. Order does not matter.',
    clue: 'Counting combinations rather than sequences means deciding coin by coin: the state is the coins considered so far and the amount left. A fixed coin order keeps permutations from being counted twice.',
    decoys: ['backtracking', 'greedy', 'math'],
    alt: ['dp-linear'],
  },
  'target-sum': {
    tags: ['subset sum count', 'sign assignment', 'memoized recursion'],
    pattern: 'dp-knapsack',
    summary:
      'Given an array of non-negative integers and a target, place a plus or minus sign in front of every number. Return how many sign assignments make the expression equal the target.',
    clue: 'Each number takes one of two signs, and many different sign choices reach the same running total at the same index. Counting by (index, total) merges them, much like counting subsets for a fixed sum.',
    decoys: ['greedy', 'two-pointers', 'sliding-window'],
  },
  'interleaving-string': {
    tags: ['two strings', 'reachability table', 'weave check'],
    pattern: 'dp-grid',
    summary:
      'Given strings s1, s2 and s3, decide whether s3 can be made by weaving all the characters of s1 and s2 together while keeping the original order within each string.',
    clue: 'After using i characters of s1 and j of s2, the next character of s3 is fixed at position i + j. The state is the pair (i, j), and a greedy choice fails when both strings could supply the character.',
    decoys: ['two-pointers', 'greedy', 'backtracking'],
  },
  'longest-increasing-path-in-a-matrix': {
    tags: ['memoized dfs', 'grid', 'no cycles'],
    pattern: 'dp-grid',
    summary:
      'Given a matrix of integers, return the length of the longest path whose values strictly increase, moving up, down, left or right at each step. Diagonal moves and wrapping are not allowed.',
    clue: 'Strictly increasing steps never revisit a cell, so the longest path starting at a cell does not depend on how you got there. Cache that answer per cell and each cell is computed once.',
    decoys: ['backtracking', 'greedy', 'heap'],
    alt: ['topological-sort', 'graph-traversal'],
  },
  'distinct-subsequences': {
    tags: ['two strings', 'count subsequences', 'prefix table'],
    pattern: 'dp-grid',
    summary:
      'Given strings s and t, return in how many ways t can be formed by deleting characters from s without reordering the rest. Ways that keep different positions of s count as different.',
    clue: 'The state is how many characters of s and of t have been handled. When the current characters match you can use the match or skip it, and the two counts add; otherwise you can only skip.',
    decoys: ['two-pointers', 'backtracking', 'greedy'],
  },
  'edit-distance': {
    tags: ['two strings', 'insert delete replace', 'prefix table'],
    pattern: 'dp-grid',
    summary:
      'Given two words, return the minimum number of single-character insertions, deletions and replacements needed to turn the first word into the second.',
    clue: 'Comparing prefixes of both words, a mismatch offers three moves (insert, delete, replace), each leading to a smaller pair of prefixes. The state is the pair of prefix lengths.',
    decoys: ['two-pointers', 'greedy', 'backtracking'],
  },
  'burst-balloons': {
    tags: ['last to burst', 'range split', 'padded array'],
    pattern: 'dp-interval',
    summary:
      'Balloons carry numbers. Bursting one earns its number times the numbers of the nearest unburst balloons on each side (1 beyond the ends); return the most coins you can earn by bursting them all.',
    clue: 'Picking the first balloon to burst is hard because neighbors change, but picking the last one in a range keeps the two sides independent. Solve every range [l, r] by trying each balloon as the last.',
    decoys: ['greedy', 'backtracking', 'heap'],
  },
  'regular-expression-matching': {
    tags: ['two strings', 'star transitions', 'memoized recursion'],
    pattern: 'dp-grid',
    summary:
      'Given a lowercase text and a pattern of lowercase letters, "." and "*", decide whether the pattern matches the entire text. A "." matches any one character and "*" means zero or more of the character before it.',
    clue: 'The state is a position in the text and a position in the pattern, and a star gives two choices: drop the starred item or consume one more matching character. Many paths reach the same pair (i, j).',
    decoys: ['two-pointers', 'greedy', 'backtracking'],
  },
}
