import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ROUTES, useProblemSheet } from '../../app/nav'
import { TOPIC_BY_ID } from '../../data'
import type { Derived, SuggestionKind } from '../../domain/types'
import { Button, Cairn, Frame, GradeMark } from '../../ui'
import InsightsSection from './InsightsSection'
import s from './NextSection.module.css'

const KIND_LABEL: Record<SuggestionKind, string> = {
  start: 'Base camp',
  revise: 'Revision',
  'shore-up': 'Shore up',
  advance: 'Next waypoint',
  drill: 'Drill',
  summit: 'Summit',
}

/** The one clearest next move, with its reasoning and the button that takes it. */
export default function NextSection({ derived }: { derived: Derived }) {
  const { suggestion } = derived
  const sheet = useProblemSheet()
  const navigate = useNavigate()
  const { problem, topic } = suggestion
  const view = problem ? derived.problems[problem.slug] : null
  const topicView = topic ? derived.topics[topic] : null

  const act = problem
    ? { label: `Open ${problem.title}`, run: () => sheet.open(problem.slug, suggestion.kind === 'revise' ? { mode: 'revise' } : undefined) }
    : topic
      ? { label: `Open ${TOPIC_BY_ID[topic].name}`, run: () => navigate(ROUTES.topic(topic)) }
      : suggestion.kind === 'drill'
        ? { label: 'Start a drill', run: () => navigate(ROUTES.drill) }
        : null

  return (
    <InsightsSection id="next" eyebrow="Route" title="Work on this next" lede={suggestion.headline}>
      <div className={s.layout}>
        <div className={s.main}>
          <p className={s.detail}>{suggestion.detail}</p>
          {act ? (
            <div className={s.action}>
              <Button variant="primary" size="lg" icon={<ArrowRight />} onClick={act.run}>
                {act.label}
              </Button>
            </div>
          ) : null}
        </div>

        <Frame label={KIND_LABEL[suggestion.kind]} className={s.waypoint} pad="md">
          {problem && view ? (
            <div className={s.stack}>
              <Cairn step={view.srs?.step ?? 0} mastered={view.status === 'mastered'} size={44} tone="ember" />
              <div className={s.facts}>
                <span className="place">{problem.title}</span>
                <span className={s.meta}>
                  <span className="num">#{problem.number}</span>
                  <GradeMark difficulty={problem.difficulty} label />
                </span>
                <span className={s.meta}>{TOPIC_BY_ID[problem.topic].name}</span>
              </div>
            </div>
          ) : topicView ? (
            <div className={s.facts}>
              <span className="place">{topicView.topic.name}</span>
              <span className={s.meta}>
                <span className="num">{topicView.solved}</span> of <span className="num">{topicView.total}</span> solved
                {topicView.strength !== null ? (
                  <>
                    {' · strength '}
                    <span className="num">{topicView.strength}</span>
                  </>
                ) : null}
              </span>
            </div>
          ) : (
            <div className={s.facts}>
              <span className="place">{suggestion.kind === 'summit' ? 'All routes climbed' : 'Whole route'}</span>
              <span className={s.meta}>
                <span className="num">{derived.counts.mastered}</span> of <span className="num">{derived.counts.total}</span> mastered
              </span>
            </div>
          )}
        </Frame>
      </div>
    </InsightsSection>
  )
}
