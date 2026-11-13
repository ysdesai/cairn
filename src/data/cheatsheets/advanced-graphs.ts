import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'Edges carry weights such as time, price or distance, and the question asks for a minimum or an earliest arrival.',
    'Plain BFS would be wrong because the fewest edges is not the cheapest route.',
    'Every point must be connected at the lowest total cost, with no particular destination.',
    'A path is scored by its worst edge or cell rather than by the sum.',
    'Facts about neighbors in a list, such as adjacent words or tickets, become edges once written down, even when no graph is given.',
    'All weights are non-negative, so a node whose cost is settled can never be improved later.',
  ],
  idea: 'Always expand the cheapest unfinished node next, using a min-heap. Because no edge is negative, the first time a node is popped its cost is final, so each node is settled once and later stale heap entries are skipped. Change what the heap key means and the same loop gives Prim\'s spanning tree (the key is the edge weight) or a minimax path (the key is the largest value seen so far).',
  template: `import heapq


def dijkstra(graph, src):
    # graph[u] = [(v, weight), ...] with non-negative weights
    best = {src: 0}
    heap = [(0, src)]
    while heap:
        cost, node = heapq.heappop(heap)
        if cost > best[node]:
            continue                     # stale entry, a cheaper one was used
        for nxt, w in graph.get(node, []):
            new = cost + w
            if new < best.get(nxt, float('inf')):
                best[nxt] = new
                heapq.heappush(heap, (new, nxt))
    return best`,
  templateNote:
    'O(E log V) time. For Prim, push the edge weight instead of the running total; for a path scored by its maximum, push max(cost, w). Negative weights or a hop limit call for Bellman-Ford instead.',
  mistakes: [
    'Using plain BFS on weighted edges and treating the fewest edges as the cheapest route.',
    'Not skipping stale heap entries, which rescans a node\'s edges once per duplicate entry.',
    'Applying Dijkstra to negative weights, or to a hop-limited route where the cheapest path to a node is not always the right one to keep.',
    'Returning the largest distance without checking that every node was reached, when unreachable nodes mean -1.',
    'Adding edges in one direction only when the statement says undirected, or in both directions when it says directed.',
  ],
}
