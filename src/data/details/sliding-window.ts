import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'best-time-to-buy-and-sell-stock': {
    tags: ['running minimum', 'single pass', 'ordered difference'],
    pattern: 'sliding-window',
    summary:
      'Given a stock\'s price on each day, pick a day to buy and a later day to sell so the profit is as large as possible. Return that profit, or 0 if every possible trade loses money or breaks even.',
    clue: 'The sell day must come after the buy day, so the pair is a range moving right. A price lower than the current buy day restarts the range there, since any later sale is better from it, and one pass is enough.',
    decoys: ['monotonic-stack', 'heap', 'binary-search'],
    alt: ['greedy'],
  },
  'longest-substring-without-repeating-characters': {
    tags: ['variable window', 'last seen index', 'unique characters'],
    pattern: 'sliding-window',
    summary:
      'Given a string, return the length of its longest contiguous substring in which no character appears more than once.',
    clue: 'A contiguous range whose validity only breaks when one new character repeats an earlier one. Moving the left edge past that earlier copy restores validity, so each character enters and leaves the range once.',
    decoys: ['hashing', 'dp-linear', 'binary-search'],
    alt: ['two-pointers'],
  },
  'longest-repeating-character-replacement': {
    tags: ['variable window', 'character counts', 'max frequency'],
    pattern: 'sliding-window',
    summary:
      'Given an uppercase string and an integer k, you may change at most k characters to any other letter. Return the length of the longest substring that can be made to consist of one repeated letter.',
    clue: 'A substring is fixable when its length minus the count of its most common letter is at most k. Adding a character can break that and dropping from the left repairs it, so the range grows and shrinks in one pass.',
    decoys: ['hashing', 'dp-linear', 'greedy'],
  },
  'permutation-in-string': {
    tags: ['fixed window', 'letter counts', 'anagram match'],
    pattern: 'sliding-window',
    summary:
      'Given two strings s1 and s2, decide whether s2 contains a contiguous substring that is a rearrangement of the letters of s1.',
    clue: 'The target substring has a fixed length, len(s1), and a fixed letter multiset. Stepping a fixed-length range one position adds one letter and drops one, so the counts update in constant time instead of being rebuilt.',
    decoys: ['backtracking', 'hashing', 'dp-linear'],
    alt: ['two-pointers'],
  },
  'minimum-window-substring': {
    tags: ['variable window', 'need and have counts', 'shrink while valid'],
    pattern: 'sliding-window',
    summary:
      'Given strings s and t, return the shortest substring of s that contains every character of t, counting repeats. Return an empty string if there is none.',
    clue: 'Shortest contiguous range that meets a coverage condition: extend the right edge until everything in t is covered, then pull the left edge in while coverage holds. Both edges only move forward.',
    decoys: ['hashing', 'greedy', 'dp-linear'],
    alt: ['two-pointers'],
  },
  'sliding-window-maximum': {
    tags: ['monotonic deque', 'store indices', 'fixed window'],
    pattern: 'monotonic-stack',
    summary:
      'Given an array and an integer k, a block of k consecutive numbers moves from the left end to the right end one step at a time. Return the maximum of the block at every position.',
    clue: 'Each step needs the maximum of a moving range fast. An older value that is smaller than a newcomer can never be the maximum again, so keep candidates in decreasing order and drop the dominated ones.',
    decoys: ['binary-search', 'hashing', 'greedy'],
    alt: ['heap', 'sliding-window'],
  },
}
