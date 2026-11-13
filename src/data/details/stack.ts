import type { ProblemDetail } from '../types'

/** Learning content for each problem in this topic, keyed by slug. */
export const details: Record<string, ProblemDetail> = {
  'valid-parentheses': {
    tags: ['bracket matching', 'last in first out', 'map of pairs'],
    pattern: 'stack',
    summary:
      'Given a string made only of the characters ()[]{}, decide whether every opening bracket is closed by a bracket of the same type, in the correct order.',
    clue: 'Each closing bracket must match the most recent opening bracket that is still unmatched. The latest opened is the first to be closed, which is last-in-first-out.',
    decoys: ['two-pointers', 'hashing', 'greedy'],
  },
  'min-stack': {
    tags: ['auxiliary stack', 'running minimum', 'constant time'],
    pattern: 'stack',
    summary:
      'Support four operations on a collection of integers: add a value, remove the most recently added one, read that one, and report the smallest value currently held. Each operation must take constant time.',
    clue: 'The minimum must be available in O(1) even after pops. Storing the minimum so far next to each pushed value means popping automatically exposes the previous minimum.',
    decoys: ['heap', 'hashing', 'monotonic-stack'],
    alt: ['design'],
  },
  'evaluate-reverse-polish-notation': {
    tags: ['postfix evaluation', 'operand stack', 'pop two push result'],
    pattern: 'stack',
    summary:
      'Given the tokens of an arithmetic expression written with each operator after its two operands, evaluate it and return the integer result. Division truncates toward zero.',
    clue: 'Every operator acts on the two most recent results that have not been used yet. Pushing numbers and replacing the top two with the result at each operator evaluates the expression in one pass.',
    decoys: ['math', 'tree-dfs', 'monotonic-stack'],
  },
  'generate-parentheses': {
    tags: ['open and close counts', 'prune invalid prefixes', 'choose and undo'],
    pattern: 'backtracking',
    summary:
      'Given n, return every distinct string made of n pairs of parentheses that is well-formed. The strings may be returned in any order.',
    clue: 'All valid strings must be listed, not counted, and each has a fixed length of 2n. Add one character at a time, allowing an opener while fewer than n are used and a closer only if openers exceed closers, then undo.',
    decoys: ['stack', 'greedy', 'math'],
  },
  'daily-temperatures': {
    tags: ['next greater element', 'decreasing stack', 'store indices'],
    pattern: 'monotonic-stack',
    summary:
      'Given the temperature on each day, return for every day how many days you must wait for a warmer one. Use 0 where no later day is warmer.',
    clue: 'Each element wants the next strictly greater value to its right. Days still waiting for a warmer one are held in non-increasing order, and a warmer reading resolves every colder waiting day at once.',
    decoys: ['sliding-window', 'heap', 'two-pointers'],
  },
  'car-fleet': {
    tags: ['sort by position', 'arrival time', 'fleet merging'],
    pattern: 'stack',
    summary:
      'Cars start at given positions on a one-lane road and drive toward a target at given speeds. A car cannot pass the one ahead and travels at its speed once it catches up; return how many separate groups arrive at the target.',
    clue: 'Sorted by start position, each car has an arrival time. A car that would arrive no later than the group ahead merges into it, so only the last group on the stack matters when the next car is processed.',
    decoys: ['intervals', 'heap', 'two-pointers'],
    alt: ['greedy', 'monotonic-stack'],
  },
  'largest-rectangle-in-histogram': {
    tags: ['nearest smaller element', 'increasing stack', 'width from indices'],
    pattern: 'monotonic-stack',
    summary:
      'Given the heights of adjacent bars, each one unit wide, return the area of the largest rectangle that fits entirely inside the bars.',
    clue: 'Every bar is the limiting height of one rectangle that stretches until a shorter bar on each side. Keeping bars in increasing order lets a shorter bar close the taller ones and compute their areas as they pop.',
    decoys: ['two-pointers', 'sliding-window', 'greedy'],
  },
}
