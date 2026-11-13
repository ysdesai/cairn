import { ChartTip, useMeasure } from '../../ui'
import { addDays, formatDate } from '../../domain/dates'
import type { ISODate } from '../../state/schema'
import type { StreakStats } from '../../domain/types'
import { useMarkTip } from './useMarkTip'
import s from './Streak.module.css'

const HEIGHT = 30
const R = 5

/** The run of days as a short trail: a filled stone for each active day, joined while the run holds. */
export function StreakStrip({ streak, today }: { streak: StreakStats; today: ISODate }) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const days = streak.recent
  const tip = useMarkTip(days.length, days.length - 1)
  const date = (i: number) => addDays(today, i - (days.length - 1))
  const x = (i: number) => ((i + 0.5) * width) / days.length
  const activeCount = days.filter(Boolean).length
  const label = `Activity over the last ${days.length} days: ${activeCount} active.`

  const describe = (i: number) => {
    const isToday = i === days.length - 1
    const state = days[i] ? 'active' : isToday ? 'not yet' : 'no activity'
    return `${isToday ? 'Today' : formatDate(date(i), 'weekday')} · ${state}`
  }

  return (
    <div ref={tip.wrap} className={s.strip} role="group" aria-label={label} {...tip.group}>
      <div ref={ref} className={s.plot} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
            {days.map((on, i) =>
              on && days[i + 1] ? (
                <line key={`l${i}`} x1={x(i)} x2={x(i + 1)} y1={HEIGHT / 2} y2={HEIGHT / 2} className={s.link} />
              ) : null,
            )}
            {days.map((on, i) => {
              const isToday = i === days.length - 1
              return (
                <g key={i} {...tip.mark(i)} className={s.day}>
                  <rect x={x(i) - width / days.length / 2} y={0} width={width / days.length} height={HEIGHT} fill="transparent" />
                  {on ? (
                    <circle cx={x(i)} cy={HEIGHT / 2} r={R} className={isToday ? s.onToday : s.on} />
                  ) : isToday ? (
                    <circle cx={x(i)} cy={HEIGHT / 2} r={R} className={s.now} />
                  ) : (
                    <circle cx={x(i)} cy={HEIGHT / 2} r={1.8} className={s.off} />
                  )}
                </g>
              )
            })}
          </svg>
        ) : null}
        {tip.active !== null ? (
          <ChartTip x={Math.min(Math.max(x(tip.active), 70), Math.max(70, width - 70))} y={2}>
            <strong>{describe(tip.active)}</strong>
          </ChartTip>
        ) : null}
      </div>
      <div className={s.ends} aria-hidden="true">
        <span className="eyebrow">{days.length - 1} days ago</span>
        <span className="eyebrow">Today</span>
      </div>
    </div>
  )
}
