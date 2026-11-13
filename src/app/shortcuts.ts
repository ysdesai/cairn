/**
 * Every keyboard shortcut in the app, in one place. The reference dialog (press ?) renders this
 * list, and each screen binds the keys listed for it, so the two cannot drift apart.
 */

export interface Shortcut {
  /** Same syntax as useHotkeys: 'mod+k', 'g t', 'j', 'Enter'. Alternatives separated by ' / '. */
  keys: string
  label: string
}

export interface ShortcutGroup {
  title: string
  /** Where these apply. */
  where: string
  items: Shortcut[]
}

export const SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: 'Everywhere',
    where: 'Any screen',
    items: [
      { keys: 'mod+k', label: 'Search problems, topics and commands' },
      { keys: '?', label: 'Show this reference' },
      { keys: '/', label: 'Search the problem list' },
      { keys: 'mod+z', label: 'Undo the last logged change' },
      { keys: 'Escape', label: 'Close whatever is open' },
    ],
  },
  {
    title: 'Go to',
    where: 'Any screen',
    items: [
      { keys: 'g t', label: 'Today' },
      { keys: 'g m', label: 'Map' },
      { keys: 'g p', label: 'Problems' },
      { keys: 'g d', label: 'Drill' },
      { keys: 'g k', label: 'Mock interview' },
      { keys: 'g i', label: 'Insights' },
      { keys: 'g s', label: 'Settings' },
    ],
  },
  {
    title: 'Lists',
    where: 'Today, Problems, a topic on the map',
    items: [
      { keys: 'j / ArrowDown', label: 'Next row' },
      { keys: 'k / ArrowUp', label: 'Previous row' },
      { keys: 'Enter', label: 'Open the selected problem' },
    ],
  },
  {
    title: 'Today',
    where: 'Today',
    items: [
      { keys: 'Enter', label: 'Start the next item on the route' },
      { keys: 'b', label: 'Rebuild the session for the chosen time' },
    ],
  },
  {
    title: 'Problem',
    where: 'With a problem open',
    items: [
      { keys: 's', label: 'Start solving: start the timer and open LeetCode' },
      { keys: 't', label: 'Start or pause the timer' },
      { keys: 'r', label: 'Start a revision (recall first)' },
      { keys: '1', label: 'Rate Easy' },
      { keys: '2', label: 'Rate Struggled' },
      { keys: '3', label: 'Rate Needed help' },
      { keys: 'mod+Enter', label: 'Save the log, or reveal notes during recall' },
      { keys: 'n', label: 'Write notes' },
      { keys: 'o', label: 'Open on LeetCode' },
      { keys: 'c', label: 'Open a coaching chat' },
      { keys: 'w', label: 'Open the video walkthrough' },
      { keys: ']', label: 'Next problem' },
      { keys: '[', label: 'Previous problem' },
    ],
  },
  {
    title: 'Map',
    where: 'Map',
    items: [
      { keys: 'ArrowRight / ArrowLeft', label: 'Move between camps along the roadmap' },
      { keys: 'Enter', label: 'Open the selected camp' },
      { keys: '+', label: 'Zoom in' },
      { keys: '-', label: 'Zoom out' },
      { keys: '0', label: 'Fit the whole map' },
      { keys: 'h', label: 'Go to where you are' },
    ],
  },
  {
    title: 'Drill',
    where: 'Pattern drill',
    items: [
      { keys: '1 / 2 / 3 / 4', label: 'Pick a pattern' },
      { keys: 'Enter / Space', label: 'Start, or go to the next card' },
      { keys: 'Escape', label: 'End the run' },
    ],
  },
  {
    title: 'Mock',
    where: 'Mock interview',
    items: [
      { keys: 'Enter', label: 'Start the mock' },
      { keys: '1 / 2', label: 'Mark a problem finished' },
      { keys: 'e', label: 'End early' },
    ],
  },
]
