import { scaleLinear } from 'd3-scale'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useId, useMemo } from 'react'
import { ROUTES } from '../../app/nav'
import { formatDate, weekdayIndex } from '../../domain/dates'
import { LADDER } from '../../domain/srs'
import { useDerived, useSettings } from '../../state/hooks'
import { ButtonLink, Cairn, CAIRN_STONES, ChartTip, useMeasure } from '../../ui'
import { useCursor } from './PlanCursor'
import InsightsSection, { SubHead } from './InsightsSection'
import s from './RevisionSection.module.css'

const MARGIN = { l: 26, r: 10, t: 24, b: 46 }
const INITIALS = 'MTWTFSS'

const weekdayName = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function RevisionSection() {
  const { forecast, queue, list, counts } = useDerived()
  const { dailyReviewCap: cap } = useSettings()
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const hatchId = useId().replace(/:/g, '')
  const empty = counts.solved === 0

  const cursor = useCursor({ length: forecast.length, start: 0 })
  const height = width < 520 ? 210 : 250

  // Solved problems by rungs cleared. Index 5 is mastered.
  const rungs = useMemo(() => {
    const out = new Array<number>(CAIRN_STONES + 1).fill(0)
    for (const v of list) if (v.srs) out[Math.min(CAIRN_STONES, v.srs.step)] += 1
    return out
  }, [list])
  const widest = Math.max(1, ...rungs)

  const today = forecast[0]
  // Today's backlog is the revisions waiting behind the cap. It is gone on the first day after today
  // with none carried; later one-item spills are ordinary new due dates, not the old backlog.
  const backlog = today.carried > 0
  const clearsAt = backlog ? forecast.findIndex((d, i) => i > 0 && d.carried === 0) : -1
  const clears = clearsAt > 0 ? forecast[clearsAt] : undefined
  const nextDay = forecast.find((d) => d.scheduled > 0)

  const title = empty ? (
    <>
      Revisions begin with <em>your first solve</em>.
    </>
  ) : today.scheduled > 0 ? (
    <>
      <em>{plural(today.scheduled, 'revision')}</em> today.
    </>
  ) : nextDay ? (
    <>
      Nothing today. Next up <em>{weekdayName(nextDay.date)}</em>.
    </>
  ) : (
    <>
      Nothing waiting. Every rung is <em>on schedule</em>.
    </>
  )

  const sentence = () => {
    if (empty) return 'Solve a problem and its first revision is scheduled within days. Nothing is waiting.'
    let first: string
    if (today.scheduled === 0 && today.carried === 0) {
      first = queue.doneToday > 0 ? 'Nothing more today.' : 'Nothing due today.'
      first += nextDay ? ` Next revisions ${weekdayName(nextDay.date)}.` : ' Nothing is due in the next two weeks.'
      return first
    }
    if (today.scheduled === 0) first = `Today's cap of ${cap} is done, ${today.carried} waiting.`
    else first = `${today.scheduled} today${today.carried > 0 ? `, ${today.carried} waiting behind the cap` : ''}.`
    if (!backlog) return first
    return clears
      ? `${first} It is cleared by ${weekdayName(clears.date)}.`
      : `${first} At this pace it runs past ${formatDate(forecast[forecast.length - 1].date)}.`
  }

  const geometry = useMemo(() => {
    if (width === 0) return null
    const top = Math.max(cap, ...forecast.map((d) => d.scheduled + d.carried), 1)
    const y = scaleLinear().domain([0, top]).nice(3).range([height - MARGIN.b, MARGIN.t])
    const plotW = width - MARGIN.l - MARGIN.r
    const pitch = plotW / forecast.length
    const barW = Math.max(8, Math.min(30, pitch - 6))
    return { y, pitch, barW, ticks: y.ticks(3) }
  }, [width, height, cap, forecast])

  const base = height - MARGIN.b
  const point = cursor.index != null ? forecast[cursor.index] : null
  let tip: { x: number; y: number; below: boolean } | null = null
  if (geometry && point && cursor.index != null) {
    const cx = MARGIN.l + (cursor.index + 0.5) * geometry.pitch
    const py = geometry.y(point.scheduled + point.carried)
    tip = { x: Math.max(110, Math.min(width - 110, cx)), y: py, below: py < 52 }
  }

  const summary = `Revisions scheduled over the next 14 days, with a cap of ${cap} a day. ${today.scheduled} today${today.carried ? `, ${today.carried} waiting behind the cap` : ''}. Arrow keys move between days.`

  return (
    <InsightsSection
      id="revisions"
      eyebrow="Revisions"
      title="The revision ladder"
      aside={
        <>
          cap <span className="num">{cap}</span> a day
        </>
      }
      lede={title}
    >
      <div className={s.block}>
        <SubHead as="p">The next two weeks</SubHead>
        <p className={s.lede}>{sentence()}</p>

        <div className={s.chart} ref={ref} style={{ height }}>
          {geometry ? (
            <div
              className={s.plot}
              role="group"
              aria-label={summary}
              {...cursor.props}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const i = Math.floor((e.clientX - rect.left - MARGIN.l) / geometry.pitch)
                cursor.set(i < 0 || i >= forecast.length ? null : i)
              }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const i = Math.floor((e.clientX - rect.left - MARGIN.l) / geometry.pitch)
                if (i >= 0 && i < forecast.length) cursor.set(i)
              }}
              style={{ height }}
            >
              <svg width={width} height={height} aria-hidden="true">
                <defs>
                  <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ember)" strokeWidth="1.25" />
                  </pattern>
                </defs>

                {geometry.ticks.map((v) => (
                  <g key={v}>
                    {v > 0 ? <line className={s.grid} x1={MARGIN.l} x2={width - MARGIN.r} y1={geometry.y(v)} y2={geometry.y(v)} /> : null}
                    <text className={s.tick} x={MARGIN.l - 7} y={geometry.y(v)} dy="0.35em" textAnchor="end">
                      {v}
                    </text>
                  </g>
                ))}

                {cursor.index != null ? (
                  <rect
                    className={s.band}
                    x={MARGIN.l + cursor.index * geometry.pitch}
                    y={MARGIN.t - 8}
                    width={geometry.pitch}
                    height={base - MARGIN.t + 8}
                  />
                ) : null}

                {forecast.map((d, i) => {
                  const cx = MARGIN.l + (i + 0.5) * geometry.pitch
                  const x = cx - geometry.barW / 2
                  const sh = base - geometry.y(d.scheduled)
                  const ch = geometry.y(d.scheduled) - geometry.y(d.scheduled + d.carried)
                  return (
                    <g key={d.date}>
                      {d.scheduled > 0 ? <rect className={s.scheduled} x={x} y={base - sh} width={geometry.barW} height={sh} /> : null}
                      {d.carried > 0 ? (
                        <rect
                          className={s.carried}
                          x={x + 0.5}
                          y={base - sh - ch + 0.5}
                          width={geometry.barW - 1}
                          height={Math.max(0, ch - 1)}
                          fill={`url(#${hatchId})`}
                        />
                      ) : null}
                      <text className={`${s.tick} ${i === 0 ? s.now : ''}`} x={cx} y={base + 16} textAnchor="middle">
                        {INITIALS[weekdayIndex(d.date)]}
                      </text>
                      <text className={`${s.tick} ${i === 0 ? s.now : ''}`} x={cx} y={base + 29} textAnchor="middle">
                        {Number(d.date.slice(8))}
                      </text>
                      {i === 0 ? (
                        <text className={`${s.tick} ${s.now}`} x={cx - geometry.barW / 2} y={base + 42}>
                          today
                        </text>
                      ) : i > 2 && d.date.endsWith('-01') ? (
                        <text className={s.tick} x={cx - geometry.barW / 2} y={base + 42}>
                          {formatDate(d.date, 'month')}
                        </text>
                      ) : null}
                    </g>
                  )
                })}

                <line className={s.baseline} x1={MARGIN.l} x2={width - MARGIN.r} y1={base} y2={base} />
                <line className={s.cap} x1={MARGIN.l} x2={width - MARGIN.r} y1={geometry.y(cap)} y2={geometry.y(cap)} />
                <text className={`${s.tick} ${s.capLabel}`} x={width - MARGIN.r} y={geometry.y(cap) - 6} textAnchor="end">
                  cap {cap}
                </text>
              </svg>
            </div>
          ) : null}
          {tip && point ? (
            <ChartTip x={tip.x} y={tip.y} below={tip.below}>
              <span>
                <strong>{formatDate(point.date, 'weekday')}</strong> ·{' '}
                <span className="num">
                  {point.scheduled} scheduled · {point.carried} waiting
                </span>
              </span>
            </ChartTip>
          ) : null}
        </div>

        <div className={s.key} aria-hidden="true">
          <span className={s.keyItem}>
            <svg width="14" height="10">
              <rect className={s.scheduled} x="0" y="0" width="14" height="10" />
            </svg>
            Scheduled
          </span>
          <span className={s.keyItem}>
            <svg width="14" height="10">
              <rect className={s.carried} x="0.5" y="0.5" width="13" height="9" fill={`url(#${hatchId})`} />
            </svg>
            Waiting behind the cap
          </span>
          <span className={s.keyItem}>
            <svg width="22" height="6">
              <line className={s.cap} x1="0" x2="22" y1="3" y2="3" />
            </svg>
            Daily cap
          </span>
        </div>
      </div>

      <div className={s.block}>
        <SubHead as="p">Where everything stands on the ladder</SubHead>
        <div className={s.blockHead}>
          <p className={s.lede}>
            {empty ? (
              <>Solved problems collect here, one stone for each revision cleared.</>
            ) : (
              <>
                <span className="num">{counts.solved}</span> solved, <span className="num">{rungs[CAIRN_STONES]}</span> mastered.
              </>
            )}
          </p>
        </div>
        <ol className={s.ladder} aria-label="Solved problems by revisions cleared">
          {rungs.map((count, i) => {
            const mastered = i === CAIRN_STONES
            return (
              <li key={i} className={`${s.rung} ${count === 0 ? s.none : ''}`}>
                <Cairn
                  step={i}
                  mastered={mastered && count > 0}
                  size={64}
                  label={mastered ? `Mastered: ${count}` : `${i} of ${CAIRN_STONES} revisions cleared: ${count}`}
                />
                <span className={s.countLine}>
                  <span className={`num ${s.count}`}>{count}</span>
                  <span className={`num ${s.unit}`}>{count === 1 ? 'problem' : 'problems'}</span>
                </span>
                <span className="eyebrow">{mastered ? 'Mastered' : `On rung ${i + 1}`}</span>
                <span className={s.then}>
                  {mastered ? `All ${CAIRN_STONES} rungs cleared` : `${i} of ${CAIRN_STONES} rungs cleared`}
                  <br />
                  {mastered ? 'No more revisions' : `Revised after ${plural(LADDER[i], 'day')}`}
                </span>
                <span className={s.share} aria-hidden="true">
                  <span style={{ transform: `scaleX(${count / widest})` }} />
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className={`${s.block} ${s.how}`}>
        <SubHead as="p">How revisions work</SubHead>
        <p className={s.prose}>
          Each solved problem climbs a ladder of {LADDER.slice(0, -1).join(', ')} and {LADDER[LADDER.length - 1]} days: every revision clears
          a rung and pushes the next one further out, and {CAIRN_STONES} rungs mean mastered. Easy climbs two rungs, Struggled one, and
          Needed help puts the problem back on the first rung. The cap of {cap} a day holds the rest until there is room, so a revision that
          waits costs nothing.
        </p>
        <div className={`${s.actions} ${empty ? s.actionsEmpty : ''}`}>
          {empty ? (
            <ButtonLink variant="secondary" size="sm" href={`#${ROUTES.problems}`} icon={<ArrowRight />}>
              Open Problems
            </ButtonLink>
          ) : null}
          <ButtonLink variant="ghost" size="sm" href={`#${ROUTES.settings}`} icon={<ArrowUpRight />}>
            Change the cap
          </ButtonLink>
        </div>
      </div>
    </InsightsSection>
  )
}
