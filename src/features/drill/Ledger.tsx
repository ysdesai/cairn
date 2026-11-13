import { motion } from 'framer-motion'
import type { DrillStats, PatternStat } from '../../domain/types'
import { listContainer, listItem, Meter } from '../../ui'
import { patternName, percent } from './run'
import s from './Ledger.module.css'

/** Rows that stagger in on first mount; the rest simply appear. */
const STAGGERED = 12

/**
 * Bars are ink. Below this a bar is heavier and carries a dusk tick at the line, and the single
 * weakest pattern, the one the next run leans on most, is the only ember in the ledger.
 */
const STRONG = 0.8

function Confusions({ stat }: { stat: PatternStat }) {
  if (stat.confusedWith.length === 0) {
    return <span className={s.clean}>No misses so far</span>
  }
  return (
    <span className={s.confused}>
      <span className={s.lead}>mistaken for </span>
      {stat.confusedWith.map((c, i) => (
        <span key={c.pattern} className={i === 0 ? s.top : s.rest}>
          {i > 0 ? ', ' : ''}
          {patternName(c.pattern)} <span className="num">×{c.count}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * Accuracy for every pattern on one shared 0 to 100 scale, weakest first, then the patterns
 * that have not come up yet with empty hatched tracks.
 */
export function Ledger({ stats }: { stats: DrillStats }) {
  const order = new Map(stats.byPattern.map((p, i) => [p.pattern.id, i]))
  const tested = stats.byPattern
    .filter((p) => p.seen > 0)
    .sort(
      (a, b) =>
        (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.seen - a.seen || order.get(a.pattern.id)! - order.get(b.pattern.id)!,
    )
  const untested = stats.byPattern.filter((p) => p.seen === 0)
  const weakestId = stats.weakest[0]?.pattern.id

  return (
    <section className={s.ledger} aria-label="Accuracy by pattern">
      <header className={s.head}>
        <h2 className="eyebrow">By pattern, weakest first</h2>
        <span className="eyebrow">
          <span className={s.legend}>
            Heavier bar under <span className="num">{STRONG * 100}%</span> · Ember: weakest ·{' '}
          </span>
          <span className="num">{tested.length}</span> of{' '}
          <span className="num">{stats.byPattern.length}</span> tested
        </span>
      </header>

      <div className={s.cols} aria-hidden="true">
        <span className="eyebrow">Pattern</span>
        <span className={s.scale}>
          <span className="num">0</span>
          <span className="num">50</span>
          <span className="num">100%</span>
        </span>
        <span className={`eyebrow ${s.right}`}>Right</span>
        <span className="eyebrow">Confused with</span>
      </div>

      <motion.ul className={s.list} variants={listContainer} initial="initial" animate="enter">
        {tested.map((stat, i) => {
          const pct = percent(stat.accuracy)
          const low = (stat.accuracy ?? 0) < STRONG
          const weakest = stat.pattern.id === weakestId
          const content = (
            <>
              <span className={`place ${s.name}`}>{stat.pattern.name}</span>
              <span className={s.bar}>
                <Meter
                  value={stat.accuracy}
                  tone={weakest ? 'ember' : 'ink'}
                  marker={low ? STRONG : undefined}
                  height={low ? 6 : 4}
                  className={low ? s.low : undefined}
                  label={`${stat.pattern.name}: ${pct}% right${low ? ', under 80%' : ''}${weakest ? ', the weakest' : ''}`}
                />
              </span>
              <span className={`num ${s.score}`}>
                {stat.correct} / {stat.seen}
              </span>
              <Confusions stat={stat} />
            </>
          )
          return i < STAGGERED ? (
            <motion.li key={stat.pattern.id} className={s.row} variants={listItem}>
              {content}
            </motion.li>
          ) : (
            <li key={stat.pattern.id} className={s.row}>
              {content}
            </li>
          )
        })}
      </motion.ul>

      {untested.length > 0 ? (
        <>
          <header className={`${s.head} ${s.untestedHead}`}>
            <h2 className="eyebrow">Not tested yet</h2>
            <span className="eyebrow num">{untested.length}</span>
          </header>
          <ul className={s.untested}>
            {untested.map((stat) => (
              <li key={stat.pattern.id} className={s.quiet}>
                <span className={`place ${s.name}`}>{stat.pattern.name}</span>
                <span className={s.bar}>
                  <Meter value={null} height={4} label={`${stat.pattern.name}: not tested yet`} />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}
