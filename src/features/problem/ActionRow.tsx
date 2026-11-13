import { ArrowUpRight, CirclePlay, MessageCircle } from 'lucide-react'
import { coachUrl } from '../../domain/coach'
import type { Problem } from '../../data/types'
import { Button, ButtonLink, Tip } from '../../ui'
import type { LeadAction } from './actionTypes'
import s from './ActionRow.module.css'

interface ActionRowProps {
  problem: Problem
  /** The next thing to do. Absent while a revision is under way. */
  lead: LeadAction | null
  /** A mock is running: no hints and no solution one click away. Only the problem itself. */
  mock?: boolean
}

/** The lead action, then the three ways out of the app. Phones show the lead in the footer instead. */
export function ActionRow({ problem, lead, mock }: ActionRowProps) {
  return (
    <div className={s.row}>
      {lead ? (
        <Button className={s.lead} variant={lead.variant} size="lg" icon={lead.icon} kbd={lead.kbd} onClick={lead.onClick} disabled={lead.disabled}>
          {lead.label}
        </Button>
      ) : null}
      <div className={s.links}>
        <ButtonLink href={problem.url} external icon={<ArrowUpRight />} kbd="o">
          LeetCode
        </ButtonLink>
        {mock ? null : (
          <Tip content="Opens a Claude chat that coaches with hints only">
            <ButtonLink href={coachUrl(problem)} external icon={<MessageCircle />} kbd="c">
              Coach
            </ButtonLink>
          </Tip>
        )}
        {problem.videoUrl && !mock ? (
          <Tip content="NeetCode's video. Log it as Needed help if you watch before solving">
            <ButtonLink href={problem.videoUrl} external icon={<CirclePlay />} kbd="w">
              Walkthrough
            </ButtonLink>
          </Tip>
        ) : null}
      </div>
    </div>
  )
}
