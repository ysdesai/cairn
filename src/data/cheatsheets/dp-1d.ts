import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The answer for a prefix, a position or an amount is built from answers for smaller ones.',
    'The statement asks for a count, a minimum, a maximum or a yes or no over many choices, not for the choices themselves.',
    'At each element the choice is binary: take it or skip it, extend the previous run or start fresh.',
    'A brute-force recursion would recompute the same subproblem many times.',
    'Items may be reused (coins) or used once (a partition), with a target sum or amount to reach.',
  ],
  idea: 'Define dp[i] as the answer for the first i items, or for target i, and write it in terms of a few earlier entries. Filling the table from the base case upward means every subproblem is solved once, turning an exponential search into polynomial work: linear for a chain of positions, items times target for a knapsack. When dp[i] reads only the last one or two entries, two variables replace the table. In a one-dimensional knapsack, the direction of the amount loop decides whether an item can be reused.',
  template: `def max_no_adjacent(nums):
    prev, cur = 0, 0                # best for prefix i-2 and i-1
    for x in nums:
        prev, cur = cur, max(cur, prev + x)   # skip x, or take x
    return cur


def fewest_coins(coins, amount):
    INF = float('inf')
    dp = [0] + [INF] * amount       # dp[a]: fewest coins to make a
    for a in range(1, amount + 1):
        dp[a] = min((dp[a - c] + 1 for c in coins if c <= a), default=INF)
    return dp[amount] if dp[amount] != INF else -1


def can_partition(nums):
    half, odd = divmod(sum(nums), 2)
    if odd:
        return False
    reach = [True] + [False] * half   # reach[s]: some subset sums to s
    for x in nums:
        for s in range(half, x - 1, -1):    # backward: each x used once
            reach[s] = reach[s] or reach[s - x]
    return reach[half]`,
  templateNote: 'O(n) to O(n * target) time, O(1) to O(target) space. Adapt the base case, the recurrence and the loop direction: forward over amounts reuses items, backward uses each once.',
  mistakes: [
    'Wrong base case, such as dp[0] = 0 where the problem needs 1 (counting ways) or infinity (impossible states).',
    'Iterating amounts forward in a 0/1 knapsack, which silently lets an item be used more than once.',
    'Returning infinity instead of -1 when the target is unreachable, or adding 1 to infinity without a guard.',
    'Reading dp[i - 2] when i < 2, or mishandling a digit 0 in a decoding problem.',
    'Forgetting that a subsequence or run may start anywhere, so the answer is the maximum over all dp[i], not dp[n - 1].',
  ],
}
