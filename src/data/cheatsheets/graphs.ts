import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input is a grid, a list of prerequisites or an edge list: relationships between items rather than a sequence.',
    'You must count, group or mark regions: islands, components, enclosed areas.',
    'The answer is a number of steps or minutes, and many starting points spread at the same time.',
    'Items must be ordered by "A before B" rules, or you must detect that the rules contradict each other.',
    'You must decide whether a new edge closes a cycle, or whether two items are already linked.',
  ],
  idea: 'Treat the input as nodes and edges, then visit each node once while recording what you have seen. A depth-first walk answers what is reachable, a breadth-first walk in rings answers how few steps it takes, and counting unmet prerequisites answers in what order. The seen set is what turns an exponential search into one that touches every node and edge once.',
  template: `from collections import deque


def bfs_rings(graph, sources):
    dist = {s: 0 for s in sources}      # doubles as the seen set
    queue = deque(dist)
    while queue:
        node = queue.popleft()
        for nxt in graph.get(node, []):
            if nxt not in dist:
                dist[nxt] = dist[node] + 1   # mark on push, not on pop
                queue.append(nxt)
    return dist`,
  templateNote:
    'O(V + E) time and space. Seed the queue with every source for a multi-source search, pop from the end of a list for DFS, and on a grid generate the four neighbors instead of reading a list.',
  mistakes: [
    'Marking a node as seen when it is popped instead of when it is pushed, which queues it many times over.',
    'Starting one search from a single node and missing the other components of a disconnected graph.',
    'Calling it a cycle when an undirected walk sees its parent again, or when a directed walk reaches a node by a second path instead of one still on the current path.',
    'Skipping bounds checks on grid neighbors: a negative index in Python wraps around to the far side without an error.',
    'Recursing deeply on a large grid without raising the recursion limit or switching to an explicit stack.',
  ],
}
