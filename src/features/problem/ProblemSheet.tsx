import { useCallback, useRef, useState } from 'react'
import { useProblemSheet, type SheetMode } from '../../app/nav'
import { useProblemView } from '../../state/hooks'
import { Sheet } from '../../ui'
import { Content, type LeaveGuard } from './Content'
import { RECALL_FIELD } from './Recall'

/**
 * The problem sheet, mounted once by the shell. It follows `?p=<slug>` in the address and keeps
 * showing the last problem while it slides away, so closing never flashes an empty panel.
 */
export default function ProblemSheet() {
  const sheet = useProblemSheet()
  const [shown, setShown] = useState<{ slug: string | null; mode: SheetMode }>({ slug: sheet.slug, mode: sheet.mode })
  if (sheet.slug && (sheet.slug !== shown.slug || sheet.mode !== shown.mode)) setShown({ slug: sheet.slug, mode: sheet.mode })

  const view = useProblemView(shown.slug)
  const guard = useRef<LeaveGuard | null>(null)
  const registerGuard = useCallback((next: LeaveGuard | null) => {
    guard.current = next
  }, [])

  const { close } = sheet
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      // Escape, the scrim and the close button all land here; unsaved recall gets a say first.
      void (guard.current?.() ?? Promise.resolve(true)).then((ok) => {
        if (ok) close()
      })
    },
    [close],
  )

  return (
    <Sheet
      open={sheet.slug !== null}
      onOpenChange={onOpenChange}
      title={view?.problem.title ?? 'Problem'}
      width={680}
      onOpenAutoFocus={(event) => {
        // Land on the recall prompt when there is one, otherwise on the sheet itself so Tab starts at the top.
        event.preventDefault()
        const target = document.getElementById(RECALL_FIELD) ?? (event.target as HTMLElement | null)
        target?.focus()
      }}
    >
      {view ? (
        <Content key={`${view.problem.slug}:${shown.mode}`} view={view} mode={shown.mode} open={sheet.slug !== null} sheet={sheet} registerGuard={registerGuard} />
      ) : null}
    </Sheet>
  )
}
