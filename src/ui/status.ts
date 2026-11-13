/** How a problem's state is worded and coloured, everywhere it appears. */
import type { ProblemView } from '../domain/types'
import type { Rating } from '../state/schema'
import type { Tone } from './Chip'

export interface StatusLabel {
  text: string
  tone: Tone
  variant: 'outline' | 'soft'
}

/**
 * The short status for a chip. Deliberately never alarming: something past its date is
 * "waiting", not "overdue", because the daily cap makes waiting normal.
 */
export function statusLabel(view: ProblemView): StatusLabel | null {
  switch (view.status) {
    case 'todo':
      return null
    case 'mastered':
      return { text: 'Mastered', tone: 'gold', variant: 'soft' }
    case 'due': {
      const late = -(view.dueIn ?? 0)
      return late <= 0
        ? { text: 'Revise today', tone: 'ember', variant: 'soft' }
        : { text: `Waiting ${late}d`, tone: 'lake', variant: 'soft' }
    }
    case 'learning': {
      const days = view.dueIn ?? 0
      return { text: days === 1 ? 'Back tomorrow' : `Back in ${days}d`, tone: 'neutral', variant: 'outline' }
    }
  }
}

export const RATING_TONE: Record<Rating, Tone> = { easy: 'moss', struggled: 'gold', help: 'dusk' }
