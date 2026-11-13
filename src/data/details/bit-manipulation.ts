import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'single-number': {
    tags: ['xor', 'cancel pairs', 'constant space'],
    pattern: 'bit-manipulation',
    summary:
      'Every value in an array appears exactly twice except one value that appears once. Return that value.',
    clue: 'Pairs of equal numbers must vanish while one number survives, in O(1) space. XOR is order-independent and x ^ x = 0, so folding the whole array together wipes out every pair.',
    decoys: ['hashing', 'math', 'binary-search'],
  },
  'number-of-1-bits': {
    tags: ['n and n-1', 'clear lowest set bit', 'bit counting'],
    pattern: 'bit-manipulation',
    summary:
      'Given a positive integer, return the number of 1 digits in its binary representation (its Hamming weight).',
    clue: 'The answer is a property of the binary digits themselves. n & (n - 1) removes the lowest 1 bit, so a loop runs once per 1 rather than once per position.',
    decoys: ['dp-linear', 'hashing', 'greedy'],
  },
  'counting-bits': {
    tags: ['bit dp', 'right shift recurrence', 'linear time'],
    pattern: 'dp-linear',
    summary:
      'Given n, return an array of length n + 1 whose entry i is the number of 1s in the binary form of i.',
    clue: 'You need the count for every number from 0 to n, and i shares all but its lowest bit with i >> 1. Each entry is a one-step extension of an earlier entry, so fill the table left to right.',
    decoys: ['hashing', 'math', 'prefix-suffix'],
    alt: ['bit-manipulation'],
  },
  'reverse-bits': {
    tags: ['shift and mask', 'fixed width', 'build bit by bit'],
    pattern: 'bit-manipulation',
    summary:
      'Given a 32-bit unsigned integer, return the integer you get by reading its 32 binary digits in the opposite order.',
    clue: 'The width is fixed at 32, so peel the lowest bit off the input and push it onto the low end of the output, shifting each time. After 32 rounds the order is flipped.',
    decoys: ['stack', 'math', 'heap'],
  },
  'missing-number': {
    tags: ['xor with indices', 'cancel pairs', 'constant space'],
    pattern: 'bit-manipulation',
    summary:
      'An array holds n distinct numbers taken from 0 to n, so exactly one number in that range is absent. Return it.',
    clue: 'The indices 0 to n and the values cover almost the same set. XOR-ing every index and every value cancels each match and leaves the missing number, with no extra memory.',
    decoys: ['hashing', 'binary-search', 'prefix-suffix'],
    alt: ['math'],
  },
  'sum-of-two-integers': {
    tags: ['xor as sum', 'and shift as carry', 'masking to 32 bits'],
    pattern: 'bit-manipulation',
    summary:
      'Return the sum of two integers a and b without using the plus or minus operators. The inputs may be negative.',
    clue: 'Arithmetic operators are banned, so rebuild addition from logic. XOR gives each column sum without carry, AND shifted left gives the carries, and you repeat until no carry remains.',
    decoys: ['math', 'dp-linear', 'binary-search'],
  },
  'reverse-integer': {
    tags: ['digit pop and push', 'overflow check', 'modulo and divide'],
    pattern: 'math',
    summary:
      'Given a signed 32-bit integer, return its decimal digits in reverse order, keeping the sign, or 0 if the result falls outside the signed 32-bit range. Assume 64-bit integers are unavailable.',
    clue: 'Digits are peeled off with modulo 10 and rebuilt in reverse with multiply-by-10, which is plain arithmetic. The real catch is testing the 32-bit bound before the next multiplication overflows.',
    decoys: ['bit-manipulation', 'stack', 'two-pointers'],
  },
}
