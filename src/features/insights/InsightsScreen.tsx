import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ROUTES, useProblemSheet } from '../../app/nav'
import { WEAK_BELOW } from '../../domain/strength'
import { useReducedMotion } from 'framer-motion'
import type { TopicView } from '../../domain/types'
import { useDerived } from '../../state/hooks'
import { Button, PageHeader } from '../../ui'
import ActivitySection from './ActivitySection'
import BlankState from './BlankState'
import DifficultySection from './DifficultySection'
import { sectionAnchor } from './InsightsSection'
import MistakesSection from './MistakesSection'
import NextSection from './NextSection'
import PlanSection from './PlanSection'
import RevisionSection from './RevisionSection'
import StrengthSection from './StrengthSection'
import { rankTopics } from './strengthMeta'
import './heat.css'
import s from './InsightsScreen.module.css'

/** Sheet 06: where you stand and what is weak. */
export default function InsightsScreen() {
  const derived = useDerived()
  const sheet = useProblemSheet()
  const navigate = useNavigate()
  const { counts, suggestion } = derived

  // Only topics with enough attempts are ranked. Uncharted and too-early topics are never named.
  const ranked = rankTopics(derived.topicList)
  const blank = counts.solved === 0 && derived.drill.total === 0 && derived.mistakes.total === 0
  const measurable = ranked.length >= 2
  const weakest = ranked[0]
  const strongest = ranked[ranked.length - 1]
  const below = ranked.filter((t) => (t.strength as number) < WEAK_BELOW).length
  const level = measurable && weakest.strength === strongest.strength

  const nameOf = (t: TopicView) => (t.topic.name.length > 16 ? t.topic.short : t.topic.name)
  const title = measurable ? (
    level ? (
      <>
        Every ranked topic sits at <em>{weakest.strength}</em>.
      </>
    ) : (
      <>
        Strongest on <em>{nameOf(strongest)}</em>.{' '}
        {(weakest.strength as number) < WEAK_BELOW ? (
          <>
            <em>{nameOf(weakest)}</em> needs the work.
          </>
        ) : (
          <>
            <em>{nameOf(weakest)}</em> trails.
          </>
        )}
      </>
    )
  ) : (
    <>
      Not enough climbing to <em>measure</em> yet.
    </>
  )

  const lede = measurable ? (
    <>
      {ranked.length} of {derived.topicList.length} topics have enough attempts to rank.{' '}
      {below === 0 ? `None sits below the weak line at ${WEAK_BELOW}.` : `${below} ${below === 1 ? 'sits' : 'sit'} below the weak line at ${WEAK_BELOW}.`}
    </>
  ) : blank ? (
    'Strength, mistakes, pace and revisions appear here once you have solved a few problems. Each section below says what it will hold.'
  ) : (
    'Strength compares topics, so it needs two of them with a few attempts each. Keep climbing and the range fills in.'
  )

  const start = suggestion.problem
  const actions = blank ? (
    <Button
      variant="primary"
      icon={<ArrowRight />}
      onClick={() => (start ? sheet.open(start.slug) : navigate(ROUTES.map))}
    >
      {start ? `Start with ${start.title}` : 'Open the map'}
    </Button>
  ) : undefined

  return (
    <div className="page">
      <PageHeader
        sheet="06"
        name="Insights"
        terrain={6}
        meta={`${counts.solved} solved · ${counts.mastered} mastered`}
        title={title}
        lede={lede}
        actions={actions}
      />
      {blank ? (
        <BlankState derived={derived} />
      ) : (
        <>
          <IndexNav />
          <NextSection derived={derived} />
          <StrengthSection topics={derived.topics} />
          <PlanSection />
          <ActivitySection />
          <RevisionSection />
          <MistakesSection mistakes={derived.mistakes} />
          <DifficultySection difficulty={derived.difficulty} counts={counts} />
        </>
      )}
    </div>
  )
}

const INDEX: readonly { id: string; label: string }[] = [
  { id: 'next', label: 'Route' },
  { id: 'strength', label: 'Strength' },
  { id: 'plan', label: 'Plan' },
  { id: 'activity', label: 'Activity' },
  { id: 'revisions', label: 'Revisions' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'difficulty', label: 'Grades' },
]

/** Jump links to each section. Buttons, not anchors, because a bare #fragment would change the hash route. */
function IndexNav() {
  const calm = useReducedMotion()
  return (
    <nav className={s.index} aria-label="On this sheet">
      <span className={`eyebrow ${s.indexLabel}`}>Jump to</span>
      <ul className={s.indexList}>
        {INDEX.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={s.indexLink}
              onClick={() => document.getElementById(sectionAnchor(item.id))?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
