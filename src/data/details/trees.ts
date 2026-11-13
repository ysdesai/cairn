import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'invert-binary-tree': {
    tags: ['recursion', 'swap children', 'base case'],
    pattern: 'tree-dfs',
    summary:
      'Given the root of a binary tree, produce its mirror image, where every node has its left and right children exchanged, and return the root of the mirrored tree.',
    clue: 'The same operation applies at every node: mirror each child subtree, swap the two, and each subproblem has exactly the same shape as the whole tree.',
    decoys: ['linked-list', 'two-pointers', 'hashing'],
  },
  'maximum-depth-of-binary-tree': {
    tags: ['recursion', 'height', 'base case'],
    pattern: 'tree-dfs',
    summary:
      'Given the root of a binary tree, return its maximum depth, which is how many nodes lie on the longest chain starting at the root and going downward. An empty tree has depth 0.',
    clue: 'A tree\'s depth is one more than the deeper of its two subtrees\' depths, so the answer is built from the children\'s answers on the way back up.',
    decoys: ['dp-linear', 'bst', 'hashing'],
    alt: ['tree-bfs'],
  },
  'diameter-of-binary-tree': {
    tags: ['height recursion', 'global maximum', 'post-order'],
    pattern: 'tree-dfs',
    summary:
      'Given the root of a binary tree, return how many edges lie on the longest path connecting any two of its nodes. That path is not required to go through the root.',
    clue: 'The best path bends at some node, and its length is the left height plus the right height there. One pass that returns heights upward and records the best bend at each node finds it.',
    decoys: ['tree-bfs', 'bfs-shortest', 'dp-linear'],
  },
  'balanced-binary-tree': {
    tags: ['height recursion', 'early exit', 'post-order'],
    pattern: 'tree-dfs',
    summary:
      'Given a binary tree, return whether it is balanced, meaning that at every node the height of the left subtree and the height of the right subtree differ by no more than one.',
    clue: 'Balance is a property checked at every node using the heights of its two subtrees. Returning the height (or a failure marker) upward checks every node in a single pass.',
    decoys: ['tree-bfs', 'bst', 'dp-linear'],
  },
  'same-tree': {
    tags: ['parallel recursion', 'structure match', 'base cases'],
    pattern: 'tree-dfs',
    summary:
      'Given the roots of two binary trees, return whether they are identical: the same shape, and the same value at every corresponding node.',
    clue: 'Two trees match when their roots match and their left and right subtrees match pairwise. That self-similar definition maps directly onto recursing into both trees at once.',
    decoys: ['two-pointers', 'hashing', 'heap'],
  },
  'subtree-of-another-tree': {
    tags: ['nested recursion', 'tree equality', 'node-by-node check'],
    pattern: 'tree-dfs',
    summary:
      'Given the roots of two binary trees, root and subRoot, return whether subRoot appears inside root: some node of root, together with all of its descendants, matches subRoot in both shape and values.',
    clue: 'Try each node of the big tree as a candidate root, and test it with the same-tree comparison. Both the search and the test are recursions over tree structure.',
    decoys: ['two-pointers', 'sliding-window', 'graph-traversal'],
  },
  'lowest-common-ancestor-of-a-binary-search-tree': {
    tags: ['bst property', 'split point', 'iterative walk'],
    pattern: 'bst',
    summary:
      'Given a tree in which every node\'s left descendants are smaller and its right descendants larger, and two of its nodes p and q, return their lowest common ancestor: the deepest node that has both below it, where a node counts as lying below itself.',
    clue: 'Values are ordered, so comparing p and q with the current node says which side they lie on. The first node where they fall on different sides is the answer, with no need to explore both subtrees.',
    decoys: ['binary-search', 'tree-bfs', 'hashing'],
  },
  'binary-tree-level-order-traversal': {
    tags: ['queue', 'level by level', 'row snapshot'],
    pattern: 'tree-bfs',
    summary:
      'Given the root of a binary tree, return its node values as a list of lists, from the top down, where each inner list holds the nodes at the same distance from the root, read from left to right.',
    clue: 'The output is organized by depth, so you need every node of one row before any node of the next. A queue processed one row at a time delivers exactly that grouping.',
    decoys: ['stack', 'bfs-shortest', 'heap'],
  },
  'binary-tree-right-side-view': {
    tags: ['level order', 'last node per level', 'queue'],
    pattern: 'tree-bfs',
    summary:
      'Given the root of a binary tree, imagine standing on its right side and return the values of the nodes you can see, ordered from top to bottom.',
    clue: 'You see exactly one node per depth, the rightmost of its row. Sweeping the tree row by row and keeping the last node of each row gives the view directly.',
    decoys: ['monotonic-stack', 'stack', 'heap'],
    alt: ['tree-dfs'],
  },
  'count-good-nodes-in-binary-tree': {
    tags: ['path maximum', 'top-down state', 'pre-order'],
    pattern: 'tree-dfs',
    summary:
      'Given the root of a binary tree, count the nodes whose value is at least as large as every value on the path from the root down to that node. The root always counts.',
    clue: 'Whether a node is good depends only on the largest value above it. Passing that running maximum down into each child while recursing makes every check constant time.',
    decoys: ['monotonic-stack', 'prefix-suffix', 'bst'],
  },
  'validate-binary-search-tree': {
    tags: ['bst property', 'in-order traversal', 'value bounds'],
    pattern: 'bst',
    summary:
      'Given the root of a binary tree, decide whether it is ordered so that at every node all values on its left are smaller and all values on its right are larger, with no duplicates.',
    clue: 'The ordering rule covers a node\'s entire subtree, not just its children. Checking that an in-order walk is strictly increasing, or that each value stays inside inherited bounds, enforces it.',
    decoys: ['tree-bfs', 'binary-search', 'hashing'],
    alt: ['tree-dfs'],
  },
  'kth-smallest-element-in-a-bst': {
    tags: ['in-order traversal', 'early stop', 'sorted order'],
    pattern: 'bst',
    summary:
      'Given the root of a binary tree in which every node\'s left descendants are smaller and its right descendants larger, and an integer k, return the k-th smallest value among all nodes, counting from 1.',
    clue: 'Visiting a search tree left, node, right yields its values in ascending order. Stop at the k-th visit and the answer is found without sorting anything.',
    decoys: ['heap', 'binary-search', 'tree-bfs'],
  },
  'construct-binary-tree-from-preorder-and-inorder-traversal': {
    tags: ['divide and conquer', 'index map', 'pre-order root'],
    pattern: 'tree-dfs',
    summary:
      'Given the preorder and inorder traversal arrays of a binary tree with unique values, rebuild the tree and return its root.',
    clue: 'The first preorder value is the root, and its position in the inorder array splits the remaining values into left and right subtrees. Each half is the same problem on a smaller range.',
    decoys: ['bst', 'tree-bfs', 'hashing'],
  },
  'binary-tree-maximum-path-sum': {
    tags: ['gain recursion', 'global maximum', 'discard negatives'],
    pattern: 'tree-dfs',
    summary:
      'Given the root of a binary tree whose values may be negative, return the largest sum of any non-empty path. A path follows parent-child links, visits each node at most once, and need not touch the root.',
    clue: 'The best path bends at some node, but only a single downward branch can continue to the parent. Return the best one-sided gain upward, and update the global best with both sides at each node.',
    decoys: ['dp-linear', 'greedy', 'tree-bfs'],
  },
  'serialize-and-deserialize-binary-tree': {
    tags: ['pre-order', 'null markers', 'string encoding'],
    pattern: 'tree-dfs',
    summary:
      'Design an algorithm that turns a binary tree into a string and rebuilds the same tree from that string. Any format works, as long as decoding an encoded tree gives back the original.',
    clue: 'A traversal that also records where children are missing identifies the shape uniquely. Reading the same order back, one token at a time, rebuilds each subtree recursively.',
    decoys: ['hashing', 'bst', 'heap'],
    alt: ['tree-bfs', 'design'],
  },
}
