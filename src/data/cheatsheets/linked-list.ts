import type { CheatSheet } from '../types'

export const sheet: CheatSheet = {
  clues: [
    'The input is a singly linked list and the answer should reuse its nodes, not copy them into an array.',
    'The statement says in place or O(1) extra space, so changing next pointers is the intended tool.',
    'You need the middle, the k-th node from the end, or whether the list loops, and the length is not given.',
    'The head itself might be deleted or replaced, as when merging, filtering or reversing a prefix.',
    'The order must be flipped, or the front paired with the back, which a one-way list cannot walk directly.',
    'An array of indices or values doubles as next pointers, so a repeat means a loop.',
  ],
  idea: 'A node is only reachable through the one before it, so every change is a matter of rewiring links in the right order: save what you are about to overwrite, then relink. A dummy node in front of the head makes deleting or inserting at the front the same as anywhere else. Two runners at different speeds, or a fixed gap apart, find the middle, the end offset or a cycle in one pass without storing nodes.',
  template: `# ListNode(val, next) as LeetCode defines it.
def reverse(head):
    prev = None
    while head:
        nxt = head.next       # save before overwriting the link
        head.next = prev
        prev, head = head, nxt
    return prev

def middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow               # second middle when the length is even

def remove_all(head, val):
    dummy = ListNode(0, head) # the head may be removed too
    cur = dummy
    while cur.next:
        if cur.next.val == val:
            cur.next = cur.next.next
        else:
            cur = cur.next
    return dummy.next`,
  templateNote: 'O(n) time and O(1) space for each routine. Combine them: middle, reverse the back half, then merge for reordering tasks.',
  mistakes: [
    'Overwriting node.next before saving the old next node, which cuts off the rest of the list.',
    'Special-casing removal of the head instead of using a dummy node, and breaking when the head is the target.',
    'Testing fast.next.next without first checking fast and fast.next, which crashes on odd or empty lists.',
    'Splitting a list without setting the end of the first half to None, which leaves a cycle or a duplicate tail.',
    'Placing the lead pointer one step off, so the trailing pointer stops on the target and not the node before it.',
  ],
}
