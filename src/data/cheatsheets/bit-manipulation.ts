import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'Every value appears twice except one, and the space limit rules out a hash map.',
    'The statement talks about binary digits: counting 1s, reversing, a 32-bit width.',
    'Arithmetic operators such as + and - are banned.',
    'Numbers from a known range 0 to n with exactly one missing.',
    'The answer for i can be built from the answer for i >> 1, the same number without its lowest bit.',
  ],
  idea: 'Treat an integer as a row of independent bits and use the operators that act on them in one step. XOR is its own inverse, so equal values cancel and order does not matter. n & (n - 1) clears the lowest set bit, which makes the loop run once per 1. Shifts and masks move and isolate single bits, and addition is XOR for the digits plus AND shifted left for the carry.',
  template: `def single(nums):
    acc = 0
    for x in nums:
        acc ^= x            # equal pairs cancel
    return acc


def count_ones(n):
    n &= 0xFFFFFFFF         # treat negatives as 32-bit
    count = 0
    while n:
        n &= n - 1          # clear the lowest set bit
        count += 1
    return count


def add(a, b):
    mask = 0xFFFFFFFF
    a, b = a & mask, b & mask
    while b:
        a, b = a ^ b, ((a & b) << 1) & mask   # sum without carry, carry
    return a if a <= 0x7FFFFFFF else ~(a ^ mask)  # back to a signed value


def reverse_bits(n):
    out = 0
    for _ in range(32):
        out = (out << 1) | (n & 1)   # take the lowest bit, append it
        n >>= 1
    return out`,
  templateNote: 'Each runs in O(n) or O(bits) time with O(1) space. Python integers have no fixed width, so mask to 32 bits whenever negatives or overflow matter.',
  mistakes: [
    'Forgetting that Python integers are unbounded, so negative numbers and shifts need an explicit 32-bit mask.',
    'Forgetting that + binds tighter than << and &, so 1 << i + 1 means 1 << (i + 1); parenthesize mixed expressions.',
    'Relying on XOR cancellation when values repeat an odd number of times, such as three copies, which leaves one behind.',
    'Shifting right on a negative number and expecting zeros to enter from the left.',
    'Looping while n > 0 on a value that can be negative, or stopping before all 32 positions are processed.',
  ],
}
