import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The statement asks for a minimum, a maximum or a yes/no answer, and one pass or O(1) space is expected.',
    'A running total, reach or balance can be thrown away or reset once it turns bad.',
    'Taking the smallest, largest or earliest available item first seems obviously safe.',
    'Brute force would try every choice, but the choices look independent once you track one summary value.',
    'You can state why a local choice never hurts later ones, usually with a swap argument.',
  ],
  idea: 'Make the locally best choice, commit to it, and never revisit it. This is correct only when an exchange argument shows that any optimal answer can be rearranged to include that choice. Most of the effort goes into finding the one summary value to carry forward, such as the farthest reach, a running balance, or a pair of bounds, and into the argument for why it is enough.',
  template: `def can_reach(jumps):
    farthest = 0
    for i, step in enumerate(jumps):
        if i > farthest:
            return False            # stuck before reaching i
        farthest = max(farthest, i + step)
    return True


def min_jumps(jumps):
    count = end = farthest = 0
    for i in range(len(jumps) - 1):
        farthest = max(farthest, i + jumps[i])
        if i == end:                # current jump's range is used up
            count += 1
            end = farthest          # commit to the best landing spot
    return count


def max_subarray(nums):
    best = running = nums[0]
    for x in nums[1:]:
        running = max(x, running + x)   # drop a prefix that went negative
        best = max(best, running)
    return best`,
  templateNote: 'O(n) time, O(1) space. Swap in your own summary value (reach, balance, last seen index) and your own reset rule.',
  mistakes: [
    'Using a greedy rule without checking it against a small counterexample, such as coins with denominations 1, 3 and 4.',
    'Breaking ties arbitrarily when sorting, for example sorting by start when the argument needs end.',
    'Resetting the running value at the wrong moment, such as treating an exactly empty tank as a failure.',
    'Looping to the last index in the jump-count version, which counts one jump too many.',
    'Returning the last reset point in a circular problem without checking that the overall total is non-negative.',
  ],
}
