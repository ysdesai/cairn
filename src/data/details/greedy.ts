import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'maximum-subarray': {
    tags: ['kadane', 'running sum', 'reset on negative'],
    pattern: 'greedy',
    summary:
      'Given an integer array, find the contiguous non-empty stretch with the largest sum and return that sum. Values may be negative.',
    clue: 'A running sum that has gone negative can only hurt whatever comes next, so it is always safe to drop it and start fresh at the current element. That local decision is never regretted.',
    decoys: ['sliding-window', 'two-pointers', 'heap'],
    alt: ['dp-linear'],
  },
  'jump-game': {
    tags: ['farthest reach', 'single pass', 'reachability'],
    pattern: 'greedy',
    summary:
      'Each array value is the longest jump you can make from that position. Starting at the first index, decide whether the last index can be reached.',
    clue: 'You never need to know which jumps to take, only how far the best one could carry you. Tracking the farthest reachable index while scanning commits to nothing and answers the question.',
    decoys: ['backtracking', 'dp-linear', 'two-pointers'],
  },
  'jump-game-ii': {
    tags: ['jump windows', 'farthest reach', 'single pass'],
    pattern: 'greedy',
    summary:
      'Each array value is the longest jump you can make from that position, and the last index is always reachable. Return the fewest jumps needed to get from the first index to the last.',
    clue: 'Take one jump only when you reach the end of the range the previous jump covered, and aim it at the position that reaches farthest. Delaying each decision as long as possible keeps the jump count minimal.',
    decoys: ['backtracking', 'dp-linear', 'two-pointers'],
    alt: ['bfs-shortest'],
  },
  'gas-station': {
    tags: ['circular route', 'running tank', 'reset start'],
    pattern: 'greedy',
    summary:
      'Gas stations sit on a circular road, each with some fuel to collect and a fuel cost to reach the next one. Starting with an empty tank, return the station from which you can drive a full lap in order, or -1 if no station works.',
    clue: 'If the tank goes negative on the way from station i to j, no start between i and j can work either. Skip all of them and try j + 1. Because the lap is feasible only if total gas covers total cost, that one pass finds the start.',
    decoys: ['dp-linear', 'math', 'heap'],
  },
  'hand-of-straights': {
    tags: ['smallest first', 'consecutive groups', 'card counts'],
    pattern: 'greedy',
    summary:
      'Given a list of card values and a group size, decide whether every card can be dealt into groups of exactly that size, each made of consecutive values, with no card left over.',
    clue: 'The smallest remaining card can only be the start of a group, since nothing below it is left. Forcing that group immediately is the only possible move, so no alternatives need to be explored.',
    decoys: ['backtracking', 'sliding-window', 'dp-linear'],
    alt: ['heap'],
  },
  'merge-triplets-to-form-target-triplet': {
    tags: ['filter invalid', 'element-wise max', 'coverage check'],
    pattern: 'greedy',
    summary:
      'You have a list of triplets, and one operation picks two of them and overwrites one with the entry-by-entry maximum of the pair. Decide whether some triplet can be made equal to a given target.',
    clue: 'Taking the maximum can only raise a value, so any triplet with an entry above the target is useless and can be thrown away. Of the rest, merging all of them is never worse, so check that each target value is reached.',
    decoys: ['backtracking', 'dp-knapsack', 'hashing'],
  },
  'partition-labels': {
    tags: ['last occurrence', 'farthest end', 'single pass'],
    pattern: 'greedy',
    summary:
      'Cut a string into as many contiguous pieces as possible so that no letter appears in more than one piece. Return the length of each piece, left to right.',
    clue: 'Once you include a letter, the piece must stretch to its last occurrence. Extending the end as you scan and cutting the moment you reach it makes the earliest valid cut, which gives the most pieces.',
    decoys: ['two-pointers', 'sliding-window', 'dp-linear'],
    alt: ['intervals'],
  },
  'valid-parenthesis-string': {
    tags: ['open count range', 'wildcard bounds', 'constant space'],
    pattern: 'greedy',
    summary:
      'A string holds opening brackets, closing brackets and wildcards that may stand for either bracket or for nothing. Decide whether the wildcards can be assigned so the brackets are balanced.',
    clue: 'Track only the lowest and highest count of open brackets the wildcards still allow, not what each one stands for. Fail if the high bound goes below zero, clamp the low bound at zero, and accept if the low bound ends at zero.',
    decoys: ['backtracking', 'two-pointers', 'heap'],
    alt: ['stack'],
  },
}
