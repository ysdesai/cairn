import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The statement says "return all" subsets, permutations, combinations, partitions or boards.',
    'The answer is built from a sequence of choices, and each choice limits the later ones.',
    'Input sizes are tiny (often 20 or fewer), which allows exponential search.',
    'A partial answer can be rejected early: a sum too big, a queen under attack, a letter that does not match.',
    'The same element or cell may not be used twice in one answer, but may appear in different answers.',
  ],
  idea: 'Build one answer a piece at a time: choose, recurse on what remains, then undo the choice so the next branch starts clean. The recursion walks a decision tree, and the work is in pruning branches that cannot lead to a valid answer. Duplicates are avoided by sorting and skipping equal values at the same level, not by filtering results afterward.',
  template: `def subsets_with_dups(nums):
    nums.sort()                      # sorting makes equal values adjacent
    result, path = [], []

    def dfs(start):
        result.append(path[:])       # record a copy, not the live list
        for i in range(start, len(nums)):
            if i > start and nums[i] == nums[i - 1]:
                continue             # skip a repeat at the same level
            path.append(nums[i])     # choose
            dfs(i + 1)               # explore (pass i to allow reuse)
            path.pop()               # undo

    dfs(0)
    return result`,
  templateNote: 'Exponential time, O(depth) extra space. Adapt the loop range (all unused items for permutations), the stop condition (target reached) and the pruning test.',
  mistakes: [
    'Appending the live path to the results instead of a copy, so every entry ends up empty.',
    'Forgetting to undo the choice, such as the visited mark or the appended item, before the next branch.',
    'Skipping duplicates with i > 0 instead of i > start, which also drops valid answers.',
    'Pruning too late, after recursing, instead of testing the constraint before making the choice.',
    'Reusing an index when each element may be used once, or advancing it when reuse is allowed.',
  ],
}
