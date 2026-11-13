import { area, curveMonotoneX, line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { ArrowUpRight } from 'lucide-react'
import { useId, useMemo } from 'react'
import { diffDays, formatDate } from '../../domain/dates'
import type { PaceStatus, PlanStats } from '../../domain/types'
import { useDerived } from '../../state/hooks'
import { ROUTES } from '../../app/nav'
import { ButtonLink, ChartTip, Chip, useMeasure, type Tone } from '../../ui'
import { useCursor } from './PlanCursor'
import InsightsSection from './InsightsSection'
import s from './PlanSection.module.css'

const MARGIN = { l: 30, r: 10, b: 26 }
const LABEL_ROW = 15
/** The axis never stretches past this many plan lengths, however slow the pace. */
const MAX_SPAN = 2

interface Flag {
  key: string
  text: string
  x: number
  tone: 'ink' | 'ember' | 'plan'
  /** The dot on the 150 line this flag names, if any. */
  dot?: 'target' | 'projected'
  row: number
  anchor: 'start' | 'middle' | 'end'
}

const STANDING: Record<PaceStatus, { tone: Tone; variant: 'soft' | 'outline' }> = {
  'not-started': { tone: 'neutral', variant: 'outline' },
  'on-pace': { tone: 'neutral', variant: 'soft' },
  ahead: { tone: 'moss', variant: 'soft' },
  behind: { tone: 'lake', variant: 'soft' },
  done: { tone: 'gold', variant: 'soft' },
}

function standingText(plan: PlanStats): string {
  const n = Math.abs(plan.delta)
  switch (plan.status) {
    case 'done':
      return 'Done'
    case 'not-started':
      return 'Not started'
    case 'ahead':
      return `${n} ahead of plan`
    case 'behind':
      return `${n} behind plan`
    default:
      return 'On the line'
  }
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** The sentence about where the plan stands, with the projection folded in so the two never disagree. */
function Standing({ plan, beforeStart, daysToStart }: { plan: PlanStats; beforeStart: boolean; daysToStart: number }) {
  const n = Math.abs(plan.delta)
  if (beforeStart) {
    return (
      <>
        The plan begins on <em>{formatDate(plan.startDate)}</em>, {plural(daysToStart, 'day')} from today.{' '}
        {plan.solved > 0 ? `The ${plan.solved} you have solved count toward it.` : 'Nothing is expected of you before then.'}
      </>
    )
  }
  if (plan.status === 'done') {
    return (
      <>
        All {plan.total} solved. <em>Summit.</em>
      </>
    )
  }
  if (plan.status === 'not-started') {
    return (
      <>
        The route is drawn. It starts with <em>one solve</em>.
      </>
    )
  }
  const gap = plan.projectedFinish ? diffDays(plan.targetDate, plan.projectedFinish) : null
  const today =
    plan.status === 'ahead' ? (
      <>
        <em>{n} ahead</em> of the line today
      </>
    ) : plan.status === 'behind' ? (
      <>
        <em>{n} behind</em> the line today
      </>
    ) : (
      <>
        Right <em>on the line</em> today
      </>
    )
  const finish =
    gap === null ? null : gap <= 0 ? (
      <>at your recent pace you finish {gap === 0 ? 'on the target date' : `${plural(-gap, 'day')} early`}</>
    ) : (
      <>
        at your recent pace the finish is <span className="num">{formatDate(plan.projectedFinish as string)}</span>, {plural(gap, 'day')} after the target
      </>
    )
  const connector = gap !== null && gap <= 0 ? (plan.status === 'behind' ? 'Even so,' : 'And') : plan.status === 'behind' ? 'And' : 'But'
  return (
    <>
      {today}, {plan.remaining} to go{finish ? <>. {connector} {finish}</> : null}.
    </>
  )
}

const rate = (n: number) => n.toFixed(1)

/** First day of each month inside the axis, as day indexes from the start date. */
function monthTicks(start: string, span: number): { i: number; label: string; year: string | null }[] {
  const [y, m] = start.split('-').map(Number)
  // The start itself is labelled with its month, so the axis never begins bare.
  const out = [{ i: 0, label: formatDate(start, 'month'), year: null as string | null }]
  for (let k = 0; k < 120; k++) {
    const first = `${y + Math.floor((m - 1 + k) / 12)}-${String(((m - 1 + k) % 12) + 1).padStart(2, '0')}-01`
    const i = diffDays(start, first)
    if (i > span) break
    if (i <= 0) continue
    out.push({ i, label: formatDate(first, 'month'), year: first.slice(5, 7) === '01' ? first.slice(0, 4) : null })
  }
  return out
}

export default function PlanSection() {
  const { plan, today } = useDerived()
  const [measureRef, { width }] = useMeasure<HTMLDivElement>()
  const gradId = useId().replace(/:/g, '')
  const empty = plan.solved === 0
  const { series } = plan

  const todayIdx = diffDays(plan.startDate, today)
  // A start date still ahead of us: there is no pace to speak of, and the chart shows the plan alone.
  const beforeStart = todayIdx < 0
  const hasActual = series.some((p) => p.actual != null && p.actual > 0)
  const hasToday = todayIdx >= 0 && todayIdx < series.length
  const lastIdx = series.length - 1
  const targetIdx = Math.max(0, diffDays(plan.startDate, plan.targetDate))
  const projectedIdx =
    !empty && !beforeStart && plan.remaining > 0 && plan.projectedFinish ? Math.max(0, diffDays(plan.startDate, plan.projectedFinish)) : null
  const spanCap = Math.max(lastIdx, plan.totalDays * MAX_SPAN)
  const span = Math.max(1, Math.min(spanCap, Math.max(lastIdx, targetIdx, projectedIdx ?? 0)))

  const cursor = useCursor({
    length: series.length,
    start: hasToday ? todayIdx : 0,
    steps: { left: 1, right: 1 },
  })

  const compact = width < 520
  const height = compact ? 250 : 300

  const geometry = useMemo(() => {
    if (width === 0) return null
    const x = scaleLinear().domain([0, span]).range([MARGIN.l, width - MARGIN.r])
    const todayX = hasToday ? x(todayIdx) : null
    const todayY0 = hasToday ? (series[todayIdx].actual ?? 0) : 0

    // Flags name the target, the projection and today above the plot. Rows keep them apart.
    const pending: Omit<Flag, 'row'>[] = []
    pending.push({
      key: 'target',
      text: `Target ${formatDate(plan.targetDate)}`,
      x: x(targetIdx),
      tone: 'plan',
      dot: 'target',
      anchor: 'end',
    })
    if (projectedIdx != null && plan.projectedFinish) {
      const clipped = projectedIdx > span
      pending.push({
        key: 'projected',
        text: `Projected ${formatDate(plan.projectedFinish)}`,
        x: x(Math.min(projectedIdx, span)),
        tone: 'ember',
        dot: clipped ? undefined : 'projected',
        anchor: 'end',
      })
    }
    if (todayX != null) pending.push({ key: 'today', text: 'Today', x: todayX, tone: 'ink', anchor: 'middle' })

    const extent = (f: Omit<Flag, 'row'>) => {
      const w = f.text.length * 6.9
      const x0 = f.anchor === 'end' ? f.x - w : f.anchor === 'middle' ? f.x - w / 2 : f.x
      return [Math.max(0, x0), Math.max(0, x0) + w] as const
    }
    const rows: (readonly [number, number])[][] = []
    const flags: Flag[] = []
    // Nearest the right edge first, so the outermost label keeps the top row.
    for (const f of [...pending].sort((a, b) => b.x - a.x)) {
      const [a, b] = extent(f)
      let row = 0
      while (rows[row]?.some(([c, d]) => a < d + 8 && b > c - 8)) row += 1
      ;(rows[row] ??= []).push([a, b])
      flags.push({ ...f, row })
    }
    const nRows = Math.max(1, rows.length)
    const top = 12 + nRows * LABEL_ROW
    const y = scaleLinear().domain([0, plan.total]).range([height - MARGIN.b, top])
    return { x, y, flags, top, nRows, todayX, todayY0 }
  }, [width, height, span, hasToday, todayIdx, series, plan, targetIdx, projectedIdx])

  const gridValues = useMemo(() => {
    const v: number[] = []
    for (let n = 50; n < plan.total; n += 50) v.push(n)
    v.push(plan.total)
    return v
  }, [plan.total])

  const ticks = useMemo(() => {
    if (!geometry) return []
    const all = monthTicks(plan.startDate, span)
    const kept: typeof all = []
    let lastX = -Infinity
    for (const t of all) {
      const tx = geometry.x(t.i)
      if (tx - lastX >= (t.year ? 62 : 44)) {
        kept.push(t)
        lastX = tx
      }
    }
    return kept
  }, [geometry, plan.startDate, span])

  const summary = `Problems solved from ${formatDate(plan.startDate, 'medium')} to ${formatDate(plan.targetDate, 'medium')}. ${plan.solved} of ${plan.total} solved by ${formatDate(today, 'medium')}; the plan expects ${plan.expected}.${plan.projectedFinish && plan.remaining > 0 ? ` At the recent pace the finish is ${formatDate(plan.projectedFinish, 'medium')}.` : ''} Arrow keys move through the days.`

  const point = cursor.index != null ? series[cursor.index] : null

  let tip: { x: number; y: number; below: boolean } | null = null
  if (geometry && point && cursor.index != null) {
    const px = geometry.x(cursor.index)
    const py = geometry.y(Math.max(point.actual ?? 0, point.planned))
    tip = { x: Math.max(110, Math.min(width - 110, px)), y: py, below: py < 64 }
  }

  const paths = useMemo(() => {
    if (!geometry) return null
    const { x, y } = geometry
    const base = height - MARGIN.b
    const done = series.map((p, i) => ({ i, v: p.actual })).filter((p): p is { i: number; v: number } => p.v != null)
    const stroke = line<{ i: number; v: number }>()
      .x((p) => x(p.i))
      .y((p) => y(p.v))
      .curve(curveMonotoneX)
    const fill = area<{ i: number; v: number }>()
      .x((p) => x(p.i))
      .y0(base)
      .y1((p) => y(p.v))
      .curve(curveMonotoneX)
    return { actual: stroke(done), fill: fill(done) }
  }, [geometry, series, height])

  let projection: { x2: number; y2: number } | null = null
  if (geometry && projectedIdx != null && geometry.todayX != null) {
    const reach = Math.min(projectedIdx, span)
    const t = projectedIdx === todayIdx ? 1 : (reach - todayIdx) / (projectedIdx - todayIdx)
    const v = plan.solved + (plan.total - plan.solved) * t
    projection = { x2: geometry.x(reach), y2: geometry.y(v) }
  }

  const paceLine = () => {
    if (plan.status === 'done') {
      return (
        <>
          All {plan.total} solved{plan.projectedFinish ? <>, the last on <span className="num">{formatDate(plan.projectedFinish)}</span></> : null}.
        </>
      )
    }
    const needs =
      plan.daysLeft === 0 ? (
        <>
          The target date has passed with <span className="num">{plan.remaining}</span> to go.
        </>
      ) : (
        <>
          Needs <span className="num">{rate(plan.neededPerDay)}</span> a day.
        </>
      )
    return (
      <>
        {needs} You average <span className="num">{rate(plan.recentPerDay)}</span> a day over the last two weeks and{' '}
        <span className="num">{rate(plan.overallPerDay)}</span> overall.
      </>
    )
  }

  const ghostLabel = `${plan.total} problems by ${formatDate(plan.targetDate)}`

  const gap = plan.projectedFinish && plan.remaining > 0 ? diffDays(plan.targetDate, plan.projectedFinish) : null
  const overTarget = Math.max(0, plan.dayNumber - plan.totalDays)

  return (
    <InsightsSection
      id="plan"
      eyebrow="Plan"
      title="Plan versus actual"
      aside={
        <>
          <span className="num">{formatDate(plan.startDate)}</span> to <span className="num">{formatDate(plan.targetDate)}</span>
        </>
      }
      lede={<Standing plan={plan} beforeStart={beforeStart} daysToStart={-todayIdx} />}
    >
      <div className={s.chart} ref={measureRef} style={{ height }}>
        {geometry && paths ? (
          <div
            className={s.plot}
            role="group"
            aria-label={summary}
            {...cursor.props}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const i = Math.round(geometry.x.invert(e.clientX - rect.left))
              cursor.set(Math.max(0, Math.min(series.length - 1, i)))
            }}
            style={{ height }}
          >
            <svg width={width} height={height} aria-hidden="true">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--ember)" stopOpacity="0.3" />
                  <stop offset="1" stopColor="var(--ember)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {gridValues.map((v) => (
                <g key={v}>
                  <line className={s.grid} x1={MARGIN.l} x2={width - MARGIN.r} y1={geometry.y(v)} y2={geometry.y(v)} />
                  <text className={s.tick} x={MARGIN.l - 7} y={geometry.y(v)} dy="0.35em" textAnchor="end">
                    {v}
                  </text>
                </g>
              ))}
              <line className={s.base} x1={MARGIN.l} x2={width - MARGIN.r} y1={height - MARGIN.b} y2={height - MARGIN.b} />
              <text className={s.tick} x={MARGIN.l - 7} y={height - MARGIN.b} dy="0.35em" textAnchor="end">
                0
              </text>
              {ticks.map((t) => (
                <g key={t.i}>
                  <line className={s.base} x1={geometry.x(t.i)} x2={geometry.x(t.i)} y1={height - MARGIN.b} y2={height - MARGIN.b + 4} />
                  <text className={s.tick} x={geometry.x(t.i)} y={height - MARGIN.b + 17} textAnchor={t.i === 0 ? 'start' : 'middle'}>
                    {t.year ? `${t.label} ${t.year}` : t.label}
                  </text>
                </g>
              ))}

              {!empty ? <path d={paths.fill ?? ''} fill={`url(#${gradId})`} /> : null}

              <line
                className={s.plan}
                x1={geometry.x(0)}
                y1={geometry.y(0)}
                x2={geometry.x(targetIdx)}
                y2={geometry.y(plan.total)}
              />

              {projection && geometry.todayX != null ? (
                <line
                  className={s.projection}
                  x1={geometry.todayX}
                  y1={geometry.y(series[todayIdx].actual ?? 0)}
                  x2={projection.x2}
                  y2={projection.y2}
                />
              ) : null}

              {geometry.todayX != null ? (
                <line
                  className={s.todayLine}
                  x1={geometry.todayX}
                  x2={geometry.todayX}
                  y1={geometry.top - 6}
                  y2={height - MARGIN.b}
                />
              ) : null}

              {!empty ? <path className={s.actual} d={paths.actual ?? ''} /> : null}

              {geometry.flags.map((f) => {
                const fy = 10 + f.row * LABEL_ROW
                // Keep every label inside the drawing, whatever date it names.
                const w = f.text.length * 6.9
                const x = f.anchor === 'end' ? Math.max(f.x, w) : f.anchor === 'middle' ? Math.max(w / 2, Math.min(width - w / 2, f.x)) : Math.min(f.x, width - w)
                return (
                  <g key={f.key}>
                    {f.key !== 'today' ? (
                      <line className={s.stem} x1={f.x} x2={f.x} y1={fy + 4} y2={geometry.y(plan.total)} />
                    ) : null}
                    <text
                      className={`${s.flag} ${s[`flag-${f.tone}`]}`}
                      x={f.anchor === 'end' ? x + 2 : x}
                      y={fy}
                      textAnchor={f.anchor}
                    >
                      {f.text}
                    </text>
                    {f.dot === 'target' ? <circle className={s.targetDot} cx={f.x} cy={geometry.y(plan.total)} r={3.5} /> : null}
                    {f.dot === 'projected' ? (
                      <circle className={s.projectedDot} cx={f.x} cy={geometry.y(plan.total)} r={3.5} />
                    ) : null}
                  </g>
                )
              })}

              {geometry.todayX != null && !empty ? (
                <circle className={s.nowDot} cx={geometry.todayX} cy={geometry.y(geometry.todayY0)} r={4.5} />
              ) : null}

              {point && cursor.index != null ? (
                <g className={s.cross}>
                  <line x1={geometry.x(cursor.index)} x2={geometry.x(cursor.index)} y1={geometry.top - 6} y2={height - MARGIN.b} />
                  <circle className={s.crossPlan} cx={geometry.x(cursor.index)} cy={geometry.y(point.planned)} r={3} />
                  {point.actual != null ? (
                    <circle className={s.crossActual} cx={geometry.x(cursor.index)} cy={geometry.y(point.actual)} r={4} />
                  ) : null}
                </g>
              ) : null}
            </svg>
          </div>
        ) : null}
        {tip && point ? (
          <ChartTip x={tip.x} y={tip.y} below={tip.below}>
            <span>
              <strong>{formatDate(point.date)}</strong> · {point.actual != null ? <span className="num">{point.actual} solved · </span> : null}
              <span className="num">plan {point.planned}</span>
            </span>
          </ChartTip>
        ) : null}
      </div>

      <div className={s.key} aria-hidden="true">
        <span className={s.keyItem}>
          <svg width="22" height="6">
            <line className={s.plan} x1="0" x2="22" y1="3" y2="3" />
          </svg>
          Plan
        </span>
        {hasActual ? (
          <span className={s.keyItem}>
            <svg width="22" height="6">
              <line className={s.actual} x1="0" x2="22" y1="3" y2="3" />
            </svg>
            Solved
          </span>
        ) : null}
        {projection ? (
          <span className={s.keyItem}>
            <svg width="22" height="6">
              <line className={s.projection} x1="0" x2="22" y1="3" y2="3" />
            </svg>
            At recent pace
          </span>
        ) : null}
      </div>

      {empty || beforeStart ? (
        <div className={`${s.facts} ${s.factsEmpty}`}>
          <p className={s.lede}>
            The dashed line is the plan: <span className="num">{ghostLabel}</span>.{' '}
            {beforeStart ? 'Pace figures begin once the plan does.' : 'Your line starts with your first solve.'}
          </p>
          <ButtonLink className={s.link} variant="ghost" size="sm" href={`#${ROUTES.settings}`} icon={<ArrowUpRight />}>
            Change dates
          </ButtonLink>
        </div>
      ) : (
        <div className={s.facts}>
          <dl className={s.figures}>
            <div className={s.figure}>
              <dt className="eyebrow">Day</dt>
              <dd>
                <span className={`stat ${s.big}`}>{Math.min(plan.dayNumber, plan.totalDays)}</span>
                <span className={`num muted ${s.of}`}>
                  of {plan.totalDays}
                  {overTarget > 0 ? ` · ${plural(overTarget, 'day')} past target` : ''}
                </span>
              </dd>
            </div>
            <div className={s.figure}>
              <dt className="eyebrow">To go</dt>
              <dd>
                <span className={`stat ${s.big}`}>{plan.remaining}</span>
                <span className={`num muted ${s.of}`}>of {plan.total}</span>
              </dd>
            </div>
            <div className={`${s.figure} ${s.standing}`}>
              <dt className="eyebrow">Standing</dt>
              <dd>
                <Chip tone={STANDING[plan.status].tone} variant={STANDING[plan.status].variant}>
                  {standingText(plan)}
                </Chip>
                <span className={`num muted ${s.of}`}>
                  {plan.solved} solved, plan {plan.expected}
                </span>
              </dd>
            </div>
            <div className={s.figure}>
              <dt className="eyebrow">{plan.status === 'done' ? 'Finished' : 'Finish'}</dt>
              <dd>
                <span className={`stat ${s.big}`}>{plan.projectedFinish ? formatDate(plan.projectedFinish) : '—'}</span>
                <span className={`num muted ${s.of}`}>
                  {plan.status === 'done'
                    ? 'last solve'
                    : gap === null
                      ? 'needs a pace first'
                      : gap === 0
                        ? 'on the target date'
                        : gap < 0
                          ? `${plural(-gap, 'day')} early`
                          : `${plural(gap, 'day')} after target`}
                </span>
              </dd>
            </div>
          </dl>
          <div className={s.words}>
            <p className={s.lede}>{paceLine()}</p>
            <ButtonLink className={s.link} variant="ghost" size="sm" href={`#${ROUTES.settings}`} icon={<ArrowUpRight />}>
              Change dates
            </ButtonLink>
          </div>
        </div>
      )}
    </InsightsSection>
  )
}
