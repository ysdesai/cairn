import { motion } from 'framer-motion'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PATTERN_BY_ID } from '../../data'
import type { PatternId } from '../../data/types'
import { Button, ease, Frame, GradeMark, Kbd } from '../../ui'
import { currentStreak, patternName, seconds, type Run } from './run'
import s from './RunView.module.css'

interface RunViewProps {
  run: Run
  onPick: (id: PatternId) => void
  onNext: () => void
  onEnd: () => void
  onOpen: (slug: string) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

export function RunView({ run, onPick, onNext, onEnd, onOpen }: RunViewProps) {
  const { card, picked, answers, total } = run
  const { problem } = card
  const answered = picked !== null
  const number = answers.length + (answered ? 0 : 1)
  const streak = currentStreak(answers)
  const right = answers.filter((a) => a.correct).length
  const last = answers[answers.length - 1]
  const isLast = answers.length >= total
  const titleRef = useRef<HTMLHeadingElement>(null)
  const verdictRef = useRef<HTMLParagraphElement>(null)
  const revealRef = useRef<HTMLElement>(null)
  const tellRef = useRef<HTMLDivElement>(null)

  // Once the reveal opens, focus moves onto the verdict. It is not a control, so Enter and Space
  // still reach the page's shortcuts and go to the next card, and a screen reader reads on from
  // the verdict into the clue. The page then scrolls only as far as the reveal needs, and never
  // far enough to push the problem under the top bar.
  useEffect(() => {
    if (!answered) return
    verdictRef.current?.focus({ preventScroll: true })
    const verdict = verdictRef.current
    const reveal = revealRef.current
    const tell = tellRef.current
    const title = titleRef.current
    if (!verdict || !reveal || !tell || !title) return

    const root = getComputedStyle(document.documentElement)
    const topbar = Number.parseFloat(root.getPropertyValue('--topbar-h')) || 56
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;visibility:hidden;pointer-events:none;height:var(--dock-clearance)'
    document.body.appendChild(probe)
    const clearance = probe.getBoundingClientRect().height
    probe.remove()

    // On a phone the reveal is taller than the screen, so the page only has to show the verdict, Next
    // and the first lines of the clue; elsewhere the whole reveal.
    const phone = window.matchMedia('(max-width: 640px)').matches
    const bottom = phone ? tell.getBoundingClientRect().top + 96 : reveal.getBoundingClientRect().bottom
    const usable = window.innerHeight - clearance
    const need = bottom - usable
    const room = title.getBoundingClientRect().top - (topbar + 12)
    const by = Math.min(need, room)
    if (by > 1) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollBy({ top: by, behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [answered, problem.slug])

  const answer = PATTERN_BY_ID[problem.pattern]
  const alsoSolved = (problem.alt ?? []).filter((id) => PATTERN_BY_ID[id])

  return (
    <div className={s.run}>
      <h1 className="sr-only">
        Pattern drill, card {number} of {total}
      </h1>

      <div className={s.progress}>
        <span className={`num ${s.count}`} role="img" aria-label={`Card ${number} of ${total}, ${right} right so far`}>
          {pad(number)} <span className="muted">/ {pad(total)}</span>
        </span>
        <span className={s.ticks} aria-hidden="true">
          {Array.from({ length: total }, (_, i) => {
            const done = answers[i]
            const state = done ? (done.correct ? s.right : s.wrong) : i === answers.length ? s.current : ''
            return <span key={i} className={`${s.tick} ${state}`} />
          })}
        </span>
        <span className={`eyebrow ${s.streak}`}>
          Streak <span className={`num ${streak >= 3 ? s.hot : ''}`}>{streak}</span>
        </span>
        <Button variant="ghost" size="sm" kbd="Escape" onClick={onEnd} className={s.end}>
          End run
        </Button>
      </div>

      <motion.div
        key={problem.slug}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: ease.out } }}
      >
        <Frame tone="raised" label="Which pattern?" pad="md" className={s.card}>
          <h2 ref={titleRef} data-autofocus="" tabIndex={-1} className={`title ${s.problem}`}>
            {problem.title}
          </h2>
          <GradeMark difficulty={problem.difficulty} label />
          <p className={s.summary}>{problem.summary}</p>
        </Frame>

        <div className={s.options} role="group" aria-label="Patterns">
          {card.options.map((id, i) => {
            const state = !answered ? 'open' : id === problem.pattern ? 'right' : id === picked ? 'wrong' : 'dim'
            return (
              <button
                key={id}
                type="button"
                data-option=""
                data-state={state}
                disabled={answered}
                className={s.option}
                onClick={() => onPick(id)}
              >
                <Kbd keys={String(i + 1)} className={s.keycap} />
                <span className={s.optionName}>{patternName(id)}</span>
                {state === 'right' ? <Check className={s.glyph} aria-hidden="true" /> : null}
                {state === 'wrong' ? <X className={s.glyph} aria-hidden="true" /> : null}
                {state === 'right' ? <span className="sr-only">Correct answer</span> : null}
                {state === 'wrong' ? <span className="sr-only">Your pick, not the answer</span> : null}
              </button>
            )
          })}
        </div>
      </motion.div>

      <div role="status" aria-live="polite">
        {answered && last ? (
          <motion.section
            key={problem.slug}
            ref={revealRef}
            className={s.reveal}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: ease.out } }}
          >
            <p ref={verdictRef} tabIndex={-1} className={s.verdict} data-right={last.correct}>
              {last.correct ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
              <span>{last.correct ? 'Correct.' : `Not this one. It is ${answer.name}.`}</span>
              <span className={`num ${s.time}`}>{seconds(last.ms)}</span>
            </p>

            <div className={s.actions}>
              <Button variant="ghost" icon={<ArrowUpRight />} onClick={() => onOpen(problem.slug)}>
                Open problem
              </Button>
              <Button variant="primary" size="lg" kbd="Enter" onClick={onNext}>
                {isLast ? 'See results' : 'Next'}
              </Button>
            </div>

            <div ref={tellRef} className={s.tell}>
              <p className="eyebrow">The tell</p>
              <p className={s.clue}>{problem.clue}</p>
            </div>

            <p className={s.meaning}>
              <span className="place">{answer.name}</span> <span className="subtle">{answer.hint}</span>
            </p>

            {alsoSolved.length > 0 ? (
              <p className={s.also}>
                Also solved with:{' '}
                {alsoSolved.map((id, i) => (
                  <span key={id}>
                    {i > 0 ? (i === alsoSolved.length - 1 ? ' and ' : ', ') : ''}
                    <span className="place">{patternName(id)}</span>
                  </span>
                ))}
                .
              </p>
            ) : null}
          </motion.section>
        ) : null}
      </div>
    </div>
  )
}
