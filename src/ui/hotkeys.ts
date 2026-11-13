/**
 * Keyboard shortcuts.
 *
 *   useHotkeys({ 'mod+k': openPalette, 'g t': goToday, j: next, k: previous, Enter: open, '?': help })
 *
 * Syntax: single keys ('j', '?', 'Enter', 'Escape', 'ArrowDown', '1'), modifiers joined with +
 * ('mod+k', 'mod+shift+p'; `mod` is ⌘ on a Mac and Ctrl elsewhere), and two-key sequences
 * separated by a space ('g t').
 *
 * Layers decide who is listening. Only bindings on the top active layer fire, so a sheet's
 * shortcuts replace the page's while it is open, and a dialog's replace the sheet's. Sheet,
 * Modal and ConfirmHost raise their layer automatically while open. Bindings registered with
 * `global: true` fire on every layer (the command palette).
 *
 * Shortcuts never fire while the user is typing in a field unless the registration sets
 * `inFields: true` (so ⌘Z in a textarea stays the browser's own undo). Enter and Space are
 * left alone when a button, link or form control has focus, so they activate it as usual.
 */
import { useEffect, useRef } from 'react'

export type HotkeyHandler = (event: KeyboardEvent) => void

export const LAYER = { page: 0, sheet: 10, modal: 20, confirm: 30, palette: 40 } as const

interface HotkeyOptions {
  /** Default LAYER.page. */
  layer?: number
  /** Default true. */
  enabled?: boolean
  /** Fire even when another layer is on top. */
  global?: boolean
  /** Fire even while typing in an input or textarea. */
  inFields?: boolean
}

interface Registration {
  bindings: () => Record<string, HotkeyHandler | false | null | undefined>
  layer: number
  global: boolean
  inFields: boolean
}

const registrations: Registration[] = []
let pending: { key: string; at: number } | null = null
const SEQUENCE_MS = 900

const normalize = (combo: string) => combo.trim().toLowerCase().replace(/\s+/g, ' ')

function describe(event: KeyboardEvent): string | null {
  const raw = event.key
  if (!raw || raw === 'Shift' || raw === 'Control' || raw === 'Alt' || raw === 'Meta' || raw === 'Dead') return null
  const key = raw === ' ' ? 'space' : raw.toLowerCase()
  const mod = event.metaKey || event.ctrlKey
  const parts: string[] = []
  if (mod) parts.push('mod')
  if (event.altKey) parts.push('alt')
  // Shift only counts as a modifier next to another modifier or on a named key; "?" is just "?".
  if (event.shiftKey && (mod || event.altKey || raw.length > 1)) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

function isField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

/** Something that already does its own thing on Enter or Space: a button, a link, a form control. */
function isActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest('button, a[href], summary, input, select, textarea, [role="button"], [role="radio"], [role="tab"], [role="option"], [role="menuitem"], [role="switch"], [role="checkbox"]')
}

function activeRegistrations(): Registration[] {
  const top = registrations.reduce<number>((max, r) => Math.max(max, r.layer), LAYER.page)
  // Later registrations win, so the most recently mounted component gets the key.
  return registrations.filter((r) => r.global || r.layer === top).reverse()
}

function find(key: string, inField: boolean): HotkeyHandler | null {
  for (const reg of activeRegistrations()) {
    if (inField && !reg.inFields) continue
    const map = reg.bindings()
    for (const combo of Object.keys(map)) {
      const handler = map[combo]
      if (handler && normalize(combo) === key) return handler
    }
  }
  return null
}

function startsSequence(key: string, inField: boolean): boolean {
  if (inField || key.includes('+')) return false
  const prefix = `${key} `
  return activeRegistrations().some((reg) => Object.keys(reg.bindings()).some((c) => normalize(c).startsWith(prefix) && reg.bindings()[c]))
}

function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return
  const key = describe(event)
  if (!key) return
  const inField = isField(event.target)
  // Pressing Enter or Space on a focused control activates that control, as it always has.
  if ((key === 'enter' || key === 'space') && isActivatable(event.target)) {
    pending = null
    return
  }

  if (pending && Date.now() - pending.at < SEQUENCE_MS) {
    const sequence = `${pending.key} ${key}`
    pending = null
    const handler = find(sequence, inField)
    if (handler) {
      event.preventDefault()
      handler(event)
      return
    }
  } else {
    pending = null
  }

  const handler = find(key, inField)
  if (handler) {
    event.preventDefault()
    handler(event)
    return
  }
  if (startsSequence(key, inField)) pending = { key, at: Date.now() }
}

let listening = false
function ensureListening() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('keydown', onKeyDown)
}

/** Bind shortcuts for as long as the component is mounted (and `enabled`). */
export function useHotkeys(
  bindings: Record<string, HotkeyHandler | false | null | undefined>,
  { layer = LAYER.page, enabled = true, global = false, inFields = false }: HotkeyOptions = {},
): void {
  const latest = useRef(bindings)
  latest.current = bindings

  useEffect(() => {
    if (!enabled) return
    ensureListening()
    const registration: Registration = { bindings: () => latest.current, layer, global, inFields }
    registrations.push(registration)
    return () => {
      const at = registrations.indexOf(registration)
      if (at >= 0) registrations.splice(at, 1)
    }
  }, [enabled, layer, global, inFields])
}

/** Hold a layer open with no bindings of its own, silencing everything beneath it. */
export function useHotkeyLayer(layer: number, active: boolean): void {
  useHotkeys({}, { layer, enabled: active })
}
