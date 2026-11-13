import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input has nesting or pairing: brackets, tags, nested calls, undo operations.',
    'The item you need next is always the most recent one that is still unresolved.',
    'For each element you need the next or previous greater or smaller element.',
    'An expression must be evaluated, where each token acts on the latest results.',
    'Elements wait for something later in the input to settle them, and you want one pass.',
  ],
  idea: 'A stack always hands back the newest unresolved item, which is exactly what nesting and matching need. A monotonic stack goes further: it keeps waiting items in sorted order, so a new element resolves a whole run of them at once by popping. Each element is pushed once and popped once, so the pass is linear even though the code has a loop inside a loop.',
  template: `def next_greater(nums):
    answer = [-1] * len(nums)
    stack = []                                # indices still waiting, values decreasing
    for i, value in enumerate(nums):
        while stack and nums[stack[-1]] < value:
            answer[stack.pop()] = value       # value resolves every smaller waiter
        stack.append(i)
    return answer


def balanced(s):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False                  # closer has no matching opener
        else:
            stack.append(ch)
    return not stack                          # leftover openers are unmatched`,
  templateNote:
    'O(n) time, O(n) space. For next smaller, flip the comparison; for previous greater, read the stack top before pushing; push values instead of indices when positions are not needed.',
  mistakes: [
    'Popping from an empty stack: check that the stack is non-empty before reading or popping its top.',
    'Forgetting to inspect what is left on the stack at the end, such as unmatched openers or items with no greater element.',
    'Pushing values when the answer needs distances or widths, which requires pushing indices.',
    'Using the wrong comparison, so equal values are popped (or kept) when the problem wants the opposite.',
    'Popping operands in the wrong order for subtraction and division: the first pop is the right-hand operand.',
  ],
}
