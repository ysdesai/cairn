import type { ReactNode } from 'react'

/** One button's worth of intent: what it says, how it looks, and what it does. */
export interface LeadAction {
  label: string
  icon?: ReactNode
  /** Shortcut hint shown on the button. */
  kbd?: string
  variant: 'primary' | 'secondary'
  onClick: () => void
  disabled?: boolean
}
