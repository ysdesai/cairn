import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The statement asks for the k largest, k smallest, k closest or kth best of something.',
    'Items arrive over time and you must answer after each one without re-sorting.',
    'Each step needs the current minimum or maximum, and the pool changes after you take it.',
    'You must merge several sorted sequences, or always advance the one with the smallest head.',
    'A median or other middle value is requested on data that keeps growing.',
  ],
  idea: 'A heap gives the smallest (or largest) item in O(1) and lets you add or remove one in O(log n). For top-k, keep a heap of size k with the opposite ordering: the root is the weakest of the keepers, so it is the first one a better candidate evicts. For a running median, split the data into a max-heap of the lower half and a min-heap of the upper half so both middle values sit at the roots.',
  template: `import heapq

def k_largest(nums, k):
    heap = []                           # min-heap of the k largest so far
    for x in nums:
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:
            heapq.heapreplace(heap, x)  # pop the smallest, push x
    return heap                         # heap[0] is the kth largest

class MedianFinder:
    def __init__(self):
        self.low = []                   # max-heap (negated): lower half
        self.high = []                  # min-heap: upper half

    def add(self, x):
        heapq.heappush(self.low, -x)
        heapq.heappush(self.high, -heapq.heappop(self.low))
        if len(self.high) > len(self.low):
            heapq.heappush(self.low, -heapq.heappop(self.high))

    def median(self):
        if len(self.low) > len(self.high):
            return -self.low[0]
        return (-self.low[0] + self.high[0]) / 2`,
  templateNote: 'Top-k is O(n log k) time and O(k) space; each median add is O(log n). For a max-heap, negate the keys; for pairs, push tuples such as (priority, item).',
  mistakes: [
    'Using a max-heap of size k for top-k largest, which keeps the wrong end at the root.',
    'Forgetting that Python\'s heapq is a min-heap, so a max-heap needs negated keys.',
    'Re-sorting the whole list on every step instead of keeping a heap, which makes each update O(n log n) instead of O(log n).',
    'Letting the two median heaps drift apart in size, so the middle value is no longer at a root.',
    'Pushing objects that cannot be compared on ties instead of adding a tiebreaker such as an index.',
  ],
}
