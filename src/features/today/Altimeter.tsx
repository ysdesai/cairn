import { motion } from 'framer-motion'
import { scaleLinear } from 'd3-scale'
import { useId } from 'react'
import { ChartTip, cx, Ticker } from '../../ui'
import { useMarkTip } from './useMarkTip'
import s from './Altimeter.module.css'

interface AltimeterProps {
  solved: number
  total: number
  /** Where the straight-line plan says you should be today. */
  expected: number
  dayNumber: number
  totalDays: number
  /** Draw the plan marker. Off before the plan has started, when it would claim a position that means nothing. */
  showPlan?: boolean
}

const W = 140
const H = 336
const TOP = 16
const BOTTOM = 26
const AXIS = 36
const TROUGH = 10
const MARK_END = 78
const LABEL_X = 84
const MIN_GAP = 15

/**
 * Progress as altitude: a vertical gauge from base camp (0) to the summit (all problems), with a
 * marker for where you are and one for where the straight-line plan says you should be.
 */
export function Altimeter({ solved, total, expected, dayNumber, totalDays, showPlan = true }: AltimeterProps) {
  const id = useId()
  const y = scaleLinear().domain([0, total]).range([H - BOTTOM, TOP])
  const base = y(0)
  const summit = y(total)
  const youY = y(solved)
  const planY = y(expected)

  // Two labels that would touch are pushed apart, so both stay readable at the true marker heights.
  const gap = Math.abs(youY - planY)
  const push = showPlan && gap < MIN_GAP ? (MIN_GAP - gap) / 2 : 0
  const youLabel = youY + (youY <= planY ? -push : push)
  const planLabel = planY + (planY < youY ? -push : push)

  const ticks: number[] = []
  for (let v = 0; v <= total; v += 5) ticks.push(v)

  const marks = [
    { name: 'You', value: solved, y: youY, text: `You are at ${solved} of ${total}` },
    ...(showPlan ? [{ name: 'Plan', value: expected, y: planY, text: `Day ${Math.min(dayNumber, totalDays)} of ${totalDays}: the plan puts you at ${expected}` }] : []),
  ]
  const tip = useMarkTip(marks.length, 0)
  const shown = tip.active === null ? null : marks[tip.active]
  const summary = `Altimeter from 0 to ${total} problems. You have solved ${solved}.${showPlan ? ` The plan expects ${expected} by today.` : ''}`

  return (
    <div ref={tip.wrap} className={s.wrap} style={{ width: W, height: H }} role="group" aria-label={summary} {...tip.group}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id={`${id}-trough`}>
            <rect x={AXIS} y={summit} width={TROUGH} height={base - summit} />
          </clipPath>
        </defs>

        <rect x={AXIS} y={summit} width={TROUGH} height={base - summit} className={s.trough} />
        <g clipPath={`url(#${id}-trough)`}>
          <motion.rect
            x={AXIS}
            y={youY}
            width={TROUGH}
            height={Math.max(0, base - youY)}
            className={s.fill}
            style={{ transformOrigin: '50% 100%', transformBox: 'fill-box' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>

        {ticks.map((v) => {
          const major = v % 25 === 0
          const heavy = v % 50 === 0
          return (
            <g key={v}>
              <line
                x1={AXIS - (major ? 11 : 5)}
                x2={AXIS}
                y1={y(v)}
                y2={y(v)}
                className={cx(s.tick, major && s.major, heavy && s.heavy)}
              />
              {major ? (
                <text x={AXIS - 16} y={y(v) + 3.5} textAnchor="end" className={s.scale}>
                  {v}
                </text>
              ) : null}
            </g>
          )
        })}
        {total % 25 !== 0 ? (
          <text x={AXIS - 16} y={summit + 3.5} textAnchor="end" className={s.scale}>
            {total}
          </text>
        ) : null}

        <path d={`M${AXIS + TROUGH / 2} ${summit} V${summit - 13}`} className={s.pole} />
        <path d={`M${AXIS + TROUGH / 2} ${summit - 13} l9 2.8 l-9 3.2Z`} className={s.flag} />
        <text x={LABEL_X} y={summit - 7} className={s.edge}>
          Summit
        </text>
        <text x={LABEL_X} y={base + 21} className={s.edge}>
          Base camp
        </text>

        {showPlan ? (
          <g className={s.plan}>
            <line x1={AXIS - 4} x2={MARK_END} y1={planY} y2={planY} />
            <text x={LABEL_X} y={planLabel + 3.5}>
              Plan {expected}
            </text>
          </g>
        ) : null}

        <g className={s.you}>
          <line x1={AXIS + TROUGH} x2={MARK_END} y1={youY} y2={youY} />
          <path d={`M${AXIS + TROUGH} ${youY} l7 -4 v8Z`} />
          <text x={LABEL_X} y={youLabel + 3.5}>
            You {solved}
          </text>
        </g>

        {marks.map((m, i) => (
          <rect
            key={m.name}
            x={AXIS - 6}
            y={m.y - 11}
            width={W - AXIS + 6}
            height={22}
            fill="transparent"
            className={s.hit}
            {...tip.mark(i)}
          />
        ))}
      </svg>
      {/* The tip is held clear of the YOU and PLAN labels, which sit right beside the marker. */}
      {shown ? (
        <ChartTip x={W / 2 + 14} y={shown.y + (shown.y < 70 ? 24 : -24)} below={shown.y < 70}>
          <strong>{shown.text}</strong>
          <span className="num">
            {shown.name === 'You' ? `${Math.round((shown.value / total) * 100)}% of the way up` : `${shown.value >= solved ? shown.value - solved : solved - shown.value} ${shown.value >= solved ? 'ahead of you' : 'behind you'}`}
          </span>
        </ChartTip>
      ) : null}
    </div>
  )
}

/** The big numeral that sits beside the gauge. */
export function Elevation({ solved, total }: { solved: number; total: number }) {
  return (
    <p className={s.elevation}>
      <span className={cx('stat', s.numeral)}>
        <Ticker value={solved} />
      </span>
      <span className={cx('num muted', s.of)}>/ {total}</span>
    </p>
  )
}
