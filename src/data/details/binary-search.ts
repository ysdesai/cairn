import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'binary-search': {
    tags: ['classic binary search', 'sorted array', 'halving'],
    pattern: 'binary-search',
    summary:
      'Given an array of distinct integers sorted in ascending order and a target, return the index of the target, or -1 if it is not present.',
    clue: 'Sorted input and an O(log n) requirement: comparing the target with the middle element rules out half of the remaining range every step.',
    decoys: ['two-pointers', 'hashing', 'heap'],
  },
  'search-a-2d-matrix': {
    tags: ['flattened index', 'virtual 1d array', 'row and column math'],
    pattern: 'binary-search',
    summary:
      'Given an m by n integer matrix whose rows are sorted ascending and where the first value of each row is greater than the last value of the row before it, report whether a target is present.',
    clue: 'Because each row begins past the end of the previous one, the grid read row by row is one sorted sequence, and the log(m * n) bound asks you to halve that sequence.',
    decoys: ['matrix', 'two-pointers', 'hashing'],
  },
  'koko-eating-bananas': {
    tags: ['binary search on answer', 'feasibility check', 'ceiling division'],
    pattern: 'search-on-answer',
    summary:
      'Koko has piles of bananas and h hours to eat them all. Each hour she picks one pile and eats up to k bananas from it, even if fewer remain; return the smallest integer k that lets her finish every pile in time.',
    clue: 'The piles are not sorted, but feasibility is monotonic: if speed k finishes in time, every faster speed does too. You want the smallest feasible value, so search the range of speeds, not the array.',
    decoys: ['greedy', 'math', 'heap'],
  },
  'find-minimum-in-rotated-sorted-array': {
    tags: ['rotated array', 'compare with right end', 'pivot search'],
    pattern: 'binary-search',
    summary:
      'A sorted array of unique integers was rotated an unknown number of times. Return its smallest element.',
    clue: 'The array is sorted apart from one break, and the bound is O(log n). Comparing the middle with the right end tells you which side of the break the minimum lies on.',
    decoys: ['two-pointers', 'heap', 'hashing'],
  },
  'search-in-rotated-sorted-array': {
    tags: ['rotated array', 'sorted half check', 'modified binary search'],
    pattern: 'binary-search',
    summary:
      'A sorted array of distinct integers was rotated at an unknown pivot. Given a target, return its index, or -1 if it is absent.',
    clue: 'Sorted data with a single rotation and an O(log n) bound: at every middle, one half is still in order, so you can tell whether the target falls inside it.',
    decoys: ['two-pointers', 'hashing', 'heap'],
  },
  'time-based-key-value-store': {
    tags: ['hash map of lists', 'timestamp lookup', 'upper bound'],
    pattern: 'binary-search',
    summary:
      'Build a store that saves string values under string keys, each with a timestamp that increases over time for a given key. A query returns the value saved at the latest timestamp not after the one given, or an empty string if none.',
    clue: 'Timestamps for a key arrive in increasing order, so its history is already sorted. Each query asks for the last entry at or before a time, which is a boundary search in that history.',
    decoys: ['heap', 'greedy', 'two-pointers'],
    alt: ['design', 'hashing'],
  },
  'median-of-two-sorted-arrays': {
    tags: ['partition search', 'search the smaller array', 'median by partition'],
    pattern: 'binary-search',
    summary:
      'Given two sorted integer arrays, return the median of all their elements combined, as if they were merged.',
    clue: 'Two sorted inputs and a logarithmic bound rule out merging. Choosing how many elements the smaller array gives to the left half fixes the split, and each choice can be checked against its neighbors.',
    decoys: ['two-pointers', 'two-heaps', 'heap'],
  },
}
