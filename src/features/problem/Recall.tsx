import { motion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import type { ProblemView } from '../../domain/types'
import { EMPTY_NOTES } from '../../state/schema'
import { Button, fade, Frame, Textarea } from '../../ui'
import { Section } from './Section'
import s from './Recall.module.css'

export const RECALL_FIELD = 'problem-recall-text'

export interface RecallFlow {
  step: 'memory' | 'compare'
  /** What was typed from memory. Kept only until the revision is logged. */
  text: string
}

interface RecallProps {
  view: ProblemView
  flow: RecallFlow
  onText: (text: string) => void
  onReveal: () => void
  onSkip: () => void
  onCancel: () => void
  /** Save what was typed as the problem's key insight. */
  onKeep: () => void
  /** The rating picker and details, shown under the comparison. */
  children: ReactNode
}

/** Recall before reveal: say it from memory first, then compare against the notes and rate the revision. */
export function Recall({ view, flow, onText, onReveal, onSkip, onCancel, onKeep, children }: RecallProps) {
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (flow.step !== 'memory') return
    // The prompt is the whole point of this step: put the cursor in it, and the prompt and field in view
    // (on a phone the statement and buttons above would otherwise push them below the pinned button).
    document.getElementById(RECALL_FIELD)?.focus({ preventScroll: true })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [flow.step])

  if (flow.step === 'memory') {
    return (
      <Section ref={section} label="Recall" aside="Step 1 of 2 · from memory">
        <motion.div className={s.step} variants={fade} initial="initial" animate="enter">
          <h3 className="title title-sm">Before you look: what is the key insight, and how would you start?</h3>
          <Textarea
            id={RECALL_FIELD}
            value={flow.text}
            onChange={(event) => onText(event.target.value)}
            placeholder="In your own words. Nothing is graded; this is only for you to compare."
            aria-label="From memory"
          />
          <div className={s.buttons}>
            <Button className={s.reveal} variant="primary" size="lg" kbd="mod+Enter" onClick={onReveal}>
              Reveal my notes
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Skip recall
            </Button>
            <Button variant="ghost" className={s.cancel} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </motion.div>
      </Section>
    )
  }

  const notes = view.record?.notes ?? EMPTY_NOTES
  const typed = flow.text.trim()
  const rows: { label: string; text: string; mono?: boolean }[] = [
    { label: 'Key insight', text: notes.insight },
    { label: 'Time', text: notes.time, mono: true },
    { label: 'Space', text: notes.space, mono: true },
    { label: 'Mistakes and watch-outs', text: notes.pitfalls },
  ].filter((row) => row.text.trim())

  return (
    <Section label="Recall" aside="Step 2 of 2 · compare">
      <motion.div className={s.step} variants={fade} initial="initial" animate="enter">
        <div className={s.compare}>
          <Frame label="From memory" pad="md">
            {typed ? <p className={s.recalled}>{flow.text}</p> : <p className={s.none}>You did not write anything.</p>}
          </Frame>
          <Frame label="Your notes" pad="md">
            {rows.length > 0 ? (
              <dl className={s.notes}>
                {rows.map((row) => (
                  <div key={row.label} className={s.note}>
                    <dt className="eyebrow">{row.label}</dt>
                    <dd className={row.mono ? 'num' : undefined}>{row.text}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className={s.empty}>
                <p className={s.none}>No notes saved for this problem yet.</p>
                {typed ? (
                  <Button size="sm" onClick={onKeep}>
                    Use what I wrote as the key insight
                  </Button>
                ) : null}
              </div>
            )}
          </Frame>
        </div>
        {children}
      </motion.div>
    </Section>
  )
}
