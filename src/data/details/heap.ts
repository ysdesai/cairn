import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'kth-largest-element-in-a-stream': {
    tags: ['min-heap of size k', 'streaming', 'top-k'],
    pattern: 'heap',
    summary:
      'Build a class created with a number k and an initial list of integers. Each call to add takes a new integer and returns the kth largest value among everything seen so far, counting duplicates.',
    clue: 'Only the kth largest is ever asked for while values keep arriving. A min-heap capped at k items holds exactly the k best seen, and its root is the answer, so each add costs O(log k).',
    decoys: ['bst', 'binary-search', 'two-heaps'],
  },
  'last-stone-weight': {
    tags: ['max-heap', 'simulation', 'repeated extract-max'],
    pattern: 'heap',
    summary:
      'Given a list of stone weights, repeatedly take the two heaviest stones and smash them together: equal stones both vanish, otherwise the heavier one keeps the difference. Return the weight of the last stone, or 0 if none remain.',
    clue: 'Every round needs the two largest current values, and the leftover goes back into the pool. Repeated extract-max with reinsertion is what a max-heap does cheaply; re-sorting each round is wasted work.',
    decoys: ['greedy', 'dp-knapsack', 'stack'],
  },
  'k-closest-points-to-origin': {
    tags: ['max-heap of size k', 'squared distance', 'top-k'],
    pattern: 'heap',
    summary:
      'Given points on a plane and an integer k, return the k points nearest to the origin by straight-line distance. The answer is unique apart from the order of the points.',
    clue: 'You need the k best by a score, not a full ordering. A max-heap of size k keyed on squared distance (no square root needed) evicts the farthest point whenever a closer one arrives.',
    decoys: ['math', 'two-pointers', 'binary-search'],
  },
  'kth-largest-element-in-an-array': {
    tags: ['min-heap of size k', 'kth largest', 'top-k'],
    pattern: 'heap',
    summary:
      'Given an unsorted integer array and an integer k, return the kth largest element in sorted order, counting repeated values separately.',
    clue: 'Only one rank matters, so a full sort does more work than needed. A min-heap capped at k items leaves the kth largest at its root after one pass, in O(n log k).',
    decoys: ['binary-search', 'two-pointers', 'hashing'],
  },
  'task-scheduler': {
    tags: ['max-heap', 'cooldown queue', 'task counts'],
    pattern: 'heap',
    summary:
      'Given tasks labeled by uppercase letter and an integer n, each task takes one time unit and two runs of the same letter need at least n other units (tasks or idle) between them. Return the minimum total time to finish every task.',
    clue: 'Each time unit you want the available task with the most runs left, and a task that just ran is blocked for n units. A max-heap of remaining counts plus a cooldown queue models that directly.',
    decoys: ['sliding-window', 'dp-linear', 'intervals'],
    alt: ['greedy', 'math'],
  },
  'design-twitter': {
    tags: ['merge k sorted lists', 'max-heap', 'hash map of sets'],
    pattern: 'heap',
    summary:
      'Implement a small social feed: users post tweets, follow and unfollow each other, and request a feed of the 10 most recent tweets from themselves and everyone they follow, newest first.',
    clue: 'The feed is the 10 newest items across several per-user lists that are already in time order. A heap holding one entry per list pulls the newest each time, so you never read every tweet.',
    decoys: ['hashing', 'linked-list', 'two-pointers'],
    alt: ['design'],
  },
  'find-median-from-data-stream': {
    tags: ['max-heap and min-heap', 'running median', 'balanced halves'],
    pattern: 'two-heaps',
    summary:
      'Implement a structure that accepts integers one at a time and can report the median of everything added so far. The median is the middle value, or the mean of the two middle values when the count is even.',
    clue: 'The median sits at the boundary between the lower half and the upper half of the data. A max-heap for the lower half and a min-heap for the upper half, kept within one item in size, expose both middle values at their roots.',
    decoys: ['heap', 'bst', 'hashing'],
  },
}
