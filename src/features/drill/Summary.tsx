import { ArrowUpRight, Check } from 'lucide-react'
import { PATTERN_BY_ID } from '../../data'
import { Button, Frame, GradeMark, PageHeader, Ring } from '../../ui'
import { bestStreak, patternName, patternsToWatch, percent, seconds, type Run } from './run'
import s from './Summary.module.css'

/** Past a handful the list stops pointing anywhere. */
const WATCH_LIMIT = 5

interface SummaryProps {
  run: Run
  onAgain: () => void
  onToday: () => void
  onSetup: () => void
  onOpen: (slug: string) => void
}

export function Summary({ run, onAgain, onToday, onSetup, onOpen }: SummaryProps) {
  const { answers } = run
  const asked = answers.length
  const right = answers.filter((a) => a.correct).length
  const misses = answers.filter((a) => !a.correct)
  const accuracy = asked ? right / asked : 0
  const average = asked ? answers.reduce((sum, a) => sum + a.ms, 0) / asked : 0
  const missedPatterns = patternsToWatch(answers)
  const watch = missedPatterns.slice(0, WATCH_LIMIT)
  const perfect = asked > 0 && misses.length === 0
  const early = asked < run.total

  const lead = missedPatterns[0]
  const title = perfect ? (
    <>
      A clean run: <em>{right} for {asked}</em>.
    </>
  ) : lead && lead.missed >= 2 ? (
    <>
      <em>{patternName(lead.id)}</em> cost you {lead.missed} of {misses.length} misses.
    </>
  ) : misses.length === 1 ? (
    <>
      One miss: <em>{patternName(misses[0].problem.pattern)}</em>.
    </>
  ) : (
    <>
      {misses.length} misses, spread across <em>{missedPatterns.length} patterns</em>.
    </>
  )

  return (
    <>
      <PageHeader
        sheet="04"
        name="Drill"
        terrain={4}
        meta={early ? `Ended after ${asked} of ${run.total}` : `${asked} cards`}
        title={title}
        actions={
          <>
            <Button variant="primary" size="lg" kbd="Enter" data-autofocus="" onClick={onAgain}>
              Drill again
            </Button>
            <Button size="lg" onClick={onToday}>
              Back to Today
            </Button>
            <Button variant="ghost" size="lg" onClick={onSetup}>
              Change deck
            </Button>
          </>
        }
      />

      <div className={s.body}>
        <section className={s.score} aria-label="Score">
          <div className={s.figure}>
            <span className="eyebrow">Score</span>
            <p className={s.numeral}>
              <span className="stat">{right}</span>
              <span className={`stat ${s.slash}`}> / {asked}</span>
            </p>
          </div>
          <div className={s.metrics}>
            <div className={s.metric}>
              <span className="eyebrow">Accuracy</span>
              <Ring value={accuracy} size={72} stroke={4} tone={perfect ? 'glow' : 'ember'} label={`${percent(accuracy)}% correct`}>
                <span className="num">{percent(accuracy)}%</span>
              </Ring>
            </div>
            <div className={s.metric}>
              <span className="eyebrow">Per card</span>
              <p className={`num ${s.value}`}>{seconds(average)}</p>
            </div>
            <div className={s.metric}>
              <span className="eyebrow">Best streak</span>
              <p className={`num ${s.value}`}>{bestStreak(answers)}</p>
            </div>
          </div>
        </section>

        <div className={s.detail}>
          <section aria-labelledby="drill-misses">
            <header className={s.head}>
              <h2 className="eyebrow" id="drill-misses">
                Missed
              </h2>
              <span className="eyebrow num">{misses.length}</span>
            </header>
            {misses.length === 0 ? (
              <p className={s.clean}>
                <Check aria-hidden="true" />
                <span>Every card named correctly. The next run will lean toward your least-tested patterns.</span>
              </p>
            ) : (
              <ul className={s.misses}>
                {misses.map((miss) => (
                  <li key={miss.problem.slug} className={s.miss}>
                    <div className={s.missHead}>
                      <h3 className={`title title-sm ${s.missTitle}`}>{miss.problem.title}</h3>
                      <GradeMark difficulty={miss.problem.difficulty} />
                      <Button variant="ghost" size="sm" icon={<ArrowUpRight />} onClick={() => onOpen(miss.problem.slug)}>
                        Open problem
                      </Button>
                    </div>
                    <p className={s.versus}>
                      You picked <span className={s.picked}>{patternName(miss.picked)}</span>. The answer is{' '}
                      <span className={s.answer}>{patternName(miss.problem.pattern)}</span>.
                    </p>
                    <p className={s.clue}>{miss.problem.clue}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {watch.length > 0 ? (
            <Frame label="Patterns to watch" aside={<span className="num">{watch.length}</span>} className={s.watch}>
              <ul className={s.watchList}>
                {watch.map((w) => (
                  <li key={w.id} className={s.watchRow}>
                    <div className={s.watchName}>
                      <span className={`place ${s.pname}`}>{patternName(w.id)}</span>
                      <span className={`num ${s.tally}`}>
                        {w.missed} missed of {w.asked}
                      </span>
                    </div>
                    <p className={s.hint}>{PATTERN_BY_ID[w.id].hint}</p>
                  </li>
                ))}
              </ul>
            </Frame>
          ) : null}
        </div>
      </div>
    </>
  )
}
