import { useSyncExternalStore } from 'react'

const NARROW = '(max-width: 640px)'

/** True on a phone, where a row's reason goes on a line of its own instead of being cut off. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(NARROW)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  )
}
