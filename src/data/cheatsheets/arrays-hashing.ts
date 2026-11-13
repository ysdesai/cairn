import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The question is "have I seen this before?", or "does its complement exist?".',
    'You need counts or frequencies, or must compare two collections regardless of order.',
    'Items must be grouped by some shared property, such as a canonical form.',
    'The input is unsorted and a bound below O(n log n) rules out sorting.',
    'Each answer combines everything to the left of an index with everything to its right.',
  ],
  idea: 'A hash map or set trades memory for constant-time lookups, so a nested search for a matching partner collapses into one pass that remembers what it has seen. The work is choosing the right key: the value itself, its complement, a count, or a canonical form shared by equivalent items. When each answer depends on a whole side of the array, running aggregates from the left and from the right give both halves without a lookup.',
  template: `def two_sum(nums, target):
    seen = {}                          # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:         # look up before storing, so no item pairs with itself
            return [seen[target - x], i]
        seen[x] = i
    return []

def group_by_key(items, key):
    groups = {}
    for item in items:
        groups.setdefault(key(item), []).append(item)   # key must be hashable
    return list(groups.values())

def product_except_self(nums):
    out = [1] * len(nums)
    run = 1
    for i in range(len(nums)):         # out[i] = product of everything left of i
        out[i] = run
        run *= nums[i]
    run = 1
    for i in range(len(nums) - 1, -1, -1):   # fold in everything right of i
        out[i] *= run
        run *= nums[i]
    return out`,
  templateNote: 'O(n) time and O(n) space for the maps, O(1) extra for the prefix pass. Adapt the key: the value, target minus value, a count tuple, or sorted letters.',
  mistakes: [
    'Storing the current element before checking for its complement, so it pairs with itself.',
    'Using a list as a map key, which is unhashable; convert it to a tuple or a string first.',
    'Sorting to find duplicates when the original indices or order are needed.',
    'Incrementing counts[x] on a plain dict, which raises KeyError the first time; use Counter or counts.get(x, 0).',
    'Counting every element as a run start, which turns a linear scan into a quadratic one.',
  ],
}
