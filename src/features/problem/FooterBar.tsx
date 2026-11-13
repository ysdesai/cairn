import { formatClock } from '../../domain/dates'
import { useSettings, useTimer } from '../../state/hooks'
import type { Difficulty } from '../../data/types'
import { Button, cx, SheetFooter } from '../../ui'
import type { LeadAction } from './actionTypes'
import s from './FooterBar.module.css'

function Clock({ slug, difficulty }: { slug: string; difficulty: Difficulty }) {
  const { timer, elapsedMs } = useTimer()
  const targetMs = useSettings().targets[difficulty] * 60_000
  if (timer?.slug !== slug) return null
  return (
    <span className={cx('num', s.clock, elapsedMs > targetMs && s.over)} role="timer" aria-label={`Elapsed ${formatClock(elapsedMs)}`}>
      {formatClock(elapsedMs)}
    </span>
  )
}

interface FooterBarProps {
  action: LeadAction
  slug: string
  difficulty: Difficulty
  /** The timer has been started here: keep its digits next to the button. */
  timed: boolean
}

/** Phones only: the current primary action, always within thumb reach. */
export function FooterBar({ action, slug, difficulty, timed }: FooterBarProps) {
  return (
    <SheetFooter className={s.footer}>
      {timed ? <Clock slug={slug} difficulty={difficulty} /> : null}
      <Button className={s.action} variant={action.variant} size="lg" icon={action.icon} onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </Button>
    </SheetFooter>
  )
}
