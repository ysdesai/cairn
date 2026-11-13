import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input is sorted, or sorted in pieces: a rotated array, a matrix read row by row, timestamps in order.',
    'The statement asks for O(log n) time, or the input is far too large for a linear scan.',
    'You are asked for the smallest or largest value that satisfies a condition, and checking one candidate is easy.',
    'A yes/no test flips only once as the candidate grows: if a speed or capacity works, every larger one works too.',
    'You need the last entry at or before a point, or the first at or after it, in ordered data.',
  ],
  idea: 'Keep a range that must contain the answer, test its middle, and throw away the half that cannot. This works whenever the test result is monotonic: false up to some point and true afterward, or the reverse. The array does not have to be sorted. What must be ordered is the answer space, so the same loop finds a value in a list or the best number that passes a feasibility check.',
  template: `def first_true(lo, hi, ok):
    # Smallest x in [lo, hi] with ok(x) True. ok must flip False -> True once.
    # hi is a safe fallback: it is returned when nothing below it passes.
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid          # mid may be the answer, keep it
        else:
            lo = mid + 1      # mid fails, so the answer is above it
    return lo

# Sorted array: first index whose value is >= target (len(nums) if none).
def lower_bound(nums, target):
    return first_true(0, len(nums), lambda i: nums[i] >= target)

# Search on the answer: smallest eating speed that finishes within h hours.
def min_speed(piles, h):
    hours = lambda k: sum((p + k - 1) // k for p in piles)
    return first_true(1, max(piles), lambda k: hours(k) <= h)`,
  templateNote: 'O(log range) probes, each costing one test. Adapt the range and the test; for the last true value, search for the first false and step back one.',
  mistakes: [
    'Setting lo = mid instead of mid + 1, so a two-element range never shrinks and the loop runs forever.',
    'Mixing closed [lo, hi] and half-open [lo, hi) bounds, which skips the last candidate or reads past the end.',
    'Choosing an upper bound that is not itself feasible, so the search can return a value that fails the test.',
    'Running it when the test is not monotonic, such as a condition that holds, fails, then holds again.',
    'Finding the minimum of a rotated array by comparing the middle with the left end, which fails when the array is not rotated; compare with the right end.',
  ],
}
