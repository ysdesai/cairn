import { memo } from 'react'
import s from './MapCanvas.module.css'
import type { Route } from './routes'

/**
 * walked: the camp behind is complete and this one is begun. A solid ember line with chevrons.
 * open: this camp is ready or under way but the leg is not walked yet. Dashes.
 * ahead: everything else. Dots.
 */
export type TrailState = 'walked' | 'open' | 'ahead'

interface TrailProps {
  route: Route
  state: TrailState
  tone: 'rest' | 'hot' | 'dim'
}

const CHEVRON = 'M-3.2 -3.4 L1.8 0 L-3.2 3.4'

export const Trail = memo(function Trail({ route, state, tone }: TrailProps) {
  const className = [s.trail, s[state], tone === 'hot' && s.trailHot, tone === 'dim' && s.trailDim].filter(Boolean).join(' ')
  return (
    <g className={className} data-trail={route.key} data-state={state}>
      <path className={s.trailCase} d={route.d} />
      {state === 'walked' ? <path className={s.trailGlow} d={route.d} /> : null}
      <path className={s.trailLine} d={route.d} />
      {state === 'walked'
        ? route.chevrons.map((c, i) => (
            <path key={i} className={s.chevron} d={CHEVRON} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${c.angle.toFixed(1)})`} />
          ))
        : null}
    </g>
  )
})

/** A short stretch of trail, drawn with the map's own strokes, for the legend. */
export function TrailMark({ state, width = 56 }: { state: TrailState; width?: number }) {
  const d = 'M3 8 L53 8'
  return (
    <svg className={s.trailMark} width={width} height={16} viewBox="0 0 56 16" aria-hidden="true" focusable="false">
      <g className={`${s[state]} ${s.trail}`}>
        <path className={s.trailCase} d={d} />
        {state === 'walked' ? <path className={s.trailGlow} d={d} /> : null}
        <path className={s.trailLine} d={d} />
        {state === 'walked' ? (
          <>
            <path className={s.chevron} d={CHEVRON} transform="translate(19 8)" />
            <path className={s.chevron} d={CHEVRON} transform="translate(39 8)" />
          </>
        ) : null}
      </g>
    </svg>
  )
}
