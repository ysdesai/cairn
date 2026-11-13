import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  subsets: {
    tags: ['include or exclude', 'decision tree', 'power set'],
    pattern: 'backtracking',
    summary:
      'Given an array of distinct integers, return every possible subset, including the empty one and the full array. The result must not contain duplicate subsets, and any order is fine.',
    clue: 'Every element is independently in or out, and all 2^n combinations must be listed. Choosing an element, recursing, then undoing the choice enumerates them with no repeats.',
    decoys: ['dp-knapsack', 'sliding-window', 'hashing'],
    alt: ['bit-manipulation'],
  },
  'combination-sum': {
    tags: ['start index', 'reuse allowed', 'prune on remainder'],
    pattern: 'backtracking',
    summary:
      'Given distinct positive integers and a target, return all unique combinations that sum to the target. A number may be used any number of times, and combinations that differ only in order count as the same.',
    clue: 'Every combination must be listed, not counted, and a number can be reused. Recursing from a start index (staying on the same index to reuse) and stopping once the remainder goes negative produces each combination once.',
    decoys: ['dp-knapsack', 'greedy', 'two-pointers'],
  },
  permutations: {
    tags: ['used array', 'n factorial', 'decision tree'],
    pattern: 'backtracking',
    summary: 'Given an array of distinct integers, return all possible orderings of its elements, in any order.',
    clue: 'Every ordering must be produced, so each position takes one of the elements not yet placed. Marking an element used, recursing, then unmarking it generates all n! arrangements.',
    decoys: ['dp-linear', 'hashing', 'two-pointers'],
  },
  'subsets-ii': {
    tags: ['sort then skip duplicates', 'power set', 'same-level dedupe'],
    pattern: 'backtracking',
    summary:
      'Given an array of integers that may contain duplicates, return all distinct subsets, including the empty one. No two subsets in the result may hold the same values, and any order is fine.',
    clue: 'This is plain subset enumeration, but equal values would repeat results. Sorting first and skipping a value equal to the previous one at the same recursion level removes repeats before they are built.',
    decoys: ['dp-knapsack', 'greedy', 'two-pointers'],
  },
  'combination-sum-ii': {
    tags: ['sort then skip duplicates', 'use each once', 'prune on remainder'],
    pattern: 'backtracking',
    summary:
      'Given integers that may repeat and a target, return all unique combinations that sum to the target. Each element of the input may be used at most once, and the result must not contain duplicate combinations.',
    clue: 'Each element is used once, and duplicate inputs must not create duplicate answers. Sorting, advancing the start index, and skipping equal neighbors at the same level handles both rules and prunes early.',
    decoys: ['dp-knapsack', 'two-pointers', 'greedy'],
  },
  'word-search': {
    tags: ['grid dfs', 'mark and unmark', 'early exit on mismatch'],
    pattern: 'backtracking',
    summary:
      'Given a grid of letters and a word, return true if the word can be traced through horizontally or vertically adjacent cells, using each cell at most once within a single path.',
    clue: 'One path may not reuse a cell, but different paths may share cells, so visited marks must be undone on the way back. Try each start, extend by DFS, mark the cell, then restore it.',
    decoys: ['graph-traversal', 'matrix', 'dp-grid'],
  },
  'palindrome-partitioning': {
    tags: ['partition by cut position', 'palindrome check', 'prune invalid prefix'],
    pattern: 'backtracking',
    summary:
      'Given a string, return every way to split it into consecutive pieces so that each piece reads the same forward and backward. The pieces must cover the whole string in order.',
    clue: 'All partitions must be listed, and a cut is only valid if the piece before it is a palindrome. At each position try every end index, recurse only on palindromic pieces, and undo the choice.',
    decoys: ['dp-linear', 'dp-interval', 'two-pointers'],
  },
  'letter-combinations-of-a-phone-number': {
    tags: ['digit to letters map', 'one choice per position', 'decision tree'],
    pattern: 'backtracking',
    summary:
      'Given a string of digits from 2 to 9, return every letter string the digits could spell on a classic phone keypad (2 maps to abc, 3 to def, and so on). Return an empty list for empty input.',
    clue: 'One letter is chosen per digit and every combination is required, so the choices form a tree as deep as the input. Fill one position at a time, recurse, and step back to try the next letter.',
    decoys: ['hashing', 'dp-linear', 'two-pointers'],
  },
  'n-queens': {
    tags: ['one queen per row', 'column and diagonal sets', 'pruning'],
    pattern: 'backtracking',
    summary:
      'Place n queens on an n by n chessboard so that no two share a row, column or diagonal. Return every distinct valid board, drawing queens as Q and empty squares as a period.',
    clue: 'Every valid placement is required and most partial boards fail early. Placing one queen per row while tracking used columns and both diagonals cuts off a bad branch the moment it conflicts.',
    decoys: ['dp-grid', 'matrix', 'graph-traversal'],
  },
}
