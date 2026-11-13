import { useMemo } from 'react'
import { addDays, diffDays, formatDate, formatMinutes, startOfWeek, weekdayIndex } from '../../domain/dates'
import { useDerived } from '../../state/hooks'
import { ChartTip, useMeasure } from '../../ui'
import { useCursor } from './PlanCursor'
import InsightsSection from './InsightsSection'
import s from './ActivitySection.module.css'

const MAX_WEEKS = 26
const MIN_CELL = 12
const MAX_CELL = 26
const GAP = 3
const LABEL_W = 24
const TOP = 18
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

const word = (n: number) => WORDS[n] ?? String(n)
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Four steps of ember by how busy the day was against the busiest day on record. */
function step(total: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0
  const r = total / max
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4
}

export default function ActivitySection() {
  const { activity, streak, today } = useDerived()
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const empty = activity.activeDays === 0

  // Weeks that fit: all 26 when the cells stay legible, fewer on a narrow screen.
  const weeks = useMemo(() => {
    if (width === 0) return 0
    const room = width - LABEL_W + GAP
    return Math.max(8, Math.min(MAX_WEEKS, Math.floor(room / (MIN_CELL + GAP))))
  }, [width])
  const cell = weeks === 0 ? MIN_CELL : Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((width - LABEL_W + GAP) / weeks) - GAP))
  const pitch = cell + GAP

  const firstMonday = addDays(startOfWeek(today), -(weeks - 1) * 7)
  const todayRow = weekdayIndex(today)
  const lastIndex = (weeks - 1) * 7 + todayRow
  const cursor = useCursor({ length: lastIndex + 1, start: lastIndex, steps: { left: 7, right: 7, up: 1, down: 1 } })

  const grid = useMemo(() => {
    const out: { date: string; col: number; row: number; i: number }[] = []
    for (let i = 0; i <= lastIndex; i++) out.push({ date: addDays(firstMonday, i), col: Math.floor(i / 7), row: i % 7, i })
    return out
  }, [firstMonday, lastIndex])

  const months = useMemo(() => {
    const out: { col: number; label: string }[] = []
    let prev = ''
    for (let col = 0; col < weeks; col++) {
      const date = addDays(firstMonday, col * 7)
      const month = date.slice(0, 7)
      if (month === prev) continue
      prev = month
      // A label that would crowd the next one is skipped.
      if (out.length && col - out[out.length - 1].col < 3) out.pop()
      out.push({ col, label: formatDate(date, 'month') })
    }
    return out
  }, [firstMonday, weeks])

  const windowStats = useMemo(() => {
    let active = 0
    let minutes = 0
    for (const g of grid) {
      const d = activity.days[g.date]
      if (d && d.total > 0) {
        active += 1
        minutes += d.minutes
      }
    }
    return { active, minutes }
  }, [grid, activity])

  const gridWidth = LABEL_W + weeks * pitch - GAP
  const gridHeight = TOP + 7 * pitch - GAP
  const activeDate = cursor.index != null ? grid[cursor.index]?.date : null

  let tip: { x: number; y: number; below: boolean } | null = null
  if (cursor.index != null && grid[cursor.index]) {
    const g = grid[cursor.index]
    const x = LABEL_W + g.col * pitch + cell / 2
    tip = { x: Math.max(120, Math.min(width - 120, x)), y: TOP + g.row * pitch, below: g.row < 2 }
  }

  const tipText = (date: string) => {
    const d = activity.days[date]
    const when = formatDate(date, 'weekday')
    if (!d || d.total === 0) return <strong>{when} · no activity</strong>
    return (
      <>
        <strong>{when}</strong>
        <span className="num">
          {d.solves} solved, {d.reviews} revised{d.minutes > 0 ? ` · ${formatMinutes(d.minutes)}` : ''}
        </span>
      </>
    )
  }

  const title = empty ? (
    <>
      Every day you work fills <em>a square</em>.
    </>
  ) : streak.current > 0 ? (
    <>
      <em>{days(streak.current)}</em> running.
    </>
  ) : (
    <>
      The next streak starts with <em>one solve</em>.
    </>
  )

  const streakNote =
    streak.current === 0
      ? streak.best > 0
        ? 'Log something today to start a new streak.'
        : null
      : streak.activeToday
        ? 'Today is on the board.'
        : `Log something today to make it ${word(streak.current + 1)}.`

  const summary = `Activity over the last ${weeks} weeks: ${windowStats.active} active days, ${formatMinutes(windowStats.minutes)} logged. Current streak ${days(streak.current)}, best ${days(streak.best)}. Arrow keys move between days.`

  return (
    <InsightsSection
      id="activity"
      eyebrow="Activity"
      title="Your climbing days"
      aside={weeks ? <span className="num">{weeks} weeks to {formatDate(today)}</span> : undefined}
      lede={title}
    >

      <div className={s.layout}>
        <div className={s.map}>
          <div className={s.measure} ref={ref}>
            {weeks > 0 ? (
              <div className={s.wrap} style={{ width: gridWidth, height: gridHeight }}>
                <div
                  className={s.plot}
                  role="group"
                  aria-label={summary}
                  {...cursor.props}
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const col = Math.floor((e.clientX - rect.left - LABEL_W) / pitch)
                    const row = Math.floor((e.clientY - rect.top - TOP) / pitch)
                    const i = col * 7 + row
                    if (col < 0 || col >= weeks || row < 0 || row > 6 || i > lastIndex) cursor.set(null)
                    else cursor.set(i)
                  }}
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const col = Math.floor((e.clientX - rect.left - LABEL_W) / pitch)
                    const row = Math.floor((e.clientY - rect.top - TOP) / pitch)
                    const i = col * 7 + row
                    if (col >= 0 && col < weeks && row >= 0 && row <= 6 && i <= lastIndex) cursor.set(i)
                  }}
                >
                  <svg width={gridWidth} height={gridHeight} aria-hidden="true">
                    {months.map((m) => (
                      <text key={m.col} className={s.label} x={LABEL_W + m.col * pitch} y={9}>
                        {m.label}
                      </text>
                    ))}
                    {[0, 2, 4].map((row) => (
                      <text key={row} className={s.label} x={0} y={TOP + row * pitch + cell / 2} dy="0.35em">
                        {'MWF'[row / 2]}
                      </text>
                    ))}
                    {grid.map((g) => {
                      const d = activity.days[g.date]
                      const level = step(d?.total ?? 0, activity.max)
                      const x = LABEL_W + g.col * pitch
                      const y = TOP + g.row * pitch
                      return (
                        <rect
                          key={g.date}
                          className={`${s.cell} ${s[`step${level}`]}${g.date === today ? ` ${s.today}` : ''}`}
                          x={x + 0.5}
                          y={y + 0.5}
                          width={cell - 1}
                          height={cell - 1}
                          rx={Math.max(2, cell / 5)}
                        />
                      )
                    })}
                    {cursor.index != null && grid[cursor.index] ? (
                      <rect
                        className={s.cursor}
                        x={LABEL_W + grid[cursor.index].col * pitch - 1.5}
                        y={TOP + grid[cursor.index].row * pitch - 1.5}
                        width={cell + 3}
                        height={cell + 3}
                        rx={Math.max(3, cell / 5 + 1)}
                      />
                    ) : null}
                  </svg>
                </div>
                {tip && activeDate ? (
                  <ChartTip x={tip.x} y={tip.y} below={tip.below}>
                    {tipText(activeDate)}
                  </ChartTip>
                ) : null}
              </div>
            ) : (
              <div style={{ height: 7 * 15 + TOP }} />
            )}
          </div>

          <div className={s.caption}>
            <span className={`num ${s.range}`}>
              {formatDate(firstMonday)} to {formatDate(today)}
            </span>
            <span className={s.legend} aria-hidden="true">
              Fewer
              {[0, 1, 2, 3, 4].map((n) => (
                <svg key={n} width="11" height="11">
                  <rect className={`${s.cell} ${s[`step${n}`]}`} x="0.5" y="0.5" width="10" height="10" rx="2.5" />
                </svg>
              ))}
              More
            </span>
          </div>
        </div>

        {empty ? (
          <p className={s.lede}>
            A solve or a revision fills a square, darker on busier days. Your first one lands on today, <span className="num">{formatDate(today)}</span>.
          </p>
        ) : (
          <div className={s.side}>
            <dl className={s.figures}>
              <div className={`${s.figure} ${s.streak}`}>
                <dt className="eyebrow">Streak</dt>
                <dd>
                  <span className={`stat ${s.big}`}>{streak.current}</span>
                  <span className={`num ${s.unit}`}>{streak.current === 1 ? 'day' : 'days'}</span>
                  <span className={`num muted ${s.unit}`}>best {streak.best}</span>
                </dd>
              </div>
              <div className={s.figure}>
                <dt className="eyebrow">Active days</dt>
                <dd>
                  <span className={`stat ${s.mid}`}>{windowStats.active}</span>
                  <span className={`num muted ${s.unit}`}>of {diffDays(firstMonday, today) + 1}</span>
                </dd>
              </div>
              <div className={s.figure}>
                <dt className="eyebrow">Time logged</dt>
                <dd>
                  <span className={`stat ${s.mid}`}>{formatMinutes(windowStats.minutes)}</span>
                  <span className={`num muted ${s.unit}`}>{weeks} weeks</span>
                </dd>
              </div>
            </dl>
            {streakNote ? <p className={s.note}>{streakNote}</p> : null}
          </div>
        )}
      </div>
    </InsightsSection>
  )
}
