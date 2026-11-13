import { useMemo } from 'react'
import { cx } from './cx'
import { buildContours, fbm, hill, valueNoise, type ContourShape } from './contours'
import s from './Terrain.module.css'

interface TerrainProps {
  /** Different seeds give different country. Each screen has its own. */
  seed?: number
  /** The drawing's own coordinate size. It is scaled to cover its box. */
  width?: number
  height?: number
  /** Number of contour lines. */
  levels?: number
  /** Size of the landforms, in drawing units. Bigger is gentler. */
  scale?: number
  /** Where the lines fade out. */
  fade?: 'none' | 'down' | 'up' | 'edges' | 'left'
  className?: string
}

const cache = new Map<string, ContourShape[]>()

function contoursFor(seed: number, width: number, height: number, levels: number, scale: number): ContourShape[] {
  const key = `${seed}:${width}:${height}:${levels}:${scale}`
  const hit = cache.get(key)
  if (hit) return hit
  const noise = fbm(valueNoise(seed), 3, 2.1, 0.45)
  const a = hill(width * 0.72, height * 0.3, scale * 0.9)
  const b = hill(width * 0.2, height * 0.75, scale * 0.7)
  const shapes = buildContours({
    width,
    height,
    cell: 10,
    thresholds: levels,
    field: (x, y) => noise(x / scale, y / scale) * 0.75 + a(x, y) * 0.45 + b(x, y) * 0.3,
  })
  cache.set(key, shapes)
  return shapes
}

/**
 * Contour lines as a quiet backdrop. Purely decorative: place it absolutely inside a
 * positioned parent and put content above it.
 */
export function Terrain({ seed = 1, width = 1200, height = 520, levels = 13, scale = 260, fade = 'down', className }: TerrainProps) {
  const shapes = useMemo(() => contoursFor(seed, width, height, levels, scale), [seed, width, height, levels, scale])
  return (
    <svg
      className={cx(s.terrain, s[fade], className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map((shape) => (
        <path key={shape.index} d={shape.d} className={shape.major ? s.major : s.minor} />
      ))}
    </svg>
  )
}
