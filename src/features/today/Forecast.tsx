import { scaleLinear } from 'd3-scale'
import { useId } from 'react'
import { ChartTip, cx as cn, useMeasure } from '../../ui'
import { formatDate, weekdayIndex } from '../../domain/dates'
import type { ForecastDay } from '../../domain/types'
import { useMarkTip } from './useMarkTip'
import s from './Forecast.module.css'

const PLOT_FULL = 92
/** With nothing scheduled the plot shrinks to a ruled strip instead of an empty field. */
const PLOT_EMPTY = 36
const LABELS = 34
const INITIALS = 'MTWTFSS'

/** The next two weeks of revisions: scheduled ones solid, ones held back by the cap hatched above them. */
export function Forecast({ days, cap }: { days: ForecastDay[]; cap: number }) {
  const id = useId()
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const tip = useMarkTip(days.length, 0)

  const busy = days.some((d) => d.scheduled + d.carried > 0)
  const PLOT = busy ? PLOT_FULL : PLOT_EMPTY
  const HEIGHT = PLOT + LABELS
  const peak = Math.max(cap, ...days.map((d) => d.scheduled + d.carried), 1)
  // The top 16px is kept clear for the count above the tallest bar.
  const y = scaleLinear().domain([0, peak]).range([PLOT, 16])
  const band = width / days.length
  const barW = Math.min(14, Math.max(6, band * 0.52))
  const cx = (i: number) => (i + 0.5) * band
  const total = days.reduce((sum, d) => sum + d.scheduled, 0)
  const busiest = days.reduce((best, d) => (d.scheduled > best.scheduled ? d : best), days[0])
  const label = `Revisions over the next ${days.length} days, with the daily cap of ${cap} applied: ${total} scheduled, the most on ${formatDate(busiest.date, 'weekday')} with ${busiest.scheduled}.`

  const active = tip.active === null ? null : days[tip.active]
  const anyHeld = days.some((d) => d.carried > 0)

  return (
    <div className={s.root}>
      <div ref={tip.wrap} className={s.chart} role="group" aria-label={label} {...tip.group}>
        <div ref={ref} className={s.plot} style={{ height: HEIGHT }}>
          {width > 0 ? (
            <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
              <defs>
                <pattern id={`${id}-hatch`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="4" className={s.hatch} />
                </pattern>
              </defs>
              <line x1={0} x2={width} y1={PLOT + 0.5} y2={PLOT + 0.5} className={s.base} />
              <line x1={0} x2={width} y1={y(cap)} y2={y(cap)} className={s.cap} />
              <text x={width} y={y(cap) - 5} textAnchor="end" className={s.capLabel}>
                Cap {cap}
              </text>

              {days.map((d, i) => {
                const solid = d.scheduled > 0 ? PLOT - y(d.scheduled) : 0
                const held = d.carried > 0 ? PLOT - y(d.carried) : 0
                const today = i === 0
                return (
                  <g key={d.date} {...tip.mark(i)} className={s.day} data-active={tip.active === i || undefined}>
                    <rect x={i * band} y={0} width={band} height={HEIGHT} fill="transparent" />
                    {d.scheduled === 0 && d.carried === 0 ? <line x1={cx(i) - barW / 2} x2={cx(i) + barW / 2} y1={PLOT - 0.5} y2={PLOT - 0.5} className={s.none} /> : null}
                    {solid > 0 ? <rect x={cx(i) - barW / 2} y={PLOT - solid} width={barW} height={solid} className={cn(s.solid, today && s.solidToday)} /> : null}
                    {held > 0 ? (
                      <rect
                        x={cx(i) - barW / 2 + 0.5}
                        y={PLOT - solid - held + 0.5}
                        width={barW - 1}
                        height={Math.max(0, held - 1)}
                        fill={`url(#${id}-hatch)`}
                        className={s.held}
                      />
                    ) : null}
                    {d.scheduled > 0 ? (
                      <text x={cx(i)} y={y(d.scheduled + d.carried) - 4} textAnchor="middle" className={cn(s.count, today && s.today)}>
                        {d.scheduled}
                      </text>
                    ) : null}
                    <text x={cx(i)} y={PLOT + 15} textAnchor="middle" className={today ? s.today : s.initial}>
                      {INITIALS[weekdayIndex(d.date)]}
                    </text>
                    <text x={cx(i)} y={PLOT + 28} textAnchor="middle" className={cn(s.date, today && s.today)}>
                      {Number(d.date.slice(8))}
                    </text>
                  </g>
                )
              })}
            </svg>
          ) : null}
          {active ? (
            <ChartTip x={Math.min(Math.max(cx(tip.active ?? 0), 78), Math.max(78, width - 78))} y={y(active.scheduled + active.carried)}>
              <strong>{tip.active === 0 ? 'Today' : formatDate(active.date, 'weekday')}</strong>
              <span className="num">
                {active.scheduled} {active.scheduled === 1 ? 'revision' : 'revisions'}
                {active.carried > 0 ? ` · ${active.carried} waiting` : ''}
              </span>
            </ChartTip>
          ) : null}
        </div>
      </div>
      <ul className={s.legend} aria-hidden="true">
        <li>
          <span className={cn(s.swatch, s.swSolid)} /> Revisions that day
        </li>
        {anyHeld ? (
          <li>
            <span className={cn(s.swatch, s.swHeld)} /> Waiting past the cap
          </li>
        ) : null}
        <li>
          <span className={cn(s.swatch, s.swCap)} /> Cap {cap} a day
        </li>
      </ul>
    </div>
  )
}
