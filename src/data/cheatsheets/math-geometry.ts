import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'A grid must be changed in place, or processed with constant extra space.',
    'The output order is a geometric walk: a spiral, a rotation, layer by layer.',
    'Numbers arrive as strings or digit arrays because they are too long for a built-in type.',
    'An exponent or count is so large that one step per unit would be far too slow.',
    'A numeric process must either finish or repeat, and you have to tell which.',
    'Points on a plane where one or two of them force the rest of a shape.',
  ],
  idea: 'These problems have no search to speak of; the work is getting the index arithmetic and the invariants exactly right. Name what stays true at each step: the four bounds still unvisited, the carry still owed, the exponent still to halve. Then write the loop so that invariant is restored every time, and test it on the smallest inputs, where boundaries collide.',
  template: `def spiral_order(grid):
    top, bottom = 0, len(grid) - 1
    left, right = 0, len(grid[0]) - 1
    out = []
    while top <= bottom and left <= right:
        for c in range(left, right + 1):
            out.append(grid[top][c])
        for r in range(top + 1, bottom + 1):
            out.append(grid[r][right])
        if top < bottom and left < right:  # skip when one row or column is left
            for c in range(right - 1, left - 1, -1):
                out.append(grid[bottom][c])
            for r in range(bottom - 1, top, -1):
                out.append(grid[r][left])
        top, bottom, left, right = top + 1, bottom - 1, left + 1, right - 1
    return out

def fast_pow(x, n):
    if n < 0:
        x, n = 1 / x, -n
    result = 1.0
    while n:
        if n & 1:
            result *= x
        x *= x          # square the base, halve the exponent
        n >>= 1
    return result`,
  templateNote: 'Spiral is O(m * n) time and O(1) extra space; fast_pow is O(log n). For rotations, replace the bounds with transpose then reverse each row.',
  mistakes: [
    'Walking the last row or column of a spiral twice when only one row or column remains.',
    'Overwriting a grid cell before its old value has been moved or recorded.',
    'Ignoring the sign of an exponent, or negating n when it is the most negative 32-bit value in a fixed-width language.',
    'Dropping the final carry, so 999 + 1 comes out as 000.',
    'Converting digit strings to built-in integers when the statement forbids it.',
  ],
}
