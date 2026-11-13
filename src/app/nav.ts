/** Where things live, and how to open a problem from anywhere. */
import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getProblem } from '../data'
import type { TopicId } from '../data/types'

export const ROUTES = {
  today: '/',
  map: '/map',
  topic: (id: TopicId) => `/map/${id}`,
  problems: '/problems',
  drill: '/drill',
  mock: '/mock',
  insights: '/insights',
  settings: '/settings',
} as const

export interface NavItem {
  to: string
  label: string
  /** The `g` sequence that goes there. */
  keys: string
}

/** The six destinations in the dock, in order. */
export const NAV: readonly NavItem[] = [
  { to: ROUTES.today, label: 'Today', keys: 'g t' },
  { to: ROUTES.map, label: 'Map', keys: 'g m' },
  { to: ROUTES.problems, label: 'Problems', keys: 'g p' },
  { to: ROUTES.drill, label: 'Drill', keys: 'g d' },
  { to: ROUTES.mock, label: 'Mock', keys: 'g k' },
  { to: ROUTES.insights, label: 'Insights', keys: 'g i' },
]

const PARAM = 'p'
const MODE = 'mode'

export type SheetMode = 'solve' | 'revise'

export interface ProblemSheetControl {
  /** The slug in the URL, if it names a real problem. */
  slug: string | null
  /** 'revise' opens straight into recall-before-reveal. */
  mode: SheetMode
  /** Open the problem sheet over whatever screen is showing. */
  open: (slug: string, options?: { mode?: SheetMode }) => void
  close: () => void
}

/**
 * The problem sheet is an overlay addressed by the `?p=<slug>` query parameter, so it can be
 * opened from any screen, deep-linked, and closed with the Back button.
 */
export function useProblemSheet(): ProblemSheetControl {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const raw = params.get(PARAM)
  const slug = raw && getProblem(raw) ? raw : null
  const mode: SheetMode = params.get(MODE) === 'revise' ? 'revise' : 'solve'
  const openedHere = (location.state as { sheet?: boolean } | null)?.sheet === true

  const open = useCallback(
    (next: string, options?: { mode?: SheetMode }) => {
      setParams(
        (current) => {
          const out = new URLSearchParams(current)
          out.set(PARAM, next)
          if (options?.mode === 'revise') out.set(MODE, 'revise')
          else out.delete(MODE)
          return out
        },
        // Moving between problems while the sheet is open should not pile up history. Only a push
        // creates an entry the sheet can go Back to; a replace keeps whatever the entry already was,
        // so a deep-linked sheet still closes by dropping its parameter, not by leaving the screen.
        { state: { sheet: slug === null ? true : openedHere }, replace: slug !== null },
      )
    },
    [setParams, slug, openedHere],
  )

  const close = useCallback(() => {
    if (openedHere) {
      navigate(-1)
      return
    }
    setParams(
      (current) => {
        const out = new URLSearchParams(current)
        out.delete(PARAM)
        out.delete(MODE)
        return out
      },
      { replace: true },
    )
  }, [navigate, openedHere, setParams])

  return useMemo(() => ({ slug, mode, open, close }), [slug, mode, open, close])
}
