import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'valid-palindrome': {
    tags: ['converging pointers', 'skip non-alphanumeric', 'case folding'],
    pattern: 'two-pointers',
    summary:
      'Given a string, return true if it reads the same forward and backward once you ignore case and drop every character that is not a letter or digit.',
    clue: 'A palindrome is symmetric about its center, so the outermost pair must match, then the next pair inward. One index at each end, moving toward the middle, checks that without copying the string.',
    decoys: ['stack', 'hashing', 'fast-slow'],
  },
  'two-sum-ii-input-array-is-sorted': {
    tags: ['converging pointers', 'sorted input', 'constant space'],
    pattern: 'two-pointers',
    summary:
      'Given numbers already sorted in ascending order and a target, return the positions of the two numbers that add up to the target. Exactly one such pair exists.',
    clue: 'Sorted input plus a pair that must hit a target: comparing the two ends tells you which end to give up, so every step discards a candidate without extra memory.',
    decoys: ['hashing', 'sliding-window', 'greedy'],
  },
  '3sum': {
    tags: ['sort first', 'anchor plus pair', 'skip duplicates'],
    pattern: 'two-pointers',
    summary:
      'Given an integer array, return every distinct triplet of values, taken from three different positions, that sums to zero. The result must not contain the same triplet twice, and the order of triplets does not matter.',
    clue: 'Fixing one value leaves a sum-to-target pair problem, and sorting makes that pair solvable from both ends. Sorting also puts equal values side by side, so duplicate triplets are easy to skip.',
    decoys: ['backtracking', 'binary-search', 'sliding-window'],
    alt: ['hashing'],
  },
  'container-with-most-water': {
    tags: ['converging pointers', 'move the shorter side', 'area maximization'],
    pattern: 'two-pointers',
    summary:
      'Given a list of vertical line heights at consecutive positions, choose two lines that, with the x-axis, hold the most water, and return that amount. The container cannot be tilted.',
    clue: 'Area is width times the shorter of the two lines. Starting at the widest pair, only moving the shorter line can ever help, since moving the taller one shrinks width without raising the limit.',
    decoys: ['sliding-window', 'monotonic-stack', 'dp-linear'],
  },
  'trapping-rain-water': {
    tags: ['converging pointers', 'running max from each side', 'constant space'],
    pattern: 'two-pointers',
    summary:
      'Given the heights of bars of width one placed side by side, return how much rain water the terrain holds after it rains.',
    clue: 'Water above a bar is capped by the lower of the tallest bars on its left and right. Tracking both maxima with two inward pointers, and settling whichever side is lower, finds each cap in a single pass.',
    decoys: ['sliding-window', 'greedy', 'binary-search'],
    alt: ['prefix-suffix', 'monotonic-stack'],
  },
}
