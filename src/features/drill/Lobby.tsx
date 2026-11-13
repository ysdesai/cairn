import { Crosshair, Play } from 'lucide-react'
import { useMemo, type KeyboardEvent } from 'react'
import { PATTERNS } from '../../data'
import { DRILL_DECK_SIZES } from '../../domain/drill'
import { useDerived } from '../../state/hooks'
import { Button, Empty, Frame, LAYER, Meter, PageHeader, Ring, Segmented, useHotkeys } from '../../ui'
import { Choice, type ChoiceOption } from './Choice'
import { Ledger } from './Ledger'
import { buildPool, mockHeld, percent, WEAK_NEEDS, type DrillConfig, type Source } from './run'
import s from './Lobby.module.css'

interface LobbyProps {
  config: DrillConfig
  onConfig: (config: DrillConfig) => void
  onStart: (config: DrillConfig) => void
}

export function Lobby({ config, onConfig, onStart }: LobbyProps) {
  const derived = useDerived()
  const { drill } = derived

  const pools = useMemo(
    () => ({
      all: buildPool('all', derived).length,
      solved: buildPool('solved', derived).length,
      weak: buildPool('weak', derived).length,
    }),
    [derived],
  )

  const weakLocked = drill.weakest.length === 0
  const solvedLocked = pools.solved === 0
  // A source that has become unavailable (after a reset, say) quietly falls back to everything.
  const source: Source = (config.source === 'weak' && weakLocked) || (config.source === 'solved' && solvedLocked) ? 'all' : config.source

  const sourceOptions: ChoiceOption<Source>[] = [
    { value: 'all', label: 'All problems' },
    { value: 'solved', label: 'Solved only', locked: solvedLocked ? 'Log a solve first and it opens here.' : undefined },
    { value: 'weak', label: 'Weak patterns', locked: weakLocked ? `Opens once a pattern has ${WEAK_NEEDS} answers.` : undefined },
  ]
  const held = mockHeld(derived).size

  const poolSize = pools[source]
  const length = Math.min(config.size, poolSize)
  const untested = drill.byPattern.filter((p) => p.seen === 0).length
  const tested = PATTERNS.length - untested
  const accuracy = percent(drill.accuracy)

  const weakest = drill.weakest[0]
  const title = weakest ? (
    <>
      <em>{weakest.pattern.name}</em> is the one that keeps slipping.
    </>
  ) : drill.total > 0 && untested > 0 ? (
    <>
      {drill.total} answered. <em>{untested} patterns</em> still untested.
    </>
  ) : (
    <>
      Name the <em>pattern</em> before you write a line.
    </>
  )

  const start = () => {
    if (poolSize > 0) onStart({ size: config.size, source })
  }

  // With nothing focused, Enter or Space starts the run.
  useHotkeys({ Enter: start, space: start }, { layer: LAYER.page })

  // The shell leaves Enter and Space to a focused control. A radio does nothing with Enter, and
  // Space only re-selects it, so on a chosen deck size or source both start the run instead.
  const onSetupKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat) return
    if (!(event.target instanceof Element) || !event.target.matches('[role="radio"]')) return
    event.preventDefault()
    start()
  }

  return (
    <>
      <PageHeader
        sheet="04"
        name="Drill"
        terrain={4}
        meta={drill.total > 0 ? `${drill.total} answered · ${accuracy}%` : 'No cards yet'}
        title={title}
        lede="Each card shows a problem and four patterns. Pick one, then read the clue that gives it away. The next cards lean toward the patterns you miss."
      />

      <section className={s.setup} aria-label="Set up a run" onKeyDown={onSetupKeyDown}>
        <div className={s.group}>
          <span className="eyebrow">Cards</span>
          <Segmented
            label="Deck size"
            value={config.size}
            onChange={(size) => onConfig({ ...config, size })}
            options={DRILL_DECK_SIZES.map((n) => ({ value: n, label: <span className="num">{n}</span> }))}
          />
        </div>
        <div className={s.group}>
          <span className="eyebrow">Drawn from</span>
          <Choice
            label="Source of cards"
            value={source}
            onChange={(next) => onConfig({ ...config, source: next })}
            options={sourceOptions}
          />
        </div>
        <div className={s.start}>
          <Button variant="primary" size="lg" icon={<Play />} kbd="Enter" onClick={start} disabled={poolSize === 0}>
            Start
          </Button>
        </div>
        <p className={s.note} aria-live="polite">
          {poolSize === 0 ? (
            'There are no cards in this pool yet.'
          ) : (
            <>
              <span className="num">{length}</span> cards from <span className="num">{poolSize}</span>{' '}
              {source === 'solved' ? 'solved problems' : 'problems'}
              {source === 'weak' ? ` across ${drill.weakest.length} ${drill.weakest.length === 1 ? 'pattern' : 'patterns'}` : ''}.
              {length < config.size ? ' The run is shorter than the deck because the pool is small.' : ''}
            </>
          )}
          {held > 0 ? (
            <span className={s.locked}>
              {' '}
              {held === 1 ? 'The problem' : `The ${held} problems`} in your running mock {held === 1 ? 'stays' : 'stay'} out until it ends.
            </span>
          ) : null}
          {solvedLocked || weakLocked ? (
            <span className={s.locked}>
              {solvedLocked ? ' Solved only opens after your first solve.' : ''}
              {weakLocked ? ` Weak patterns opens once a pattern has ${WEAK_NEEDS} answers.` : ''}
            </span>
          ) : null}
        </p>
      </section>

      {drill.total === 0 ? (
        <section className={s.first} aria-label="Pattern accuracy">
          <Frame pad="none" label="By pattern">
            <Empty
              compact
              seed={4}
              icon={<Crosshair size={22} strokeWidth={1.5} />}
              title="Nothing answered yet."
              body="Your accuracy appears here for each pattern, weakest first, with the pattern you tend to mistake it for."
              action={
                <Button icon={<Play />} onClick={() => onStart({ size: 10, source: 'all' })}>
                  Try ten cards
                </Button>
              }
            />
          </Frame>
          <div className={s.gazetteer}>
            <p className="eyebrow">
              <span className="num">{PATTERNS.length}</span> patterns on this sheet
            </p>
            <ul className={s.names}>
              {PATTERNS.map((p) => (
                <li key={p.id} className="place">
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <div className={s.standing}>
          <aside className={s.figures} aria-label="Totals">
            <div className={s.figure}>
              <span className="eyebrow">Accuracy</span>
              <div className={s.accuracy}>
                <Ring value={drill.accuracy ?? 0} size={84} stroke={4} tone="ink" label={`${accuracy}% correct`}>
                  <span className={s.ringValue}>
                    <span className="stat">{accuracy}</span>
                    <span className="num muted">%</span>
                  </span>
                </Ring>
                <p className="muted">
                  <span className="num">{drill.correct}</span> of <span className="num">{drill.total}</span> right
                </p>
              </div>
            </div>
            <div className={s.figure}>
              <span className="eyebrow">Answered</span>
              <p className={s.big}>
                <span className="stat">{drill.total}</span>
              </p>
            </div>
            <div className={s.figure}>
              <span className="eyebrow">Today</span>
              <p className={s.big}>
                <span className="stat">{drill.today}</span>
              </p>
            </div>
            <div className={s.figure}>
              <span className="eyebrow">Patterns tested</span>
              <p className={s.coverage}>
                <span className="num">{tested}</span>
                <span className="num muted"> / {PATTERNS.length}</span>
              </p>
              <Meter value={tested / PATTERNS.length} height={3} label={`${tested} of ${PATTERNS.length} patterns tested`} />
            </div>
          </aside>
          <Ledger stats={drill} />
        </div>
      )}
    </>
  )
}
