import { cx } from './cx'
import s from './Kbd.module.css'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const GLYPHS: Record<string, string> = {
  mod: IS_MAC ? '⌘' : 'Ctrl',
  shift: '⇧',
  alt: IS_MAC ? '⌥' : 'Alt',
  enter: '↵',
  escape: 'Esc',
  esc: 'Esc',
  space: 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  backspace: '⌫',
  tab: 'Tab',
}

/** 'mod+k' → ['⌘', 'K'];  'g t' → ['G', 'T'] */
export function keyLabels(keys: string): string[] {
  return keys
    .split(/\s+/)
    .flatMap((chord) => (chord === '+' ? ['+'] : chord.split('+')))
    .filter(Boolean)
    .map((k) => GLYPHS[k.toLowerCase()] ?? (k.length === 1 ? k.toUpperCase() : k))
}

interface KbdProps {
  /** A shortcut in the same syntax the hotkey hook takes: 'mod+k', 'g t', '?', 'Enter'. */
  keys: string
  /** Sits on a filled button: translucent instead of paper. */
  onSolid?: boolean
  className?: string
}

/** Keycaps for a shortcut hint. Decorative: hidden from screen readers. */
export function Kbd({ keys, onSolid, className }: KbdProps) {
  return (
    <span className={cx(s.group, className)} aria-hidden="true">
      {keyLabels(keys).map((label, i) => (
        <kbd key={i} className={cx(s.kbd, onSolid && s.onSolid)}>
          {label}
        </kbd>
      ))}
    </span>
  )
}
