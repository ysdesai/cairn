import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'reverse-linked-list': {
    tags: ['iterative reversal', 'prev and next pointers', 'in-place'],
    pattern: 'linked-list',
    summary:
      'Given the head of a singly linked list, return the head of the same list with the order of its nodes reversed. The list may be empty.',
    clue: 'Nothing is searched or computed. The task is to flip every next pointer, which means saving the old next node before overwriting the link.',
    decoys: ['stack', 'two-pointers', 'heap'],
  },
  'merge-two-sorted-lists': {
    tags: ['dummy head', 'splicing nodes', 'in-place merge'],
    pattern: 'linked-list',
    summary:
      'Given the heads of two linked lists that are each sorted in ascending order, join their nodes into one sorted linked list and return its head. Either list may be empty.',
    clue: 'The output is built from the existing nodes by relinking them. A dummy head gives the result a starting point, so the first node needs no special case.',
    decoys: ['heap', 'stack', 'binary-search'],
  },
  'reorder-list': {
    tags: ['find the middle', 'reverse second half', 'interleave lists'],
    pattern: 'linked-list',
    summary:
      'Rearrange a singly linked list in place so it alternates between the first and last remaining nodes: first, last, second, second to last, and so on. Only links may change, not node values.',
    clue: 'The new order pairs the front with the back, and a singly linked list cannot walk backward. Reversing the second half and weaving the halves together does it with no extra storage.',
    decoys: ['stack', 'two-pointers', 'hashing'],
    alt: ['fast-slow'],
  },
  'remove-nth-node-from-end-of-list': {
    tags: ['gap between pointers', 'dummy head', 'single pass'],
    pattern: 'fast-slow',
    summary:
      'Given the head of a singly linked list and an integer n, remove the n-th node counting from the end and return the head.',
    clue: 'The position is measured from the end of a list whose length is unknown. A lead pointer sent n steps ahead means the trailing pointer reaches the node before the target as the lead finishes.',
    decoys: ['hashing', 'stack', 'binary-search'],
    alt: ['linked-list', 'two-pointers'],
  },
  'copy-list-with-random-pointer': {
    tags: ['hash map of nodes', 'old to new mapping', 'two passes'],
    pattern: 'hashing',
    summary:
      'Each node of a linked list has a next pointer and a random pointer that may reference any node in the list, or null. Build a deep copy of new nodes whose pointers only reference copied nodes, and return its head.',
    clue: 'A random pointer can target a node the copy has not created yet. A lookup from each original node to its copy lets every pointer be wired up, whichever order the nodes are created in.',
    decoys: ['two-pointers', 'stack', 'heap'],
    alt: ['linked-list'],
  },
  'add-two-numbers': {
    tags: ['dummy head', 'carry', 'digit-by-digit'],
    pattern: 'linked-list',
    summary:
      'Two non-empty linked lists each hold a non-negative integer, one digit per node, with the least significant digit first. Return a linked list holding their sum in the same format.',
    clue: 'The digits are stored least significant first, so walking both lists from the head matches how addition works. Carrying one value along and appending to a dummy-headed result builds the sum as you go.',
    decoys: ['stack', 'two-pointers', 'binary-search'],
  },
  'linked-list-cycle': {
    tags: ['fast and slow pointers', 'floyd cycle detection', 'constant space'],
    pattern: 'fast-slow',
    summary:
      'Given the head of a singly linked list, return whether following the next pointers ever leads back to a node that was already visited.',
    clue: 'Constant memory rules out remembering visited nodes. A runner moving two steps at a time must eventually lap one moving a single step if, and only if, the list loops.',
    decoys: ['linked-list', 'stack', 'two-pointers'],
    alt: ['hashing'],
  },
  'find-the-duplicate-number': {
    tags: ['array as linked list', 'floyd cycle detection', 'cycle entrance'],
    pattern: 'fast-slow',
    summary:
      'Given an array of n + 1 integers, each between 1 and n, exactly one value appears more than once. Return it without modifying the array.',
    clue: 'Every value is a valid index, so treating nums[i] as a next pointer gives a chain that must loop. Two indices holding the same value point to one node, so the duplicate is where the loop begins.',
    decoys: ['hashing', 'bit-manipulation', 'math'],
    alt: ['search-on-answer'],
  },
  'lru-cache': {
    tags: ['hash map', 'doubly linked list', 'o(1) eviction'],
    pattern: 'design',
    summary:
      'Implement a fixed-capacity cache with get(key), which returns the value or -1, and put(key, value), both in O(1) average time. Adding a key to a full cache evicts the least recently used key; reads and writes both count as use.',
    clue: 'Lookup needs a key index, while eviction needs the keys in order of recent use. No single structure does both in O(1), so two are combined, each holding references into the other.',
    decoys: ['hashing', 'heap', 'linked-list'],
  },
  'merge-k-sorted-lists': {
    tags: ['divide and conquer', 'pairwise merge', 'dummy head'],
    pattern: 'linked-list',
    summary:
      'Given an array of k linked lists, each sorted in ascending order, merge them into a single sorted linked list and return its head. Some lists may be empty, and k may be zero.',
    clue: 'Merging two sorted lists is a known splice. Merging the k lists in pairs, round after round, reuses it and brings the cost to O(N log k) instead of folding the lists in one at a time.',
    decoys: ['two-pointers', 'greedy', 'dp-linear'],
    alt: ['heap'],
  },
  'reverse-nodes-in-k-group': {
    tags: ['group reversal', 'dummy head', 'constant space'],
    pattern: 'linked-list',
    summary:
      'Given the head of a linked list and an integer k, reverse the nodes k at a time and return the new head; a final group with fewer than k nodes stays as it is. Only links may change, not node values.',
    clue: 'Each block is reversed in place, then reconnected to the block before and after it. Keeping a pointer to the node preceding the block, with a dummy head for the first one, makes the relinking uniform.',
    decoys: ['stack', 'two-pointers', 'heap'],
  },
}
