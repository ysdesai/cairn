import { useCallback, useEffect, useRef, useState } from 'react'
import { useActions } from '../../state/hooks'
import type { Notes } from '../../state/schema'

export type NoteField = 'insight' | 'time' | 'space' | 'pitfalls'
type Patch = Partial<Record<NoteField, string>>

const DEBOUNCE_MS = 400
const SAVED_MS = 2600

/**
 * Notes that save themselves. Edits are held as a draft, written about 400ms after typing stops,
 * and always written on blur, when the sheet closes, when the problem changes and when the page is hidden or left. Fields with
 * no draft show what is stored, so a change made elsewhere (the recall panel) appears at once.
 */
export function useNotes(slug: string, stored: Notes, open: boolean) {
  const actions = useActions()
  const [draft, setDraft] = useState<Patch>({})
  const [saved, setSaved] = useState<NoteField[]>([])
  const pending = useRef<Patch>({})
  const writeTimer = useRef<number | undefined>(undefined)
  const savedTimer = useRef<number | undefined>(undefined)

  /** Write whatever is waiting. Returns the fields written. */
  const commit = useCallback((): NoteField[] => {
    window.clearTimeout(writeTimer.current)
    const patch = pending.current
    const fields = Object.keys(patch) as NoteField[]
    if (fields.length === 0) return fields
    pending.current = {}
    actions.setNotes(slug, patch)
    return fields
  }, [actions, slug])

  const flush = useCallback(() => {
    const fields = commit()
    if (fields.length === 0) return
    setDraft({})
    setSaved(fields)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved([]), SAVED_MS)
  }, [commit])

  const edit = useCallback(
    (field: NoteField, text: string) => {
      pending.current = { ...pending.current, [field]: text }
      setDraft((current) => ({ ...current, [field]: text }))
      setSaved((current) => current.filter((f) => f !== field))
      window.clearTimeout(writeTimer.current)
      writeTimer.current = window.setTimeout(flush, DEBOUNCE_MS)
    },
    [flush],
  )

  // Closing, or moving to another problem, must never lose the last keystrokes.
  useEffect(() => {
    if (!open) flush()
  }, [open, flush])
  // Reloading or closing the tab within the debounce window must not lose the text either: hand
  // the draft to the store, then make the store write it now.
  useEffect(() => {
    const persist = () => {
      commit()
      actions.flush()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [actions, commit])
  useEffect(
    () => () => {
      commit()
      window.clearTimeout(savedTimer.current)
    },
    [commit],
  )

  return {
    value: (field: NoteField): string => draft[field] ?? stored[field],
    isSaved: (field: NoteField): boolean => saved.includes(field),
    edit,
    flush,
  }
}
