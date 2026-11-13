import { useMemo } from 'react'
import { useDerived } from '../state/hooks'

const NONE: ReadonlySet<string> = new Set()

/**
 * The slugs of the problems in a mock that is running right now. A mock is blind: while the clock
 * runs, nothing outside the problem sheet may give away a problem's topic or tags.
 *
 * ProblemRow already reads this and hides the topic and detail line for these slugs. Lists,
 * topic panels and search should also leave them out of anything that filters or groups by
 * topic or tag, or match them on title only.
 */
export function useBlindSlugs(): ReadonlySet<string> {
  const mock = useDerived().activeMock
  return useMemo(() => (mock?.status === 'running' ? new Set(mock.slugs) : NONE), [mock])
}
