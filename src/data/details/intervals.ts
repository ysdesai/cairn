import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'insert-interval': {
    tags: ['sorted intervals', 'three-phase scan', 'merge overlap'],
    pattern: 'intervals',
    summary:
      'You get a list of non-overlapping ranges already ordered by start, plus one new range. Add the new range, merging anything it overlaps (ranges that touch at an endpoint overlap), and return the ordered list.',
    clue: 'The ranges are already ordered, so one left-to-right pass covers everything: copy those that end before the new one starts, absorb those that overlap it, then copy the rest. No re-sorting is needed.',
    decoys: ['binary-search', 'heap', 'two-pointers'],
  },
  'merge-intervals': {
    tags: ['sort by start', 'merge overlap', 'single sweep'],
    pattern: 'intervals',
    summary:
      'Given a list of ranges in no particular order, combine every group of overlapping ranges into one and return the resulting non-overlapping ranges. Ranges that touch at an endpoint overlap.',
    clue: 'After ordering by start, each group of overlapping ranges is a contiguous run. One sweep that compares each start to the end of the last merged range finds every overlap.',
    decoys: ['union-find', 'graph-traversal', 'two-pointers'],
  },
  'non-overlapping-intervals': {
    tags: ['sort by start', 'keep smaller end', 'count overlaps'],
    pattern: 'intervals',
    summary:
      'Given a list of ranges, return the fewest ranges you must delete so that no two of the remaining ones overlap. Ranges that only touch at an endpoint do not count as overlapping.',
    clue: 'Sort the ranges and sweep, tracking the end of the last range kept. On each overlap, drop the one that ends later, since it blocks more of what follows. The deletions counted are the answer.',
    decoys: ['dp-linear', 'backtracking', 'heap'],
    alt: ['greedy'],
  },
  'meeting-rooms': {
    tags: ['sort by start', 'adjacent overlap', 'early exit'],
    pattern: 'intervals',
    summary:
      'Given the start and end times of meetings, decide whether one person could attend all of them, meaning no two meetings overlap in time. A meeting may start the moment another ends.',
    clue: 'Any clash shows up between meetings that are neighbors in start-time order. Sort once and compare each start with the previous end, instead of testing every pair.',
    decoys: ['hashing', 'heap', 'binary-search'],
  },
  'meeting-rooms-ii': {
    tags: ['sweep line', 'sorted starts and ends', 'peak overlap'],
    pattern: 'intervals',
    summary:
      'Given the start and end times of meetings, return the smallest number of rooms that lets every meeting happen, with no two overlapping meetings sharing a room. A meeting may start in a room the moment another ends there.',
    clue: 'The answer is the most meetings in progress at any instant. Walking through the start and end times in sorted order, adding one at each start and subtracting one at each end, gives that peak.',
    decoys: ['graph-traversal', 'dp-linear', 'backtracking'],
    alt: ['heap'],
  },
  'minimum-interval-to-include-each-query': {
    tags: ['offline queries', 'min-heap by size', 'lazy deletion'],
    pattern: 'heap',
    summary:
      'Given a list of ranges and a list of query points, return for each point the size of the smallest range that contains it (end minus start plus one), or -1 if none does. Answers go back in query order.',
    clue: 'Answer the queries in increasing order of value, pushing in each range that has started and keeping them ordered by size. Ranges that have already ended are popped lazily, and the top is the best answer.',
    decoys: ['binary-search', 'two-pointers', 'prefix-suffix'],
    alt: ['intervals'],
  },
}
