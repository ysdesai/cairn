import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input is a binary tree, and each node\'s answer depends on the answers for its children.',
    'The statement asks about a whole subtree: height, balance, equality, a sum, a count.',
    'Output is grouped by depth or level, or asks for what is visible from one side.',
    'The tree is a search tree, so comparing against a node says which side to go.',
    'A path may bend at any node and does not have to start at the root.',
  ],
  idea: 'Trust the recursion: assume the function already answers correctly for both children, then combine those answers at the current node. When the answer is a path or pair that bends at a node, return one value to the parent and update a separate global best. When depth matters, process the tree one row at a time with a queue. In a search tree, each comparison discards an entire subtree.',
  template: `from collections import deque

def diameter(root):
    best = 0

    def height(node):
        nonlocal best
        if not node:
            return 0                       # empty tree
        left = height(node.left)
        right = height(node.right)
        best = max(best, left + right)     # path bending at this node
        return 1 + max(left, right)        # what the parent can extend

    height(root)
    return best

def level_order(root):
    levels, queue = [], deque([root] if root else [])
    while queue:
        levels.append([node.val for node in queue])
        for _ in range(len(queue)):        # exactly one row
            node = queue.popleft()
            for child in (node.left, node.right):
                if child:
                    queue.append(child)
    return levels`,
  templateNote: 'O(n) time; O(h) stack for DFS, O(w) queue for BFS. For DFS, change what is returned and what is recorded; for BFS, change what you keep per row.',
  mistakes: [
    'Returning the path that bends at a node to the parent, when only a single downward branch can extend further.',
    'Checking a search tree by comparing each node only with its direct children instead of with bounds from all ancestors.',
    'Forgetting the empty-tree base case, then crashing on a missing child.',
    'Looping while the queue is non-empty inside a row instead of fixing the row size first, which mixes rows together.',
    'Counting nodes where the statement asks for edges, or the other way around, for height and diameter.',
  ],
}
