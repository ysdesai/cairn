import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'reconstruct-itinerary': {
    tags: ['eulerian path', 'lexical order', 'dfs with undo'],
    pattern: 'backtracking',
    summary:
      'Given airline tickets as [from, to] pairs, build an itinerary that starts at JFK and uses every ticket exactly once. A valid itinerary is guaranteed to exist; if several do, return the smallest one in lexical order.',
    clue: 'Every ticket must be used exactly once and ties go to the smaller airport name, but taking the smallest next airport can dead-end with tickets left over. So try destinations in sorted order and undo a choice that strands tickets.',
    decoys: ['greedy', 'topological-sort', 'bfs-shortest'],
    alt: ['graph-traversal'],
  },
  'min-cost-to-connect-all-points': {
    tags: ['minimum spanning tree', 'prim algorithm', 'min heap'],
    pattern: 'weighted-paths',
    summary:
      'Given points on a plane, join them with segments so that every point can reach every other, where each segment costs the Manhattan distance between its endpoints. Return the smallest possible total cost.',
    clue: 'Connecting every point at the lowest total cost, with no start or destination, asks for a minimum spanning tree. Prim\'s algorithm grows it from one point, always adding the cheapest edge to a point not yet inside.',
    decoys: ['graph-traversal', 'bfs-shortest', 'math'],
    alt: ['union-find'],
  },
  'network-delay-time': {
    tags: ['dijkstra', 'min heap', 'single source'],
    pattern: 'weighted-paths',
    summary:
      'A network has n nodes labeled 1 to n and directed edges given as (from, to, travel time). A signal starts at node k; return how long until every node has received it, or -1 if some node never does.',
    clue: 'Edges have different travel times and you need the earliest arrival at every node, then the largest of those. Dijkstra\'s algorithm, always expanding the cheapest known node next, settles each node once.',
    decoys: ['bfs-shortest', 'graph-traversal', 'topological-sort'],
  },
  'swim-in-rising-water': {
    tags: ['dijkstra', 'minimax path', 'min heap'],
    pattern: 'weighted-paths',
    summary:
      'In an n by n grid of distinct elevations, the water level equals the elapsed time, and you can step between neighbors only when both cells are at or below it. Return the least time to reach the bottom-right cell from the top-left.',
    clue: 'A route costs its highest cell, not the sum of its cells, but the greedy idea is unchanged: always extend from the reachable cell that needs the lowest water level, carrying the running maximum.',
    decoys: ['bfs-shortest', 'dp-grid', 'backtracking'],
    alt: ['search-on-answer', 'union-find'],
  },
  'alien-dictionary': {
    tags: ['topological sort', 'adjacent word pairs', 'cycle detection'],
    pattern: 'topological-sort',
    summary:
      'Given a list of words sorted according to the rules of an unknown alphabet, return a string of the letters in a valid order for that alphabet, or an empty string if the words contradict each other.',
    clue: 'Comparing neighboring words gives facts of the form letter A comes before letter B. Those are directed edges, and a valid alphabet is an order respecting all of them, which cannot exist if they form a cycle.',
    decoys: ['trie', 'hashing', 'backtracking'],
  },
  'cheapest-flights-within-k-stops': {
    tags: ['bellman-ford', 'edge relaxation', 'bounded hops'],
    pattern: 'weighted-paths',
    summary:
      'Given n cities and directed flights as (from, to, price), return the cheapest price to get from src to dst using at most k stops in between, or -1 if no such route exists.',
    clue: 'The stop limit breaks the cheapest-first shortcut of Dijkstra, because a cheaper route with too many stops can hide a pricier valid one. Bellman-Ford fits: relax every flight once per allowed leg (k + 1 rounds), reading prices from the previous round.',
    decoys: ['backtracking', 'greedy', 'graph-traversal'],
  },
}
