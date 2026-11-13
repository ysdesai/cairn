import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PROBLEMS, TOPIC_BY_ID } from '../../data'
import type { Problem } from '../../data/types'
import { Button, SheetHeader, Tip } from '../../ui'
import { ROUTES } from '../../app/nav'
import s from './Header.module.css'

interface HeaderProps {
  problem: Problem
  /** Hide the camp: it would name the pattern during a mock. */
  blind: boolean
  /** Runs `go` unless the person decides to stay (unsaved recall). */
  guarded: (go: () => void) => void
  onOpen: (slug: string) => void
}

/** The strip along the top: where this problem sits, and a step to either neighbor. */
export function Header({ problem, blind, guarded, onOpen }: HeaderProps) {
  const navigate = useNavigate()
  const topic = TOPIC_BY_ID[problem.topic]
  const previous = PROBLEMS[problem.order - 2]
  const next = PROBLEMS[problem.order]
  return (
    <SheetHeader
      actions={
        <>
          <span className={s.count}>
            <span className="sr-only">Problem </span>
            <span className="num">{problem.order}</span> of {PROBLEMS.length}
          </span>
          <Tip content="Previous problem" kbd="[">
            <Button
              className={s.step}
              variant="ghost"
              size="sm"
              iconOnly
              icon={<ChevronLeft />}
              aria-label="Previous problem"
              disabled={!previous}
              onClick={() => previous && guarded(() => onOpen(previous.slug))}
            />
          </Tip>
          <Tip content="Next problem" kbd="]">
            <Button
              className={s.step}
              variant="ghost"
              size="sm"
              iconOnly
              icon={<ChevronRight />}
              aria-label="Next problem"
              disabled={!next}
              onClick={() => next && guarded(() => onOpen(next.slug))}
            />
          </Tip>
        </>
      }
    >
      <p className={`eyebrow ${s.where}`}>
        {blind ? (
          <span>In the mock</span>
        ) : (
          <Link
            to={ROUTES.topic(problem.topic)}
            className={`truncate ${s.topic}`}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) return
              // The topic page has no ?p=, so navigating there is also what closes the sheet.
              event.preventDefault()
              guarded(() => navigate(ROUTES.topic(problem.topic)))
            }}
          >
            {topic.name}
          </Link>
        )}
      </p>
    </SheetHeader>
  )
}
