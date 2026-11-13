import { useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../app/nav'
import { TOPIC_BY_ID } from '../../data'
import type { MistakeStats } from '../../domain/types'
import { MISTAKE_LABEL, MISTAKE_TAGS } from '../../state/schema'
import { Button, ChartTip, Empty, Meter } from '../../ui'
import InsightsSection, { SubHead } from './InsightsSection'
import { joinNames } from './strengthMeta'
import s from './MistakesSection.module.css'

interface MistakesSectionProps {
  mistakes: MistakeStats
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Below this many tagged mistakes there is no pattern to claim. */
const PATTERN_MIN = 5
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four']

/** One sentence from the data: the commonest tag, and the topic it clusters in. */
function Finding({ mistakes }: MistakesSectionProps) {
  const top = mistakes.byTag[0]
  if (mistakes.total < PATTERN_MIN) {
    return (
      <>
        {COUNT_WORDS[mistakes.total]} {mistakes.total === 1 ? 'mistake' : 'mistakes'} tagged so far
        {mistakes.total === 1 ? (
          <>
            : <em>{MISTAKE_LABEL[top.tag]}</em>
          </>
        ) : null}
        . Too few to call a pattern yet.
      </>
    )
  }
  const tied = mistakes.byTag.filter((t) => t.count === top.count)
  if (tied.length > 1) {
    const names = tied.map((t) => MISTAKE_LABEL[t.tag])
    return <>{joinNames(names)} tie for the most, with {plural(top.count, 'tag')} each.</>
  }
  let where: { topic: string; count: number } | null = null
  for (const row of mistakes.byTopic) {
    const count = row.byTag[top.tag] ?? 0
    if (count > (where?.count ?? 0)) where = { topic: row.topic, count }
  }
  return (
    <>
      <em>{MISTAKE_LABEL[top.tag]}</em> shows up most
      {where ? (
        <>
          , mainly in <em>{TOPIC_BY_ID[where.topic as keyof typeof TOPIC_BY_ID].name}</em>
        </>
      ) : null}
      .
    </>
  )
}

/** Five steps from a little to the most, so fill and numeral contrast are chosen together in CSS. */
function levelOf(count: number, max: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.ceil((count / max) * 5))) as 1 | 2 | 3 | 4 | 5
}

interface CellTip {
  key: string
  x: number
  y: number
  topic: string
  tag: string
  count: number
}

/** Which mistakes come up, and where: a ranked list of the eight tags and a topic-by-tag matrix. */
export default function MistakesSection({ mistakes }: MistakesSectionProps) {
  const navigate = useNavigate()
  const [tip, setTip] = useState<CellTip | null>(null)
  const [pos, setPos] = useState({ r: 0, c: 0 })
  const frame = useRef<HTMLDivElement>(null)
  const table = useRef<HTMLTableElement>(null)

  const hasAny = mistakes.total > 0
  const max = mistakes.byTag[0]?.count ?? 0
  const cellMax = Math.max(1, ...mistakes.byTopic.flatMap((r) => Object.values(r.byTag).map((n) => n ?? 0)))
  const rows = mistakes.byTopic.length
  const at = { r: Math.min(pos.r, Math.max(0, rows - 1)), c: pos.c }
  const cols = MISTAKE_TAGS.length

  const show = (el: HTMLElement, topic: string, tag: string, count: number) => {
    const box = frame.current?.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (!box) return
    setTip({ key: `${topic}:${tag}`, x: Math.max(90, Math.min(box.width - 90, r.left - box.left + r.width / 2)), y: r.top - box.top, topic, tag, count })
  }

  // One tab stop for the whole grid: arrows move between cells, Enter opens the row's topic.
  const onGridKey = (e: KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return
    let { r, c } = at
    if (e.key === 'ArrowRight') c += 1
    else if (e.key === 'ArrowLeft') c -= 1
    else if (e.key === 'ArrowDown') r += 1
    else if (e.key === 'ArrowUp') r -= 1
    else if (e.key === 'Home') c = 0
    else if (e.key === 'End') c = cols - 1
    else return
    e.preventDefault()
    r = Math.max(0, Math.min(rows - 1, r))
    c = Math.max(0, Math.min(cols - 1, c))
    setPos({ r, c })
    table.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)?.focus()
  }

  return (
    <InsightsSection
      id="mistakes"
      eyebrow="Mistakes"
      aside={
        hasAny ? (
          <>
            <span className="num">{mistakes.total}</span> tagged in <span className="num">{rows}</span> {rows === 1 ? 'topic' : 'topics'}
          </>
        ) : undefined
      }
      title="What goes wrong, and where"
      lede={hasAny ? <Finding mistakes={mistakes} /> : undefined}
    >
      {hasAny ? (
        <div className={s.grid}>
          <div>
            <SubHead>By tag</SubHead>
            <ol className={s.ranks}>
              {mistakes.byTag.map(({ tag, count }, i) => (
                <li key={tag} className={s.rank} data-zero={count === 0 || undefined}>
                  <span className={s.tagName}>{MISTAKE_LABEL[tag]}</span>
                  <Meter value={max ? count / max : 0} tone={i === 0 && count > 0 ? 'ember' : 'ink'} height={6} label={`${MISTAKE_LABEL[tag]}: ${plural(count, 'mistake')}`} />
                  <span className={`num ${s.count}`}>{count}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <SubHead>By topic</SubHead>

            {/* Phone: the matrix would need 8 columns of 28px, so each topic lists the tags it has instead. */}
            <ul className={s.topicList}>
              {mistakes.byTopic.map((row) => {
                const topic = TOPIC_BY_ID[row.topic]
                return (
                  <li key={row.topic} className={s.topicItem}>
                    <div className={s.topicHead}>
                      <Link to={ROUTES.topic(row.topic)} className={`place ${s.topicLink}`}>
                        {topic.name}
                      </Link>
                      <span className={`num ${s.topicTotal}`}>{row.total}</span>
                    </div>
                    <ul className={s.chips}>
                      {MISTAKE_TAGS.filter((t) => (row.byTag[t.id] ?? 0) > 0)
                        .sort((a, b) => (row.byTag[b.id] ?? 0) - (row.byTag[a.id] ?? 0))
                        .map((t) => {
                        const count = row.byTag[t.id] as number
                        return (
                          <li key={t.id} className={s.chip} data-level={levelOf(count, cellMax)}>
                            {t.label} <span className="num">{count}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>

            <div className={s.matrixFrame} ref={frame} onPointerLeave={() => setTip(null)}>
              <table className={s.matrix} role="grid" ref={table} onKeyDown={onGridKey} aria-label="Mistakes per topic and tag">
                <caption className="sr-only">
                  Mistakes per topic and tag. Darker cells are more mistakes. One tab stop: arrow keys move between cells, Enter opens the topic.
                </caption>
                <thead>
                  <tr>
                    <td />
                    {MISTAKE_TAGS.map((t) => (
                      <th key={t.id} scope="col" className={s.colHead}>
                        <span>{t.label}</span>
                      </th>
                    ))}
                    <th scope="col" className={`${s.colHead} ${s.totalCol}`}>
                      <span>Total</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mistakes.byTopic.map((row, r) => {
                    const topic = TOPIC_BY_ID[row.topic]
                    return (
                      <tr key={row.topic}>
                        <th scope="row" className={s.rowHead}>
                          <Link to={ROUTES.topic(row.topic)} tabIndex={-1}>
                            {topic.short}
                          </Link>
                        </th>
                        {MISTAKE_TAGS.map((t, c) => {
                          const count = row.byTag[t.id] ?? 0
                          return (
                            <td key={t.id} className={s.cellTd}>
                              <button
                                type="button"
                                className={count > 0 ? s.cell : `${s.cell} ${s.blank}`}
                                data-level={count > 0 ? levelOf(count, cellMax) : undefined}
                                data-r={r}
                                data-c={c}
                                tabIndex={at.r === r && at.c === c ? 0 : -1}
                                aria-label={`${topic.name}, ${t.label}: ${count === 0 ? 'none' : plural(count, 'mistake')}`}
                                onPointerEnter={(e) => e.pointerType === 'mouse' && count > 0 && show(e.currentTarget, topic.name, t.label, count)}
                                onFocus={(e) => {
                                  setPos({ r, c })
                                  if (count > 0) show(e.currentTarget, topic.name, t.label, count)
                                  else setTip(null)
                                }}
                                onBlur={() => setTip(null)}
                                onClick={(e) => {
                                  // Enter on a focused cell has no pointer, so it opens the topic; a click or tap shows the figure.
                                  if (e.detail === 0) navigate(ROUTES.topic(row.topic))
                                  else if (count > 0) show(e.currentTarget, topic.name, t.label, count)
                                }}
                              >
                                {count > 0 ? <span className="num">{count}</span> : null}
                              </button>
                            </td>
                          )
                        })}
                        <td className={`num ${s.totalCell}`}>{row.total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {tip ? (
                <ChartTip x={tip.x} y={tip.y}>
                  <strong>{tip.topic}</strong>
                  <span>
                    {tip.tag} · <span className="num">{plural(tip.count, 'mistake')}</span>
                  </span>
                </ChartTip>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <Empty
          compact
          seed={23}
          title="No mistakes tagged yet"
          body="When you log an attempt you can tag what went wrong. The tags rank here, with a map of the topics where they cluster."
          action={<Button onClick={() => navigate(ROUTES.problems)}>Open the problem list</Button>}
        />
      )}
    </InsightsSection>
  )
}
