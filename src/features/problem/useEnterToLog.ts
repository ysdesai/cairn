import { useEffect, useRef } from 'react'

/** Marks the sheet's content so a key press can tell whether it happened in this sheet. */
export const SHEET_MARK = 'data-problem-sheet'

/**
 * Plain Enter logs the attempt when focus is not in a text field. It cannot be a normal hotkey:
 * those swallow Enter everywhere, which would break every button the keyboard is resting on.
 * So this listens first, and only acts when the key would otherwise do nothing, or when the
 * focus is on a rating (a radio button, where Enter is how you confirm it).
 */
export function useEnterToLog(enabled: boolean, onEnter: () => void): void {
  const latest = useRef(onEnter)
  latest.current = onEnter

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      // Only inside the problem sheet, never in a confirm or the palette stacked above it.
      if (!target.closest('[role="dialog"]')?.querySelector(`[${SHEET_MARK}]`)) return
      if (target.closest('input, textarea, select, a, [contenteditable="true"]')) return
      if (target.closest('button') && !target.closest('[role="radio"]')) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled])
}
