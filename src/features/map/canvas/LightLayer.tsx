import { memo, useId } from 'react'
import type { Layout } from './layout'
import type { Glow } from './light'
import { starsFor } from './light'
import s from './MapCanvas.module.css'

interface LightProps {
  layout: Layout
  glows: Glow[]
  /** Full paths of the trails that have been walked: the light follows them. */
  walked: string[]
}

/**
 * The light layer, between the terrain and the trails. By day it is low sun on paper, a faint
 * warm wash; by night it is the lit country, ember and amber against the dark. It is built from
 * radial gradients and a few wide, soft strokes (no blur filters), so panning costs nothing.
 */
export const LightLayer = memo(function LightLayer({ layout, glows, walked }: LightProps) {
  const id = useId().replace(/:/g, '')
  const { width: W, height: H } = layout
  return (
    <g className={s.light} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" style={{ stopColor: 'var(--glow-2)', stopOpacity: 0.5 }} />
          <stop offset="0.28" style={{ stopColor: 'var(--glow-2)', stopOpacity: 0.32 }} />
          <stop offset="0.6" style={{ stopColor: 'var(--glow-2)', stopOpacity: 0.11 }} />
          <stop offset="1" style={{ stopColor: 'var(--glow-2)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" style={{ stopColor: 'var(--glow-1)', stopOpacity: 0.7 }} />
          <stop offset="0.5" style={{ stopColor: 'var(--glow-1)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--glow-1)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={`${id}-alpen`}>
          <stop offset="0" style={{ stopColor: 'var(--glow-1)', stopOpacity: 0.62 }} />
          <stop offset="0.34" style={{ stopColor: 'var(--glow-2)', stopOpacity: 0.36 }} />
          <stop offset="0.68" style={{ stopColor: 'var(--glow-3)', stopOpacity: 0.13 }} />
          <stop offset="1" style={{ stopColor: 'var(--glow-3)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <g className={s.pools}>
          {glows.map((g) => (
            <circle key={g.id} cx={g.x} cy={g.y} r={g.r} opacity={g.i} style={{ fill: `url(#${id}-${g.alpen ? 'alpen' : 'pool'})` }} />
          ))}
          {glows
            .filter((g) => g.core)
            .map((g) => (
              <circle key={`core-${g.id}`} cx={g.x} cy={g.y} r={g.r * 0.42} opacity={g.i} style={{ fill: `url(#${id}-core)` }} />
            ))}
        </g>
        {walked.length > 0 ? (
          <g className={s.bloom}>
            <path className={s.bloomWide} d={walked.join('')} />
            <path className={s.bloomMid} d={walked.join('')} />
            <path className={s.bloomCore} d={walked.join('')} />
          </g>
        ) : null}
      </g>
    </g>
  )
})

/** A few stars above the highest summit, by night only. */
export const Stars = memo(function Stars({ layout }: { layout: Layout }) {
  const id = useId().replace(/:/g, '')
  const stars = starsFor(layout)
  return (
    <g className={s.sky} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--paper-deep)', stopOpacity: 0.78 }} />
          <stop offset="1" style={{ stopColor: 'var(--paper-deep)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={layout.width} height={layout.height * 0.3} style={{ fill: `url(#${id}-sky)` }} />
      <g className={s.stars}>
        {stars.map((star, i) =>
          star.cross ? (
            <path
              key={i}
              className={star.twinkle ? s.twinkle : undefined}
              d={`M${(star.x - 4.5).toFixed(1)} ${star.y.toFixed(1)}H${(star.x + 4.5).toFixed(1)}M${star.x.toFixed(1)} ${(star.y - 4.5).toFixed(1)}V${(star.y + 4.5).toFixed(1)}`}
            />
          ) : (
            <circle key={i} className={star.twinkle ? s.twinkle : undefined} cx={star.x} cy={star.y} r={star.r} />
          ),
        )}
      </g>
    </g>
  )
})
