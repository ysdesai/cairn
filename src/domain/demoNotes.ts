/**
 * Notes for the demo history: what a careful learner writes for their future self after solving.
 * Keyed by slug, covering the first 75 problems in roadmap order. The first sentence of each
 * insight is a self-contained restatement of the idea, because the demo reuses it as the
 * "recall from memory" text on revisions.
 */
export interface DemoNote {
  insight: string
  time: string
  space: string
  pitfalls: string
}

export const DEMO_NOTES: Record<string, DemoNote> = {
  // --- Arrays & Hashing ---------------------------------------------------------------------
  'contains-duplicate': {
    insight:
      'Add each number to a set as you scan, and if it is already there the array has a duplicate. Sorting and comparing neighbors also works but costs more.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Compared len(set(nums)) with len(nums) at first, which builds the whole set; the early exit is the point. Forgot that an empty or one-element array can never have a duplicate.',
  },
  'valid-anagram': {
    insight:
      'Two strings are anagrams when every character has the same count in both. Count up for one string, count down for the other, and check that nothing is left over.',
    time: 'O(n)',
    space: 'O(1) for 26 lowercase letters',
    pitfalls:
      'Skipped the length check, so "ab" against "abc" went through the whole loop. Used a set instead of counts and lost repeated letters.',
  },
  'two-sum': {
    insight:
      'For each number, look up target minus that number in a map of values seen so far. Store the current number and its index only after the lookup.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Stored the number before the lookup, so 3 + 3 = 6 matched the element with itself. Returned the values instead of the indices.',
  },
  'group-anagrams': {
    insight:
      'Anagrams share a canonical key, so use the sorted letters or a 26-count tuple as the dict key and append each word to its bucket.',
    time: 'O(n * k) with count keys, O(n * k log k) with sorted keys (k is the longest word)',
    space: 'O(n * k)',
    pitfalls:
      'Tried to use a list as a dict key and got an unhashable type error; convert the count array to a tuple. Forgot that the empty string is a valid word with its own bucket.',
  },
  'top-k-frequent-elements': {
    insight:
      'Count the frequencies, then bucket the numbers by count so index i holds everything seen i times. Read the buckets from the top down until k numbers are collected.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Made the bucket list length n instead of n + 1, which breaks when one number fills the whole array. Read the buckets from low to high and returned the least frequent numbers.',
  },
  'product-of-array-except-self': {
    insight:
      'The answer at i is the product of everything to its left times everything to its right. Fill in the left products first, then sweep back with a running right product.',
    time: 'O(n)',
    space: 'O(1) extra, not counting the output array',
    pitfalls:
      'Divided the total product by each element and fell over on zeros in the input. Started the running product at 0 instead of 1.',
  },
  'valid-sudoku': {
    insight:
      'Track the digits already seen in each row, each column and each 3x3 box with sets. The box is identified by the pair (r // 3, c // 3).',
    time: 'O(81), which is constant for a fixed board',
    space: 'O(81), constant',
    pitfalls:
      'Used r // 3 + c // 3 as the box key, which gives the same key to different boxes; it has to be the pair. Forgot to skip the "." cells.',
  },
  'encode-and-decode-strings': {
    insight:
      'Prefix every string with its length and a delimiter, like 4#word, so decoding never has to guess. The decoder reads exactly that many characters after the delimiter, so any character can appear inside a string.',
    time: 'O(n) over all characters',
    space: 'O(n)',
    pitfalls:
      'First tried a comma as the separator and it broke on strings that contain commas. When decoding, read the whole length before the "#", because it can have more than one digit.',
  },
  'longest-consecutive-sequence': {
    insight:
      'Put everything in a set and only start counting from numbers with no predecessor, meaning n - 1 is not in the set. Then walk upward from each start while the next number is present.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Started a walk from every number, which quietly made it O(n^2). Looped over the list instead of the set, so duplicates repeated the same walk.',
  },

  // --- Two Pointers -------------------------------------------------------------------------
  'valid-palindrome': {
    insight:
      'Move two pointers inward, skip anything that is not a letter or digit, and compare the lowercase characters.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'The skip loops need their own left < right check, or a string of only punctuation runs off the end. Used isalpha instead of isalnum and dropped the digits.',
  },
  'two-sum-ii-input-array-is-sorted': {
    insight:
      'The array is sorted, so use two pointers and move the one that fixes the sum. If the sum is too small move the left pointer up, if it is too large move the right pointer down.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Returned 0-based indices when the problem wants 1-based. Moved both pointers on every step instead of only the one that fixes the sum.',
  },
  '3sum': {
    insight:
      'Sort, fix the first number, then solve Two Sum II on the rest with two pointers. Skip duplicates for the first number and for the pair after each hit.',
    time: 'O(n^2)',
    space: 'O(1) extra, ignoring the sort and the output',
    pitfalls:
      'Skipped duplicate left values before recording a hit, which dropped [0, 0, 0]; skip after recording. Forgot to skip repeated first values, so the same triplet came out several times.',
  },
  'container-with-most-water': {
    insight:
      'Start with the widest container and always move the pointer at the shorter wall inward. Moving the taller wall can only shrink the area, so it is never worth trying.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Moved the pointer at the taller wall by mistake. Used right - left + 1 for the width when it is right - left.',
  },
  'trapping-rain-water': {
    insight:
      'Water above a bar is the smaller of the tallest bar to its left and to its right, minus its own height. Two pointers with running maxima do it in one pass.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Processed the side with the larger running max, but the water level there depends on the other side\'s max, which can still grow. Added water before updating the running max and got negative amounts.',
  },

  // --- Sliding Window -----------------------------------------------------------------------
  'best-time-to-buy-and-sell-stock': {
    insight:
      'Track the lowest price seen so far, and at each day compare the profit from selling at that price with the best profit so far.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Started the best profit at negative infinity and returned a negative number for [7, 6, 4, 3, 1]; it should start at 0.',
  },
  'longest-substring-without-repeating-characters': {
    insight:
      'Grow the window to the right, and when the new character is already inside, move the left edge just past its previous position.',
    time: 'O(n)',
    space: 'O(min(n, alphabet size))',
    pitfalls:
      'Moved left backwards when the repeated character was from before the window; it has to be max(left, last[c] + 1). Computed the length as right - left and came up one short.',
  },
  'longest-repeating-character-replacement': {
    insight:
      'A window is valid when its length minus its most frequent letter count is at most k. Expand on the right, and shrink on the left when the window is not valid.',
    time: 'O(n)',
    space: 'O(1) for 26 letters',
    pitfalls:
      'Forgot to decrement the count of the left letter when shrinking. Computed the window length as right - left, one too small.',
  },
  'permutation-in-string': {
    insight:
      'A permutation of s1 is any window of s2 with the same length and the same letter counts. Slide a fixed-size window and compare the counts.',
    time: 'O(n) with a constant 26 factor',
    space: 'O(1)',
    pitfalls:
      'Did not return early when s1 is longer than s2 and indexed past the end. Forgot to remove the letter leaving the window before comparing.',
  },
  'minimum-window-substring': {
    insight:
      'Expand right until the window covers every needed character, then shrink left as far as it stays valid. Record the smallest window seen along the way.',
    time: 'O(n + m)',
    space: 'O(m) for the needed counts',
    pitfalls:
      'Counted a letter as satisfied when its window count was >= the need instead of ==, so repeated letters in t inflated the counter. Forgot to return an empty string when no window exists.',
  },
  'sliding-window-maximum': {
    insight:
      'Keep a deque of indices whose values are decreasing, so the front is always the window maximum. Pop smaller values off the back as new ones arrive, and pop expired indices off the front.',
    time: 'O(n)',
    space: 'O(k) for the deque, not counting the output',
    pitfalls:
      'Stored values instead of indices, so I could not tell when the front had left the window. Started recording results at i = 0 instead of i = k - 1.',
  },

  // --- Stack --------------------------------------------------------------------------------
  'valid-parentheses': {
    insight:
      'Push every opening bracket, and when a closing bracket arrives the top of the stack must be its matching opener.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Popped from an empty stack on input like ")". Returned true without checking that the stack was empty at the end, so "((" passed.',
  },
  'min-stack': {
    insight:
      'Store each value together with the minimum so far, so getMin just reads the top and every operation stays constant time.',
    time: 'O(1) per operation',
    space: 'O(n)',
    pitfalls:
      'With a separate min stack I only pushed on strictly smaller values and lost the minimum when duplicates were popped; push on <= or store pairs.',
  },
  'evaluate-reverse-polish-notation': {
    insight:
      'Push numbers on a stack, and for an operator pop two values, apply it, and push the result back.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Mixed up the operand order: the first pop is the right operand, which matters for subtraction and division. Division must truncate toward zero, so int(a / b) and not a // b.',
  },
  'generate-parentheses': {
    insight:
      'Build the string one character at a time, adding "(" while fewer than n are open. Add ")" only while there are more opens than closes.',
    time: 'O(4^n / sqrt(n)), the Catalan number of results',
    space: 'O(n) recursion depth',
    pitfalls:
      'Allowed ")" whenever the close count was below n and produced strings like "())(". The condition is closes < opens.',
  },
  'daily-temperatures': {
    insight:
      "Keep a stack of indices with decreasing temperatures, and when a warmer day arrives pop every colder day. Each popped day's answer is the difference between the indices.",
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Stored temperatures instead of indices and could not compute the wait. Left days that never get a warmer one unset instead of 0.',
  },
  'car-fleet': {
    insight:
      'Sort the cars by position and walk from the one closest to the target, computing each arrival time. A car that takes longer than the fleet ahead starts a new fleet, otherwise it catches up and joins it.',
    time: 'O(n log n)',
    space: 'O(n)',
    pitfalls:
      'Walked the sorted cars from the back of the road instead of from the target. Compared speeds instead of arrival times, which are (target - position) / speed.',
  },
  'largest-rectangle-in-histogram': {
    insight:
      'Keep a stack of bars with increasing heights, and when a shorter bar arrives pop the taller ones. Each popped bar gives the widest rectangle it could form, reaching back to the start of the last popped bar.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Forgot to flush the stack at the end; a sentinel height of 0 fixes it. Used the popped bar\'s own index as its left edge instead of the start index of the last popped bar.',
  },

  // --- Binary Search ------------------------------------------------------------------------
  'binary-search': {
    insight:
      'Compare the middle element with the target and throw away the half that cannot contain it.',
    time: 'O(log n)',
    space: 'O(1)',
    pitfalls:
      'Used while left < right and missed single-element arrays; it needs <=. Set left = mid instead of mid + 1 and looped forever on two elements.',
  },
  'search-a-2d-matrix': {
    insight:
      'Treat the matrix as one sorted array of rows * cols items, where index i is row i // cols and column i % cols.',
    time: 'O(log(m * n))',
    space: 'O(1)',
    pitfalls:
      'Divided by the number of rows instead of the number of columns when converting the index. Forgot the empty matrix.',
  },
  'koko-eating-bananas': {
    insight:
      'Binary search on the eating speed: find the smallest k for which the hours needed, the sum of ceil(pile / k), is at most h.',
    time: 'O(n log m), where m is the largest pile',
    space: 'O(1)',
    pitfalls:
      'Used floor division for the hours and under-counted; it must round up. Started the search at 0, which divides by zero, instead of 1.',
  },
  'find-minimum-in-rotated-sorted-array': {
    insight:
      'Compare the middle with the right end, since nums[mid] > nums[right] means the minimum is to the right of mid. Otherwise the minimum is at mid or to its left.',
    time: 'O(log n)',
    space: 'O(1)',
    pitfalls:
      'Compared with the left end, which breaks when the array was not rotated at all. Used right = mid - 1 and skipped over the answer; it has to be right = mid.',
  },
  'search-in-rotated-sorted-array': {
    insight:
      'One half around mid is always sorted, so check whether the target lies inside that sorted half and discard the other half.',
    time: 'O(log n)',
    space: 'O(1)',
    pitfalls:
      'Used < instead of <= when testing the target against nums[left], missing the case where they are equal. Misjudged which half was sorted when mid equals left.',
  },
  'time-based-key-value-store': {
    insight:
      'Keep a list of (timestamp, value) per key, and since timestamps only increase, get is a binary search. Find the latest timestamp that is <= the query.',
    time: 'set O(1), get O(log n)',
    space: 'O(n)',
    pitfalls:
      'Returned the entry at the insertion point, which is the first later timestamp; I wanted the one before it. Forgot to return "" when the key is missing or every timestamp is later.',
  },
  'median-of-two-sorted-arrays': {
    insight:
      'Binary search where to cut the shorter array so the left halves of both arrays sit below the right halves. Then read the median off the four values around the cuts.',
    time: 'O(log(min(m, n)))',
    space: 'O(1)',
    pitfalls:
      'Searched the longer array and indexed out of range. Forgot the infinity sentinels when a partition sits at an array edge, and mixed up odd and even total lengths.',
  },

  // --- Linked List --------------------------------------------------------------------------
  'reverse-linked-list': {
    insight:
      'Walk the list with prev and cur: save cur.next, point cur at prev, then advance both.',
    time: 'O(n)',
    space: 'O(1) iterative, O(n) recursive',
    pitfalls:
      'Overwrote cur.next before saving it and lost the rest of the list. Returned cur, which is None at the end, instead of prev.',
  },
  'merge-two-sorted-lists': {
    insight:
      'Use a dummy head and a tail pointer, repeatedly attach the smaller front node, and attach whichever list is left over at the end.',
    time: 'O(n + m)',
    space: 'O(1)',
    pitfalls:
      'Forgot to attach the leftover list after one ran out. Returned dummy instead of dummy.next.',
  },
  'reorder-list': {
    insight:
      'Find the middle with slow and fast pointers, reverse the second half, then interleave the two halves.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Did not cut the first half with slow.next = None, which made a cycle. Stopped the interleave on the wrong list for odd lengths.',
  },
  'remove-nth-node-from-end-of-list': {
    insight:
      'Start a dummy head and move a fast pointer n steps ahead of a slow one. Advance both until fast reaches the end, so slow sits just before the node to delete.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Without a dummy head, removing the first node failed. Moved fast one step too many and deleted the wrong node.',
  },
  'copy-list-with-random-pointer': {
    insight:
      'Map every original node to its copy on a first pass, then wire next and random on a second pass by looking nodes up in the map.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Forgot that random can be None, so the map needs None mapped to None. Created a second copy of the same node instead of reusing the map.',
  },
  'add-two-numbers': {
    insight:
      'Add digit by digit with a carry, building a new node for each digit, and keep going while either list or a carry remains.',
    time: 'O(max(n, m))',
    space: 'O(max(n, m)) for the result',
    pitfalls:
      'Dropped the final carry, so 5 + 5 lost its leading 1. Stopped as soon as one list ended instead of continuing with the other.',
  },
  'linked-list-cycle': {
    insight:
      'A slow pointer moves one step and a fast pointer moves two, and if they ever meet there is a cycle.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Checked slow == fast before the first move, so every list looked cyclic. Read fast.next.next without checking fast.next first and crashed on odd lengths.',
  },
  'find-the-duplicate-number': {
    insight:
      "Treat the array as a linked list where index i points to nums[i], so the duplicate is where the cycle begins. Find it with Floyd's two phases.",
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Returned the first meeting point, which is somewhere inside the cycle; the second phase from the start is needed. Started both pointers at the same index and looped while they differed, which exits at once; step first, then compare.',
  },
  'lru-cache': {
    insight:
      'A hash map from key to node plus a doubly linked list ordered by recency gives constant time get and put. Move a node to the front on use and evict from the back.',
    time: 'O(1) per operation',
    space: 'O(capacity)',
    pitfalls:
      'Moved the node to the front on put but not on get. Removed the node from the list but forgot to delete the key from the dict. Updating an existing key must not trigger an eviction.',
  },
  'merge-k-sorted-lists': {
    insight:
      'Repeatedly take the smallest head among the k lists with a min-heap, or merge the lists pairwise in a divide and conquer.',
    time: 'O(N log k) for N nodes in total',
    space: 'O(k) for the heap',
    pitfalls:
      'Pushed (value, node) pairs and Python tried to compare nodes when values tied; add an index as a tiebreaker. Pushed None heads for empty lists.',
  },
  'reverse-nodes-in-k-group': {
    insight:
      'Find the k-th node of each group first so a short tail is left alone, then reverse that group in place. Reconnect it to the previous group and to the next one.',
    time: 'O(n)',
    space: 'O(1)',
    pitfalls:
      'Reversed the last group even when it had fewer than k nodes. Lost the link between groups because I did not keep the previous group\'s tail.',
  },

  // --- Trees --------------------------------------------------------------------------------
  'invert-binary-tree': {
    insight:
      'Swap the left and right children at every node, recursively.',
    time: 'O(n)',
    space: 'O(h) recursion, where h is the height',
    pitfalls:
      'Wrote node.left = node.right and then node.right = node.left, which loses the original left; swap with a tuple assignment. Forgot the empty-tree base case.',
  },
  'maximum-depth-of-binary-tree': {
    insight:
      'The depth is 1 plus the larger depth of the two children, and an empty tree has depth 0.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Returned 1 for an empty tree. Counted edges instead of nodes in one version.',
  },
  'diameter-of-binary-tree': {
    insight:
      'The longest path through a node is its left height plus its right height, so track the best while the DFS returns heights.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Returned the diameter from the recursion instead of the height, so parents received the wrong value. Counted nodes instead of edges and was one too high.',
  },
  'balanced-binary-tree': {
    insight:
      'Compute heights bottom-up and return a sentinel such as -1 as soon as a subtree is unbalanced. That way every node is visited once.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Recomputed the height at every node, which is O(n^2) on a skewed tree. Compared only the root\'s two subtrees instead of every node.',
  },
  'same-tree': {
    insight:
      'Two trees are the same when the roots match and both pairs of children are the same. Two empty trees match, and one empty tree does not.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Compared only the values and let a None against a real node slip through. Forgot the case where exactly one node is None.',
  },
  'subtree-of-another-tree': {
    insight:
      'For each node of the main tree, check whether the tree rooted there is identical to subRoot using the Same Tree check.',
    time: 'O(m * n) in the worst case',
    space: 'O(h)',
    pitfalls:
      'Returned True when the main tree ran out, but an empty tree cannot contain a non-empty subtree. Treated an empty subRoot as False, when it is always a subtree.',
  },
  'lowest-common-ancestor-of-a-binary-search-tree': {
    insight:
      'Walk down from the root: if both values are smaller go left, if both are larger go right. Otherwise this node is the split point and the answer.',
    time: 'O(h)',
    space: 'O(1) iterative',
    pitfalls:
      'Used the general tree LCA and ignored the BST ordering. Compared nodes instead of node values. A node can be its own ancestor, so equality counts as the split.',
  },
  'binary-tree-level-order-traversal': {
    insight:
      'Run a BFS with a queue and process exactly len(queue) nodes at the start of each round to collect one level.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Used len(queue) in the loop condition while the queue was growing, which mixed levels; freeze the size first. Appended None children to the queue.',
  },
  'binary-tree-right-side-view': {
    insight:
      'Do a level-order traversal and keep the last node of each level. A DFS that visits the right child first and records the first node at each depth also works.',
    time: 'O(n)',
    space: 'O(n) for BFS, O(h) for a right-first DFS',
    pitfalls:
      'Followed only right children, which misses levels where the left subtree is deeper. Took the first node of each level instead of the last.',
  },
  'count-good-nodes-in-binary-tree': {
    insight:
      'Run a DFS that carries the maximum value on the path from the root, and a node is good when its value is at least that maximum.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Used > instead of >= and skipped nodes equal to the path maximum. Passed the node value to the children instead of the updated maximum.',
  },
  'validate-binary-search-tree': {
    insight:
      'Pass an allowed range (low, high) down to each node, so left children stay below it and right children stay above it. The bounds tighten as you go.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Compared each node only with its direct children, which accepts a violation deeper down. Made the bounds inclusive, but duplicates are not allowed, so equal values must fail.',
  },
  'kth-smallest-element-in-a-bst': {
    insight:
      'An in-order traversal visits a BST in sorted order, so stop at the k-th node visited.',
    time: 'O(h + k)',
    space: 'O(h)',
    pitfalls:
      'Counted from 0 instead of 1. Collected the whole traversal into a list when an early exit is enough.',
  },
  'construct-binary-tree-from-preorder-and-inorder-traversal': {
    insight:
      'The first preorder value is the root, and its position in the inorder list splits the two subtrees. The size of the left part also says how many preorder values belong to each side.',
    time: 'O(n) with a value-to-index map',
    space: 'O(n)',
    pitfalls:
      'Searched the inorder list for the root every time, which is O(n^2); build a hash map once. Started the right subtree\'s preorder slice at the wrong index; it begins at 1 + left size.',
  },
  'binary-tree-maximum-path-sum': {
    insight:
      'At each node the best downward path is its value plus the larger child gain, never below 0. The best path through the node adds both gains.',
    time: 'O(n)',
    space: 'O(h)',
    pitfalls:
      'Started the best at 0, which is wrong when every node is negative; use negative infinity. Returned the two-sided sum to the parent, which would make a path that forks.',
  },
  'serialize-and-deserialize-binary-tree': {
    insight:
      'A preorder traversal with explicit null markers rebuilds the tree uniquely. Deserialize by consuming the tokens in the same order.',
    time: 'O(n)',
    space: 'O(n)',
    pitfalls:
      'Left out the null markers, so the shape was ambiguous. Passed an index by value through the recursion instead of sharing an iterator.',
  },

  // --- Tries --------------------------------------------------------------------------------
  'implement-trie-prefix-tree': {
    insight:
      'Each node holds a dict of children and an end-of-word flag. Insert, search and startsWith all walk the word one character at a time.',
    time: 'O(L) per operation, where L is the word length',
    space: 'O(total characters)',
    pitfalls:
      'Returned True from search for a word that was only a prefix; search needs the end flag and startsWith does not. Forgot to create the child node while inserting.',
  },
  'design-add-and-search-words-data-structure': {
    insight:
      'Use a trie where a "." in the query tries every child at that position. Recurse from each child with the rest of the pattern.',
    time: 'add O(L), search O(L) without dots and up to O(26^L) with many dots',
    space: 'O(total characters)',
    pitfalls:
      'Handled "." only at the first position. Returned True at the end of the pattern without checking the end-of-word flag.',
  },
  'word-search-ii': {
    insight:
      'Insert all the words in a trie, then DFS from every cell following trie edges, and prune a branch once its words have been found.',
    time: 'O(m * n * 4 * 3^(L - 1)), where L is the longest word',
    space: 'O(total word characters)',
    pitfalls:
      'Added the same word twice when two paths reached it; clear the marker once found. Forgot to unmark the visited cell when backtracking.',
  },

  // --- Heap ---------------------------------------------------------------------------------
  'kth-largest-element-in-a-stream': {
    insight:
      'Keep a min-heap of size k holding the k largest values seen, so the top of the heap is the k-th largest.',
    time: 'O(log k) per add',
    space: 'O(k)',
    pitfalls:
      'Used a max-heap and returned the wrong element. Forgot to pop when the heap grew past k, including while loading the initial numbers.',
  },
  'last-stone-weight': {
    insight:
      'Use a max-heap, repeatedly smash the two heaviest stones, and push back the difference if it is not zero.',
    time: 'O(n log n)',
    space: 'O(n)',
    pitfalls:
      'Python\'s heapq is a min-heap, so the stones have to be negated. Popped from an empty heap when one stone was left; loop while the size is above 1.',
  },
  'k-closest-points-to-origin': {
    insight:
      'Compare squared distances, since the square root is not needed, and keep a max-heap of size k. The farthest of the kept points is on top, ready to be replaced.',
    time: 'O(n log k)',
    space: 'O(k)',
    pitfalls:
      'Took the square root, which is unnecessary and risks float noise. Used a min-heap of size k and kept the farthest points.',
  },
  'kth-largest-element-in-an-array': {
    insight:
      'Keep a min-heap of the k largest elements, and the root after one pass is the answer; quickselect gets there in O(n) on average.',
    time: 'O(n log k) with a heap, O(n) average with quickselect',
    space: 'O(k)',
    pitfalls:
      'Sorted descending and indexed k instead of k - 1. Forgot to pick a random pivot in quickselect and hit the worst case on sorted input.',
  },
  'task-scheduler': {
    insight:
      'The most frequent task sets the length: (maxFreq - 1) blocks of n + 1 slots plus one slot per task tied for the max. The answer is never below the number of tasks.',
    time: 'O(n)',
    space: 'O(1) for 26 task types',
    pitfalls:
      'Forgot to take the max with len(tasks); with many distinct tasks there are no idle slots and the formula undercounts. Left out the tasks tied for the maximum frequency in the last block.',
  },
  'design-twitter': {
    insight:
      'Give every tweet a global timestamp, then build the feed by merging the latest tweets of the user and their followees. Use a heap and take the 10 newest.',
    time: 'postTweet O(1), getNewsFeed O(f log f) for f followees',
    space: 'O(users + tweets + follows)',
    pitfalls:
      'Forgot that a user sees their own tweets in the feed. Raised a KeyError when unfollowing someone who was not followed; use discard.',
  },
  'find-median-from-data-stream': {
    insight:
      'Keep a max-heap for the smaller half and a min-heap for the larger half, balanced to within one element. The median is a top, or the mean of both tops.',
    time: 'addNum O(log n), findMedian O(1)',
    space: 'O(n)',
    pitfalls:
      'Pushed to the wrong heap first and broke the ordering between the halves; push to one, then move its top across. Forgot to negate values in the max-heap.',
  },

  // --- Backtracking -------------------------------------------------------------------------
  subsets: {
    insight:
      'For each element choose to include it or skip it, and every path through those decisions is one subset.',
    time: 'O(n * 2^n)',
    space: 'O(n) recursion depth, not counting the output',
    pitfalls:
      'Appended the same list object instead of a copy, so every result changed later; use path[:] or list(path). Forgot that the empty subset is a result too.',
  },
  'combination-sum': {
    insight:
      'Recurse over the candidates from an index onward, staying on the same index to reuse a number. Stop when the remaining target is zero or negative.',
    time: 'O(N^(T / M)), with N candidates, target T and smallest candidate M',
    space: 'O(T / M) recursion depth',
    pitfalls:
      'Moved to i + 1 after choosing a number, so repeats were not allowed. Restarted the loop at 0 on every call and got permutations like [2, 3] and [3, 2].',
  },
  permutations: {
    insight:
      'Fill the permutation one slot at a time, trying every unused element for the next slot, and undo the choice after recursing.',
    time: 'O(n * n factorial), one full path per permutation',
    space: 'O(n)',
    pitfalls:
      'Forgot to unmark the used element after the recursive call. Appended the path without copying it.',
  },
  'subsets-ii': {
    insight:
      'Sort first so equal numbers sit together, then in each loop skip a number that equals the previous one at the same depth.',
    time: 'O(n * 2^n)',
    space: 'O(n)',
    pitfalls:
      'Skipped duplicates with i > 0 instead of i > start, which removed valid subsets like [1, 1]. Forgot to sort first.',
  },
  'combination-sum-ii': {
    insight:
      'Sort, use each number at most once by recursing on i + 1, and skip equal neighbors at the same depth. That way a duplicate combination is never built.',
    time: 'O(2^n)',
    space: 'O(n)',
    pitfalls:
      'Used the i > 0 duplicate check instead of i > start and lost combinations like [1, 1, 6]. Kept looping after a number exceeded the remaining target; the array is sorted, so break there.',
  },
}
