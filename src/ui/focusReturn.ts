import { useCallback, useRef } from 'react'

/** Where focus was when an overlay opened: the element itself, and the problem row it belonged to. */
interface Opener {
  el: HTMLElement | null
  slug: string | null
}

function slugFromAddress(): string | null {
  const query = window.location.hash.split('?')[1]
  return query ? new URLSearchParams(query).get('p') : null
}

function usable(el: HTMLElement | null): el is HTMLElement {
  return !!el && el !== document.body && el.isConnected
}

/**
 * Radix returns focus to a Dialog.Trigger, but every overlay here is opened from somewhere else
 * (a list row, the top bar, a shortcut), so there is no trigger and focus would fall to <body>.
 * Spread the result on a Dialog.Content:
 *
 *   const focus = useFocusReturn()
 *   <Dialog.Content onOpenAutoFocus={focus.onOpenAutoFocus} onCloseAutoFocus={focus.onCloseAutoFocus}>
 *
 * It remembers the element that had focus when the overlay opened and puts focus back on it when
 * the overlay closes. If that element has gone (the list re-rendered, or the overlay was opened from
 * the palette), it falls back to the row of the same problem, the row under the list cursor, and
 * finally the main landmark. Sheet, Modal and the confirm dialog already do this.
 *
 * Call `event.preventDefault()` in your own onCloseAutoFocus to opt out (the palette does when a
 * command moves the user somewhere new).
 */
export function useFocusReturn(options?: { onOpenAutoFocus?: (event: Event) => void }) {
  const opener = useRef<Opener>({ el: null, slug: null })
  const onOpen = options?.onOpenAutoFocus
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  const onOpenAutoFocus = useCallback((event: Event) => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    opener.current = {
      el: active && active !== document.body ? active : null,
      slug: active?.closest<HTMLElement>('[data-slug]')?.dataset.slug ?? slugFromAddress(),
    }
    onOpenRef.current?.(event)
  }, [])

  const onCloseAutoFocus = useCallback((event: Event) => {
    // Radix would focus its (missing) trigger. Take over.
    event.preventDefault()
    const { el, slug } = opener.current
    opener.current = { el: null, slug: null }
    let target: HTMLElement | null = usable(el) ? el : null
    if (!target && slug) target = document.querySelector<HTMLElement>(`[data-slug="${CSS.escape(slug)}"]`)
    if (!target) target = document.querySelector<HTMLElement>('[data-slug][data-active]')
    if (!target) target = document.getElementById('main')
    target?.focus({ preventScroll: true })
  }, [])

  return { onOpenAutoFocus, onCloseAutoFocus }
}
