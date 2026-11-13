import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'contains-duplicate': {
    tags: ['hash set', 'seen before', 'early exit'],
    pattern: 'hashing',
    summary:
      'Given an integer array, return true if any value appears at least twice and false if every element is distinct.',
    clue: 'The whole question is "have I met this value before?". A set answers that in constant time as you scan, so one pass is enough and you can stop at the first repeat.',
    decoys: ['sliding-window', 'binary-search', 'greedy'],
  },
  'valid-anagram': {
    tags: ['character count', 'frequency map', 'fixed alphabet'],
    pattern: 'hashing',
    summary:
      'Given two strings, return true if the second is a rearrangement of the letters of the first, using every letter exactly once.',
    clue: 'Order is irrelevant and only the number of each character matters. Tallying counts for both strings and comparing the tallies settles it in one pass over each.',
    decoys: ['two-pointers', 'sliding-window', 'binary-search'],
  },
  'two-sum': {
    tags: ['complement lookup', 'hash map', 'one pass'],
    pattern: 'hashing',
    summary:
      'Given an unsorted integer array and a target, return the indices of the two numbers that add up to the target. Exactly one valid pair exists, and the same element cannot be used twice.',
    clue: 'The array is unsorted and the answer is original positions, so you cannot lean on order. For each number you only need to know whether target minus it appeared earlier, which a map answers in constant time.',
    decoys: ['two-pointers', 'binary-search', 'sliding-window'],
  },
  'group-anagrams': {
    tags: ['canonical key', 'grouping', 'hash map of lists'],
    pattern: 'hashing',
    summary:
      'Given a list of strings, group together the strings that are rearrangements of one another, and return the groups in any order.',
    clue: 'Strings that belong together share a canonical form, such as their sorted letters or their letter counts. Using that form as a map key puts every group in the same bucket.',
    decoys: ['trie', 'two-pointers', 'sliding-window'],
  },
  'top-k-frequent-elements': {
    tags: ['frequency count', 'bucket sort', 'hash map'],
    pattern: 'hashing',
    summary:
      'Given an integer array and a number k, return the k values that occur most often, in any order.',
    clue: 'Counting occurrences is the first step, and no count can exceed the array length. That bound lets you file values into buckets indexed by count and read from the top, skipping a comparison sort.',
    decoys: ['greedy', 'binary-search', 'dp-linear'],
    alt: ['heap'],
  },
  'product-of-array-except-self': {
    tags: ['prefix product', 'suffix product', 'no division'],
    pattern: 'prefix-suffix',
    summary:
      'Given an integer array, return an array where each position holds the product of every other element. Do not use division, and run in O(n) time.',
    clue: 'Each answer is everything to the left times everything to the right, and division is banned. Running products from each side, combined per index, give both halves in two passes.',
    decoys: ['math', 'dp-linear', 'hashing'],
  },
  'valid-sudoku': {
    tags: ['set per row', 'set per column', 'box index'],
    pattern: 'hashing',
    summary:
      'Given a partly filled 9x9 Sudoku board, return true if no digit repeats within any row, column or 3x3 box. Only the filled cells are checked, and the board need not be solvable.',
    clue: 'The task is only to detect a repeat inside a row, column or box, not to solve anything. A set for each of the 27 units, checked as you read each cell once, catches every violation.',
    decoys: ['backtracking', 'matrix', 'dp-grid'],
  },
  'encode-and-decode-strings': {
    tags: ['length prefix', 'encoding format', 'serialization'],
    pattern: 'design',
    summary:
      'Write an encoder that turns a list of strings into one string, and a decoder that rebuilds the exact original list from it, with no state shared between the two. The strings can contain any characters.',
    clue: 'Any delimiter can also appear inside a string, so splitting on one breaks. What is needed is a format designed so the decoder can step through it exactly, such as writing each length before its text, with no lookup or shared state.',
    decoys: ['hashing', 'stack', 'two-pointers'],
  },
  'longest-consecutive-sequence': {
    tags: ['hash set', 'sequence start', 'linear time'],
    pattern: 'hashing',
    summary:
      'Given an unsorted integer array, return the length of the longest run of values that increase by one each step, wherever they sit in the array. The algorithm must run in O(n) time.',
    clue: 'Sorting would cost O(n log n), which the bound forbids. With all values in a set, you only start counting at a value whose predecessor is absent, so each run is walked once.',
    decoys: ['sliding-window', 'dp-linear', 'binary-search'],
  },
}
