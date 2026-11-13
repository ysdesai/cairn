import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'climbing-stairs': {
    tags: ['fibonacci recurrence', 'rolling variables', 'bottom-up dp'],
    pattern: 'dp-linear',
    summary:
      'You climb a staircase of n steps, taking either one or two steps at a time. Return how many distinct sequences of moves lead exactly to the top.',
    clue: 'The ways to reach step n are the ways to reach n - 1 plus the ways to reach n - 2, so each answer depends only on the two before it. Fill the counts left to right.',
    decoys: ['backtracking', 'greedy', 'binary-search'],
  },
  'min-cost-climbing-stairs': {
    tags: ['min cost recurrence', 'rolling variables', 'bottom-up dp'],
    pattern: 'dp-linear',
    summary:
      'Each stair has a cost you pay whenever you climb up from it, taking one or two stairs at a time. Starting on stair 0 or 1 and getting past the last stair, return the lowest total cost.',
    clue: 'The cheapest way to reach stair i comes from stair i - 1 or i - 2, each plus the cost of the stair you left, so each position depends only on the two before it. That is a recurrence over positions.',
    decoys: ['greedy', 'weighted-paths', 'bfs-shortest'],
  },
  'house-robber': {
    tags: ['take or skip', 'rolling variables', 'bottom-up dp'],
    pattern: 'dp-linear',
    summary:
      'Houses along a street each hold some cash, and robbing two adjacent houses triggers an alarm. Given the amounts in order, return the most you can take.',
    clue: 'At each house the choice is rob it and add the best from two houses back, or skip it and keep the best so far. Only the last two best values need to be carried forward.',
    decoys: ['greedy', 'backtracking', 'dp-knapsack'],
  },
  'house-robber-ii': {
    tags: ['circular array', 'take or skip', 'two linear passes'],
    pattern: 'dp-linear',
    summary:
      'Houses with cash stand in a circle, so the first and last are neighbors, and robbing two adjacent houses triggers an alarm. Given the amounts, return the most you can take.',
    clue: 'The circle adds exactly one conflict, first against last. Run the straight-line take-or-skip recurrence twice, once without the first house and once without the last, and keep the larger result.',
    decoys: ['greedy', 'backtracking', 'dp-knapsack'],
  },
  'longest-palindromic-substring': {
    tags: ['expand around center', 'palindromes', 'constant space'],
    pattern: 'two-pointers',
    summary:
      'Given a string, return its longest contiguous piece that reads the same forward and backward. If several tie for longest, any one of them is accepted.',
    clue: 'A palindrome mirrors around its center, so every one grows outward from one of the 2n - 1 centers (a character or a gap). Two pointers spreading from each center test them in O(1) space.',
    decoys: ['sliding-window', 'stack', 'hashing'],
    alt: ['dp-interval'],
  },
  'palindromic-substrings': {
    tags: ['expand around center', 'palindromes', 'counting'],
    pattern: 'two-pointers',
    summary:
      'Given a string, return how many of its contiguous substrings are palindromes. Substrings at different positions count separately, even when their text is identical.',
    clue: 'Every palindrome has a center, so expanding outward from each of the 2n - 1 centers and counting each successful step counts every palindromic substring exactly once.',
    decoys: ['sliding-window', 'hashing', 'backtracking'],
    alt: ['dp-interval'],
  },
  'decode-ways': {
    tags: ['prefix recurrence', 'counting ways', 'rolling variables'],
    pattern: 'dp-linear',
    summary:
      'A string of digits encodes a message where 1 stands for A, 2 for B, and so on up to 26 for Z. Return the number of ways to decode the whole string, which is 0 when it cannot be decoded.',
    clue: 'The count for a prefix adds the count one digit back (if the last digit is 1 to 9) and the count two digits back (if the last two digits form 10 to 26). Each prefix needs only shorter prefixes.',
    decoys: ['backtracking', 'greedy', 'two-pointers'],
  },
  'coin-change': {
    tags: ['unbounded knapsack', 'fewest items', 'bottom-up dp'],
    pattern: 'dp-knapsack',
    summary:
      'Given coin values you can each use any number of times and a target amount, return the fewest coins that add up to exactly that amount, or -1 if no combination works.',
    clue: 'Coins are reusable and the goal is an exact total, so the fewest coins for amount a is one plus the fewest for a - coin, minimized over every coin. The state is the remaining amount, as in an unbounded knapsack.',
    decoys: ['greedy', 'backtracking', 'math'],
    alt: ['dp-linear', 'bfs-shortest'],
  },
  'maximum-product-subarray': {
    tags: ['track max and min', 'negative flip', 'rolling variables'],
    pattern: 'dp-linear',
    summary:
      'Given an integer array that may hold negatives and zeros, return the largest product of any non-empty contiguous subarray.',
    clue: 'A negative number turns the smallest product into the largest, so the best product ending at i needs both the max and the min ending at i - 1. Carry that pair forward one position at a time.',
    decoys: ['sliding-window', 'greedy', 'two-pointers'],
    alt: ['prefix-suffix'],
  },
  'word-break': {
    tags: ['prefix reachability', 'boolean table', 'word lookup'],
    pattern: 'dp-linear',
    summary:
      'Given a string and a list of words, decide whether the string can be cut into a sequence of words from the list. Each word may be used any number of times.',
    clue: 'A prefix of length i can be split if some shorter prefix j can be split and s[j:i] is a word. That yields a boolean answer per prefix length, built from shorter prefixes.',
    decoys: ['backtracking', 'greedy', 'hashing'],
  },
  'longest-increasing-subsequence': {
    tags: ['best chain ending at i', 'quadratic table', 'subsequence'],
    pattern: 'dp-linear',
    summary:
      'Given an integer array, return the length of its longest strictly increasing subsequence. A subsequence keeps the original order but may skip elements.',
    clue: 'The longest chain ending at i extends the best chain ending at any earlier, smaller value. One answer per index, each built from the earlier indices, gives an O(n^2) table.',
    decoys: ['sliding-window', 'monotonic-stack', 'backtracking'],
    alt: ['binary-search'],
  },
  'partition-equal-subset-sum': {
    tags: ['0/1 knapsack', 'subset sum', 'boolean table'],
    pattern: 'dp-knapsack',
    summary:
      'Given an array of positive integers, decide whether it can be split into two groups, with every number in exactly one group, so that both groups have the same sum.',
    clue: 'Equal groups means some subset sums to exactly half the total. Each number is used once or not at all, and the state is the sum still needed: a 0/1 knapsack feasibility question.',
    decoys: ['greedy', 'backtracking', 'two-pointers'],
  },
}
