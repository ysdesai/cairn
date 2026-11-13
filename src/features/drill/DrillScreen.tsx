import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES, useProblemSheet } from '../../app/nav'
import { drillOptions, nextDrillCard, DRILL_DECK_SIZES } from '../../domain/drill'
import { mulberry32 } from '../../domain/rng'
import { useActions, useDerived } from '../../state/hooks'
import { fade, LAYER, useHotkeys } from '../../ui'
import { Lobby } from './Lobby'
import { RunView } from './RunView'
import { Summary } from './Summary'
import {
  buildPool,
  MAX_START_SIZE,
  MIN_START_SIZE,
  type Card,
  type DrillConfig,
  type Run,
} from './run'
import s from './DrillScreen.module.css'
import type { PatternId, Problem } from '../../data/types'
import type { Rng } from '../../domain/rng'

type Phase = 'lobby' | 'run' | 'summary'

/** How many of the latest cards the sampler is told to avoid. */
const RECENT = 8

const DEFAULT_CONFIG: DrillConfig = { size: 20, source: 'all' }

export default function DrillScreen() {
  const derived = useDerived()
  const actions = useActions()
  const sheet = useProblemSheet()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [phase, setPhase] = useState<Phase>('lobby')
  const [config, setConfig] = useState<DrillConfig>(DEFAULT_CONFIG)
  const [run, setRun] = useState<Run | null>(null)
  // Kept across runs, so "Drill again" does not open on the card the last run ended with.
  const recent = useRef<string[]>([])

  const draw = useCallback(
    (pool: readonly Problem[], asked: readonly Problem[], rng: Rng): Card | null => {
      const taken = new Set(asked.map((p) => p.slug))
      const remaining = pool.filter((p) => !taken.has(p.slug))
      const problem = nextDrillCard({ stats: derived.drill, pool: remaining, recent: recent.current, rng })
      if (!problem) return null
      recent.current = [...recent.current, problem.slug].slice(-RECENT)
      return { problem, options: drillOptions(problem, rng), shownAt: performance.now() }
    },
    [derived.drill],
  )

  const begin = useCallback(
    (next: DrillConfig) => {
      const pool = buildPool(next.source, derived)
      const rng = mulberry32(Date.now())
      const card = draw(pool, [], rng)
      if (!card) return
      if (DRILL_DECK_SIZES.includes(next.size)) setConfig(next)
      setRun({ config: next, total: Math.min(next.size, pool.length), rng, pool, card, picked: null, answers: [] })
      setPhase('run')
    },
    [derived, draw],
  )

  // "?start=10" opens a run of that length straight away.
  const handledStart = useRef(false)
  useEffect(() => {
    const raw = params.get('start')
    if (raw === null || handledStart.current) return
    handledStart.current = true
    setParams(
      (current) => {
        const out = new URLSearchParams(current)
        out.delete('start')
        return out
      },
      { replace: true },
    )
    const size = Number.parseInt(raw, 10)
    if (size >= MIN_START_SIZE && size <= MAX_START_SIZE) begin({ size, source: 'all' })
  }, [params, setParams, begin])

  const pick = useCallback(
    (id: PatternId) => {
      if (!run || run.picked) return
      const { problem } = run.card
      const correct = id === problem.pattern
      const ms = Math.round(performance.now() - run.card.shownAt)
      actions.recordDrill({ slug: problem.slug, answer: problem.pattern, picked: id, correct, ms })
      setRun({ ...run, picked: id, answers: [...run.answers, { problem, picked: id, correct, ms }] })
    },
    [run, actions],
  )

  const finish = useCallback(() => setPhase('summary'), [])

  const next = useCallback(() => {
    if (!run || !run.picked) return
    if (run.answers.length >= run.total) return finish()
    const card = draw(
      run.pool,
      run.answers.map((a) => a.problem),
      run.rng,
    )
    if (!card) return finish()
    setRun({ ...run, card, picked: null })
  }, [run, draw, finish])

  const leave = useCallback(() => {
    if (run && run.answers.length > 0) setPhase('summary')
    else setPhase('lobby')
  }, [run])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [phase])

  // When the view swaps in place the focused control goes with it. Put focus on the new view's
  // start (the card's title, "Drill again", the headline) so Tab and screen readers carry on there.
  const root = useRef<HTMLDivElement>(null)
  const slug = run?.card.problem.slug
  const was = useRef({ phase, slug })
  useEffect(() => {
    if (was.current.phase === phase && was.current.slug === slug) return
    was.current = { phase, slug }
    const target =
      root.current?.querySelector<HTMLElement>('[data-autofocus]') ?? root.current?.querySelector<HTMLElement>('h1')
    if (!target) return
    // A heading is a landing place, not a control, so it takes focus without a ring.
    if (!target.matches('button, a')) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1
      target.style.outline = 'none'
    }
    target.focus({ preventScroll: true })
  }, [phase, slug])

  // The shell leaves Enter and Space to a focused button, link or radio, and the lobby wires its
  // own radios. What is bound here is for when nothing in particular has focus, or focus is on
  // plain text (the verdict after an answer).
  useHotkeys(
    phase === 'summary' && run
      ? {
          Enter: () => begin(run.config),
          space: () => begin(run.config),
          Escape: () => setPhase('lobby'),
        }
      : phase === 'run' && run
        ? {
            ...(run.picked
              ? {}
              : {
                  1: () => pick(run.card.options[0]),
                  2: () => pick(run.card.options[1]),
                  3: () => pick(run.card.options[2]),
                  4: () => pick(run.card.options[3]),
                }),
            Enter: next,
            space: next,
            Escape: leave,
          }
        : {},
    { layer: LAYER.page },
  )

  return (
    <div ref={root} data-phase={phase} className={`page ${s.root}`}>
      <motion.div key={phase} variants={fade} initial="initial" animate="enter">
        {phase === 'run' && run ? (
          <RunView run={run} onPick={pick} onNext={next} onEnd={leave} onOpen={sheet.open} />
        ) : phase === 'summary' && run ? (
          <Summary
            run={run}
            onAgain={() => begin(run.config)}
            onToday={() => navigate(ROUTES.today)}
            onSetup={() => setPhase('lobby')}
            onOpen={sheet.open}
          />
        ) : (
          <Lobby config={config} onConfig={setConfig} onStart={begin} />
        )}
      </motion.div>
    </div>
  )
}
