import { EyeOff, Lock } from 'lucide-react'
import { PATTERN_BY_ID, TOPIC_BY_ID, TOPICS } from '../../data'
import type { ProblemView } from '../../domain/types'
import { Chip, cx, GradeMark, statusLabel, Terrain, Tip } from '../../ui'
import { dayLabel } from './logic'
import s from './TitleBlock.module.css'

interface TitleBlockProps {
  view: ProblemView
  today: string
  /** The problem is part of a running mock: nothing may hint at the approach. */
  blind: boolean
  /** Recall step 1 is open: the tags would answer the question above them, so they are not drawn. */
  recalling: boolean
}

/** The problem's name, what kind of problem it is, its pattern tags and, once solved, the other patterns that also work. */
export function TitleBlock({ view, today, blind, recalling }: TitleBlockProps) {
  const { problem } = view
  const topic = TOPIC_BY_ID[problem.topic]
  const status = statusLabel(view)
  // A running mock beats everything: no problem in it shows a pattern, solved or not.
  const showTags = !blind && !recalling
  const alt = view.solved && showTags ? (problem.alt ?? []).map((id) => PATTERN_BY_ID[id].name) : []
  const pattern = PATTERN_BY_ID[problem.pattern]
  const pad = (n: number, width: number) => String(n).padStart(width, '0')

  return (
    <div className={s.block}>
      <div className={s.terrain} aria-hidden="true">
        <Terrain seed={problem.order} width={680} height={260} levels={12} scale={150} fade="down" />
      </div>

      <div className={s.margin}>
        <span className="eyebrow">Waypoint {pad(problem.order, 3)}</span>
        <span className={s.scale} aria-hidden="true" />
        {blind ? null : (
          <span className="eyebrow">
            Camp {pad(topic.order + 1, 2)} of {pad(TOPICS.length, 2)} · {problem.indexInTopic} of {topic.count}
          </span>
        )}
      </div>

      <h2 className={cx('display', s.name)}>{problem.title}</h2>

      <div className={s.meta}>
        <span className={cx('num', s.number)}>#{problem.number}</span>
        <GradeMark difficulty={problem.difficulty} label />
        {problem.premium ? (
          <Tip content="Needs LeetCode Premium">
            <span className={s.tipTarget} tabIndex={0}>
              <Chip tone="gold" variant="soft" icon={<Lock />}>
                Premium
              </Chip>
            </span>
          </Tip>
        ) : null}
        {status ? (
          <Chip tone={status.tone} variant={status.variant}>
            {status.text}
          </Chip>
        ) : (
          <Chip tone="neutral" variant="outline">
            To do
          </Chip>
        )}
        {view.solved && view.srs ? (
          <span className={cx('muted', s.solved)}>
            Solved <span className="num">{dayLabel(view.srs.firstOn, today)}</span>
          </span>
        ) : null}
      </div>

      {problem.summary ? <p className={s.summary}>{problem.summary}</p> : null}

      {blind ? (
        <p className={s.hidden}>
          <EyeOff aria-hidden="true" />
          <span>Pattern tags hidden during the mock</span>
        </p>
      ) : showTags ? (
        <>
          <ul className={s.tags} aria-label="Pattern tags">
            <li>
              <Chip face="sans" variant="soft">
                {pattern.name}
              </Chip>
            </li>
            {problem.tags.map((tag) => (
              <li key={tag}>
                <Chip face="sans">{tag}</Chip>
              </li>
            ))}
          </ul>
          {alt.length > 0 ? <p className={s.alt}>Also solved with: {alt.join(', ')}</p> : null}
        </>
      ) : null}
    </div>
  )
}
