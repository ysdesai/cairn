import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'Two strings or sequences are compared, aligned, matched or merged.',
    'A grid is walked with restricted moves, and you count paths or optimize a cost.',
    'The state needs two numbers: positions in two inputs, an index and a remaining amount, or a range [l, r].',
    'Each step is a small choice (match, skip, insert, delete, take, leave) that shrinks both inputs or one of them.',
    'The same pair of positions is reached by many different choice histories.',
  ],
  idea: 'Let dp[i][j] be the answer for the first i items of one input and the first j of the other, or for a cell, or for the range from i to j. Each entry is computed from smaller states: the neighbors at (i-1, j-1), (i-1, j) and (i, j-1) for sequences and grids, or the shorter ranges inside it for interval problems. Many histories collapse into one state, which is why the table has only n * m entries. A row that reads only the row before it can often shrink to a single row.',
  template: `def lcs(a, b):
    m, n = len(a), len(b)
    # dp[i][j]: answer for a[:i] and b[:j]; row and column 0 are the empty prefix
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]


def max_burst(nums):
    a = [1] + nums + [1]
    n = len(a)
    dp = [[0] * n for _ in range(n)]    # dp[l][r]: best for balloons strictly between l and r
    for gap in range(2, n):             # shorter ranges first
        for l in range(n - gap):
            r = l + gap
            # k is the last balloon burst, so both sides are already independent
            dp[l][r] = max(dp[l][k] + a[l] * a[k] * a[r] + dp[k][r] for k in range(l + 1, r))
    return dp[0][n - 1]`,
  templateNote: 'O(m * n) time and space for two sequences; O(n^3) time for interval DP. Adapt the base row and column, the match and mismatch transitions, and what splits a range.',
  mistakes: [
    'Mixing up the table index i with the string index i - 1, which causes off-by-one errors on the first character.',
    'Leaving the base row and column wrong: edit distance needs i and j there, not zeros.',
    'Filling in an order where a needed state is not ready yet, such as interval DP looped by start index instead of by range length.',
    'Counting permutations instead of combinations by putting the amount loop outside the coin loop.',
    'Overwriting a rolled-up row in place and reading a value that has already been updated for this row.',
  ],
}
