import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input is a list of [start, end] pairs, meetings, bookings or ranges.',
    'The question is about overlap: merge, count, remove or find a free slot.',
    'The input is in no particular order, but once it is sorted the answer depends only on how each range relates to its neighbors.',
    'You need the maximum number of things happening at once, or the minimum resources to cover them.',
    'Queries ask which range contains a point, and they can be answered in any order.',
  ],
  idea: 'Sorting by start puts every range that can overlap next to the ones it overlaps, so a single sweep with one summary value, such as the end of the last merged range, replaces comparing all pairs. When the question is about concurrency, split each range into a start event and an end event and sort those instead. Choose the sort key by what you need to decide first: start to merge, end to keep the most ranges.',
  template: `def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    merged = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:       # touching ranges merge too
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def max_overlap(intervals):
    starts = sorted(s for s, _ in intervals)
    ends = sorted(e for _, e in intervals)
    rooms = best = j = 0
    for s in starts:
        while ends[j] <= s:         # a range that ended by s frees its slot
            j += 1
            rooms -= 1
        rooms += 1
        best = max(best, rooms)
    return best`,
  templateNote: 'O(n log n) time, O(n) space. Whether touching ranges overlap depends on the statement: use < in the merge test to keep them apart, or < in the sweep to make them clash.',
  mistakes: [
    'Forgetting to sort first, or sorting by end when the sweep needs start.',
    'Overwriting the merged end with the new end instead of taking the maximum, which breaks when one range contains another.',
    'Getting the boundary wrong: whether [1, 2] and [2, 3] overlap depends on the statement.',
    'Modifying the input list while iterating over it instead of building a result list.',
    'Comparing each range to the previous one after sorting rather than to the last merged range.',
  ],
}
