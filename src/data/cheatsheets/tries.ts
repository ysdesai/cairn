import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'Queries ask whether any stored word starts with a given prefix.',
    'Many words must be matched against the same input, such as every cell of a grid.',
    'A pattern with wildcard characters must be matched against a set of stored words.',
    'Words are built or checked one character at a time, and a dead prefix should stop the work.',
    'Autocomplete, longest common prefix or shortest unique prefix over a word list.',
  ],
  idea: 'Store words as paths in a tree with one node per character, so words that share a start share nodes. Walking a prefix takes time proportional to its length, regardless of how many words are stored. A flag on a node marks where a whole word ends, which separates a stored word from a prefix of one. When a search runs out of children, no stored word can continue, so the branch can be dropped immediately.',
  template: `class TrieNode:
    def __init__(self):
        self.children, self.end = {}, False   # end: a stored word stops here

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
        node.end = True

    def _walk(self, text):
        node = self.root
        for ch in text:
            node = node.children.get(ch)
            if node is None:
                return None               # no word continues this way
        return node

    def search(self, word):
        node = self._walk(word)
        return node is not None and node.end

    def starts_with(self, prefix):
        return self._walk(prefix) is not None`,
  templateNote: 'O(L) per insert or lookup for a word of length L; O(total characters) space. For wildcards, recurse into every child on a dot; for a grid search, walk the trie as you walk the grid.',
  mistakes: [
    'Returning true from a word search whenever the path exists, without checking the end marker.',
    'Forgetting to set the end marker on the last character during insert, so complete words are never found.',
    'In a grid search with many words, searching once per word instead of walking one trie.',
    'Not removing found words or empty branches, so the same word is reported twice or dead paths are re-walked.',
    'Mutating a shared path or visited marker without restoring it before trying the next branch.',
  ],
}
