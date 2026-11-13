import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../app/nav'
import { ROADMAP_ORDER } from '../../data'
import { WEAK_BELOW } from '../../domain/strength'
import type { TopicView } from '../../domain/types'
import { Meter, listContainer, listItem } from '../../ui'
import InsightsSection from './InsightsSection'
import RangeChart from './RangeChart'
import { CONFIDENCE_LABEL, PARTS, capitalize, pct, rankTopics, topicState, weakestPart } from './strengthMeta'
import s from './StrengthSection.module.css'

const STAGGER_ROWS = 12

interface StrengthSectionProps {
  topics: Record<string, TopicView>
}

/** The range chart, then the same numbers as a list sorted weakest first. */
export default function StrengthSection({ topics }: StrengthSectionProps) {
  const views = ROADMAP_ORDER.map((id) => topics[id])
  const ranked = rankTopics(views)
  const early = views.filter((v) => topicState(v) === 'early')
  const uncharted = views.filter((v) => topicState(v) === 'uncharted')
  const measurable = ranked.length >= 2
  const weakest = ranked[0]
  const strongest = ranked[ranked.length - 1]

  const lede = measurable ? (
    <>
      Weakest is <em>{weakest.topic.name}</em> at <span className="num">{weakest.strength}</span>, strongest <em>{strongest.topic.name}</em> at{' '}
      <span className="num">{strongest.strength}</span>.{' '}
      {uncharted.length > 0 ? (
        <>
          <span className="num">{uncharted.length}</span> {uncharted.length === 1 ? 'topic is' : 'topics are'} still uncharted.{' '}
        </>
      ) : null}
      Strength blends how attempts were rated, solve times against target, how revisions hold up, and drill accuracy.
    </>
  ) : (
    <>
      Strength compares topics, so it needs two of them with a few attempts each. Until then every peak stays dotted, and nothing is
      named weakest or strongest.
    </>
  )

  return (
    <InsightsSection
      id="strength"
      eyebrow="Strength"
      aside={
        <>
          <span className="num">{ranked.length}</span> of <span className="num">{views.length}</span> ranked
        </>
      }
      title="Strength by topic"
      lede={lede}
    >
      <RangeChart
        views={views}
        caption={
          <p className={s.caption}>
            <span>Peak height is strength, 0 to 100.</span>
            <span>Dotted peaks are uncharted or too early to score.</span>
            <span>Ember marks the weakest.</span>
            <span>The dotted line at {WEAK_BELOW} is where a topic counts as weak.</span>
          </p>
        }
      />

      {ranked.length > 0 ? (
        <div className={s.table}>
          <div className={s.listHead} aria-hidden="true">
            <span className="eyebrow">Weakest first</span>
            <span className="eyebrow">Strength</span>
            <span className={s.partHeads}>
              {PARTS.map((p) => (
                <span key={p.key} className="eyebrow">
                  {p.label}
                </span>
              ))}
            </span>
          </div>
          <motion.ol className={s.list} variants={listContainer} initial="initial" animate="enter" aria-label="Topics ranked weakest first">
            {ranked.map((view, i) => {
              const lowest = weakestPart(view.parts)
              const strength = view.strength as number
              return (
                <motion.li key={view.topic.id} className={s.row} variants={i < STAGGER_ROWS ? listItem : undefined}>
                  <div className={s.who}>
                    <Link to={ROUTES.topic(view.topic.id)} className={`place ${s.name}`}>
                      {view.topic.name}
                    </Link>
                    <p className={s.phrase}>{view.weakness ? capitalize(view.weakness) : 'No ingredient under 60%.'}</p>
                  </div>
                  <div className={s.score}>
                    <span className={`num ${s.value}`}>
                      {strength}
                      <span className={s.of}>/100</span>
                    </span>
                    <Meter value={strength / 100} marker={WEAK_BELOW / 100} tone={i === 0 && measurable ? 'ember' : 'ink'} height={4} label={`${view.topic.name} strength ${strength} of 100`} />
                    <span className="eyebrow">{CONFIDENCE_LABEL[view.confidence]}</span>
                  </div>
                  <div className={s.parts}>
                    {PARTS.map(({ key, label }) => (
                      <div key={key} className={s.part}>
                        <span className={`eyebrow ${s.partLabel}`}>{label}</span>
                        <Meter value={view.parts[key]} tone={lowest === key ? 'ember' : 'ink'} height={3} label={`${label}: ${view.parts[key] === null ? 'no data' : pct(view.parts[key])}`} />
                        <span className={`num ${s.partValue}`}>{pct(view.parts[key])}</span>
                      </div>
                    ))}
                  </div>
                </motion.li>
              )
            })}
          </motion.ol>
        </div>
      ) : null}

      {early.length > 0 ? (
        <div className={s.group}>
          <h3 className={`eyebrow ${s.groupHead}`}>Too early to score</h3>
          <ul className={s.earlyList}>
            {early.map((view) => (
              <li key={view.topic.id} className={s.earlyRow}>
                <Link to={ROUTES.topic(view.topic.id)} className={`place ${s.name}`}>
                  {view.topic.name}
                </Link>
                <span className="eyebrow">{CONFIDENCE_LABEL[view.confidence]}</span>
                <span className={s.phrase}>A few attempts so far. The score waits for more.</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {uncharted.length > 0 ? (
        <div className={s.group}>
          <h3 className={`eyebrow ${s.groupHead}`}>
            Uncharted <span className="num">{uncharted.length}</span>
          </h3>
          <ul className={s.unchartedList}>
            {uncharted.map((v) => (
              <li key={v.topic.id}>
                <Link to={ROUTES.topic(v.topic.id)} className={`place ${s.unchartedLink}`}>
                  {v.topic.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className={s.phrase}>Nothing solved there yet, so these have no strength and are never ranked.</p>
        </div>
      ) : null}
    </InsightsSection>
  )
}
