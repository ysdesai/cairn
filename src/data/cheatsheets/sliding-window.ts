import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The answer is a contiguous subarray or substring, not a subsequence.',
    'You want the longest, shortest, or best contiguous range that satisfies a condition.',
    'The condition can be kept up to date with a count, sum, or set as elements enter and leave.',
    'A fixed length k is given, or the condition only gets harder (or easier) as the range grows.',
    'The brute force recomputes the same summary over ranges that overlap almost entirely.',
  ],
  idea: 'Keep a range [left, right] and a running summary of what is inside it. Move right to take in one element, and move left only as far as needed to make the range valid again. Because neither edge ever moves backward, each element enters and leaves at most once, so the work is linear instead of quadratic. This only holds when shrinking from the left reliably repairs the condition.',
  template: `def longest_valid(s, k):
    # Longest substring with at most k distinct characters.
    count = {}
    left = 0
    best = 0
    for right, ch in enumerate(s):
        count[ch] = count.get(ch, 0) + 1      # grow: take in s[right]
        while len(count) > k:                 # shrink until valid again
            count[s[left]] -= 1
            if count[s[left]] == 0:
                del count[s[left]]
            left += 1
        best = max(best, right - left + 1)    # the range is valid here
    return best


def best_fixed(nums, k):
    # Largest sum of k consecutive numbers.
    total = sum(nums[:k])
    best = total
    for right in range(k, len(nums)):
        total += nums[right] - nums[right - k]    # one in, one out
        best = max(best, total)
    return best`,
  templateNote:
    'O(n) time, O(alphabet) space. Swap the dictionary for whatever summary the condition needs; for a shortest range, record the answer inside the while loop instead.',
  mistakes: [
    'Using it when the condition is not monotonic, such as arrays with negative numbers and an exact-sum target, where shrinking does not repair anything.',
    'Updating the best answer at the wrong moment: before the range is valid again, or outside the while loop when hunting the shortest range.',
    'Forgetting to remove the element at left from the summary, or leaving a zero count behind so a size check is wrong.',
    'Shrinking with an if where several removals may be needed to restore validity, so the range stays invalid.',
    'Off-by-one on length: the size of [left, right] is right - left + 1.',
  ],
}
