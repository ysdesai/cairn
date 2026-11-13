import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input is sorted, or sorting it first costs nothing you care about.',
    'You need a pair or triple that hits a target, or the best pair by some measure.',
    'The answer is symmetric from both ends: palindromes, mirrored comparisons.',
    'Constant extra space is required, which rules out a hash map.',
    'The value at a position depends on the best seen from its left and from its right.',
  ],
  idea: 'Put one index at each end and decide, from the two values alone, which end can be thrown away. Each step shrinks the range by one, so a quadratic search over pairs becomes a single pass. The real work is the argument for why the discarded end can never be part of a better answer.',
  template: `def three_sum(nums, target=0):
    nums.sort()
    result = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue                       # skip a repeated anchor
        left, right = i + 1, len(nums) - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total < target:
                left += 1                  # need a bigger sum
            elif total > target:
                right -= 1                 # need a smaller sum
            else:
                result.append([nums[i], nums[left], nums[right]])
                left += 1
                right -= 1
                while left < right and nums[left] == nums[left - 1]:
                    left += 1              # skip a repeated second value
    return result`,
  templateNote: 'O(n) per pair search on sorted input, so O(n^2) for triples after an O(n log n) sort, with O(1) extra space. For a plain pair, drop the outer loop and the duplicate skips.',
  mistakes: [
    'Using it on unsorted data without sorting first, or sorting when original indices are needed.',
    'Moving both pointers after a mismatch instead of only the one the comparison rules out.',
    'Forgetting to skip duplicates when every distinct answer is wanted.',
    'Looping on left <= right when the two indices must be different elements.',
    'Moving the taller side in a maximize-area problem, which can only shrink the width.',
  ],
}
