import { ChevronRight, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { TOPIC_BY_ID } from '../data'
import type { ProblemView } from '../domain/types'
import { Cairn, CAIRN_STONES } from './Cairn'
import { Chip } from './Chip'
import { cx } from './cx'
import { useBlindSlugs } from './blind'
import { GradeMark } from './GradeMark'
import { statusLabel } from './status'
import s from './ProblemRow.module.css'

interface ProblemRowProps {
  view: ProblemView
  onOpen: (slug: string) => void
  /** Show the topic in the meta line. Off inside a single topic. */
  showTopic?: boolean
  /** Replaces the status chip on the right. */
  trailing?: ReactNode
  /** Extra text in the meta line, after the grade: a reason, an estimate. */
  note?: ReactNode
  /** A further line under the meta line, inside the row: a search snippet, a remark. */
  detail?: ReactNode
  /** The keyboard cursor is on this row. */
  active?: boolean
  /** Dim it: done for today, or filtered out of focus. */
  done?: boolean
  /**
   * Hide the topic and anything else that would give the approach away (mock interviews).
   * Defaults to true for the problems of a mock that is running, so rows are blind without asking.
   */
  blind?: boolean
  className?: string
}

/**
 * The one way a problem appears in a list: its cairn, title, a line of facts, and its status.
 * The whole row is a button. Used by Today, the map's topic panel, the problem list and mocks,
 * so a problem looks the same wherever you meet it.
 */
export function ProblemRow({ view, onOpen, showTopic = true, trailing, note, detail, active, done, blind, className }: ProblemRowProps) {
  const { problem } = view
  const status = statusLabel(view)
  const blindSlugs = useBlindSlugs()
  const hidden = blind ?? blindSlugs.has(problem.slug)
  // The cairn is decoration so the row's name starts with the title. When the default chip already states the
  // status, nothing more is needed; otherwise the cairn's words follow the title for screen readers.
  const chipStates = trailing === undefined && !!status
  const cairnText = !view.solved ? 'Not attempted' : view.status === 'mastered' ? 'Mastered' : `${Math.round(view.srs?.step ?? 0)} of ${CAIRN_STONES} revisions cleared`
  return (
    <button
      type="button"
      className={cx(s.row, active && s.active, done && s.done, className)}
      data-active={active || undefined}
      data-slug={problem.slug}
      onClick={() => onOpen(problem.slug)}
    >
      <span className={s.glyph}>
        {view.solved ? (
          <Cairn step={view.srs?.step ?? 0} mastered={view.status === 'mastered'} tone={view.status === 'due' ? 'ember' : 'ink'} size={22} decorative />
        ) : (
          <span className={s.todo} aria-hidden="true" />
        )}
      </span>
      <span className={s.text}>
        <span className={s.title}>
          <span className={s.name} title={problem.title}>
            {problem.title}
          </span>
          {problem.premium ? (
            <span className={s.premium} title="Needs LeetCode Premium">
              <Lock aria-label="Needs LeetCode Premium" />
            </span>
          ) : null}
        </span>
        <span className={s.meta}>
          <span className="num">#{problem.number}</span>
          {showTopic && !hidden ? <span className={s.topic}>{TOPIC_BY_ID[problem.topic].short}</span> : null}
          <GradeMark difficulty={problem.difficulty} label />
          {note ? <span className={s.note}>{note}</span> : null}
        </span>
        {chipStates ? null : <span className="sr-only">{cairnText}</span>}
        {detail && !hidden ? <span className={s.detail}>{detail}</span> : null}
      </span>
      <span className={s.trailing}>
        {trailing !== undefined ? (
          trailing
        ) : status ? (
          <Chip tone={status.tone} variant={status.variant}>
            {status.text}
          </Chip>
        ) : null}
        <ChevronRight className={s.chevron} aria-hidden="true" />
      </span>
    </button>
  )
}
