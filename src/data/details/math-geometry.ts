import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'rotate-image': {
    tags: ['layer rotation', 'in-place swap', 'transpose and reverse'],
    pattern: 'matrix',
    summary:
      'Given an n x n grid of numbers, turn it 90 degrees clockwise by rewriting the cells where they sit. Allocating a second grid is not allowed.',
    clue: 'The result is a fixed remapping of cell positions in a square grid, and a second grid is forbidden. Working out where each cell goes (or a reflection followed by a reversal) is the whole solution.',
    decoys: ['math', 'two-pointers', 'hashing'],
  },
  'spiral-matrix': {
    tags: ['boundary shrinking', 'layer by layer', 'simulation'],
    pattern: 'matrix',
    summary:
      'Given an m x n grid, return every value in the order you meet them walking clockwise around the outer edge and then inward, starting at the top-left corner.',
    clue: 'The required order is a walk around the border that repeats on a smaller rectangle. Four moving bounds (top, bottom, left, right) capture it; nothing needs to be searched or remembered.',
    decoys: ['graph-traversal', 'math', 'backtracking'],
  },
  'set-matrix-zeroes': {
    tags: ['in-place markers', 'first row and column', 'constant space'],
    pattern: 'matrix',
    summary:
      'Given an m x n grid of integers, whenever a cell is 0 set its whole row and whole column to 0. Modify the grid in place.',
    clue: 'You must remember which rows and columns to clear, yet the grid is the only free memory. Using the first row and first column as flags is an index trick, not a data structure.',
    decoys: ['hashing', 'graph-traversal', 'heap'],
  },
  'happy-number': {
    tags: ['visited set', 'cycle detection', 'digit square sum'],
    pattern: 'hashing',
    summary:
      'Starting from a positive integer, repeatedly replace it with the sum of the squares of its digits. Return whether the process eventually reaches 1 or goes on forever without doing so.',
    clue: 'The sequence either reaches 1 or revisits a value it already produced, and the values stay small. Remembering what you have seen tells you exactly when to stop and answer false.',
    decoys: ['math', 'dp-linear', 'binary-search'],
    alt: ['fast-slow'],
  },
  'plus-one': {
    tags: ['carry propagation', 'digit array', 'right to left'],
    pattern: 'math',
    summary:
      'A non-negative integer is stored as an array of its decimal digits, most significant first. Return the digits of that number plus one, in the same format.',
    clue: 'The number can be longer than a built-in integer holds, so the addition is done the way you do it on paper: start at the last digit and carry left. Only an all-nines input makes the array longer.',
    decoys: ['two-pointers', 'prefix-suffix', 'bit-manipulation'],
  },
  'powx-n': {
    tags: ['fast exponentiation', 'exponent halving', 'negative exponent'],
    pattern: 'math',
    summary:
      'Return x raised to the power n, for a real number x and an integer n that may be negative and has magnitude up to 2^31.',
    clue: 'x^n equals (x^(n/2))^2, times one more x when n is odd, so the exponent halves at every step. About 31 squarings replace billions of multiplications.',
    decoys: ['binary-search', 'dp-linear', 'greedy'],
    alt: ['bit-manipulation'],
  },
  'multiply-strings': {
    tags: ['digit-by-digit', 'position array', 'carry'],
    pattern: 'math',
    summary:
      'Given two non-negative integers written as decimal strings, return their product as a string. You may not use a big-integer library or convert the inputs directly to integers.',
    clue: 'The numbers are too long for any integer type, so you multiply as on paper. Digit i times digit j always lands at result positions i + j and i + j + 1, with carries.',
    decoys: ['two-pointers', 'prefix-suffix', 'dp-linear'],
  },
  'detect-squares': {
    tags: ['point counter', 'diagonal corner', 'coordinate map'],
    pattern: 'hashing',
    summary:
      'Design a structure that adds points on a plane (the same point may be added repeatedly) and, for a query point, counts the ways to choose three stored points that form an axis-aligned square of positive area with it.',
    clue: 'A query point plus one stored diagonal corner fixes the other two corners exactly. You need instant lookup of how many copies of a point exist, then multiply the counts.',
    decoys: ['math', 'matrix', 'binary-search'],
    alt: ['design'],
  },
}
