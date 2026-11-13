import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'implement-trie-prefix-tree': {
    tags: ['prefix tree', 'character nodes', 'end marker'],
    pattern: 'trie',
    summary:
      'Build a structure for lowercase words with three operations: insert(word), search(word) for an exact match, and startsWith(prefix) for whether any inserted word begins with the prefix.',
    clue: 'Prefix queries are the whole point, and words sharing a start should share storage. A tree with one node per character gives both, and an end marker separates words from mere prefixes.',
    decoys: ['hashing', 'design', 'binary-search'],
  },
  'design-add-and-search-words-data-structure': {
    tags: ['trie', 'wildcard search', 'branching on dot'],
    pattern: 'trie',
    summary:
      'Design a structure with addWord(word) and search(query), where a query may contain the character "." standing for any single lowercase letter. Return whether any stored word matches the whole query.',
    clue: 'Letters are matched one position at a time, so words that share a prefix can share a path. A wildcard just means following every child at that level instead of one.',
    decoys: ['design', 'binary-search', 'backtracking'],
  },
  'word-search-ii': {
    tags: ['trie', 'grid search', 'pruning'],
    pattern: 'trie',
    summary:
      'Given a grid of letters and a list of words, return every word that can be spelled by a path of horizontally or vertically adjacent cells, using no cell twice within one word.',
    clue: 'Searching the grid once per word repeats work for words with common starts. Loading all words into a prefix tree lets one walk follow every word at once and stop as soon as no word continues.',
    decoys: ['dp-grid', 'matrix', 'binary-search'],
    alt: ['backtracking'],
  },
}
