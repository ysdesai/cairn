import { memo, useId, type Ref } from 'react'
import type { Layout } from './layout'
import s from './MapCanvas.module.css'
import type { Terrain } from './terrain'

const pathOf = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')

/**
 * Tints, hillshade, contours, lake, stream and elevation figures. Static: it never re-renders on pan, zoom or selection.
 * The contour lines are drawn in sheet units and kept a constant width on screen through `--ink`, which the camera sets
 * on `groupRef` to 1 / zoom: cheaper to paint than letting the browser undo the zoom on every vertex of every line.
 */
export const TerrainLayer = memo(function TerrainLayer({ layout, terrain, groupRef }: { layout: Layout; terrain: Terrain; groupRef: Ref<SVGGElement> }) {
  const id = useId().replace(/:/g, '')
  const { width: W, height: H } = layout
  const { shade, lake, stream, labels } = terrain
  const minor = terrain.lines.filter((l) => !l.major).map((l) => l.d).join('')
  const major = terrain.lines.filter((l) => l.major).map((l) => l.d).join('')

  // The stream thickens as it gathers water: three reaches, one line weight each.
  const third = Math.floor(stream.length / 3)
  const reaches = [stream.slice(0, third + 1), stream.slice(third, third * 2 + 1), stream.slice(third * 2)]
  const widths = [0.9, 1.25, 1.7]

  const mask = (name: string, href: string) => (
    <mask id={`${id}-${name}`} maskUnits="userSpaceOnUse" x={shade.x} y={shade.y} width={shade.width} height={shade.height}>
      <image href={href} x={shade.x} y={shade.y} width={shade.width} height={shade.height} preserveAspectRatio="none" />
    </mask>
  )

  return (
    <g ref={groupRef} className={s.terrain} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
        {mask('shadow', shade.shadow)}
        {mask('light', shade.light)}
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={0} y={0} width={W} height={H} style={{ fill: 'var(--relief-0)' }} />
        {terrain.bands.map((d, i) => (
          <path key={i} d={d} style={{ fill: `var(--relief-${i + 1})` }} />
        ))}
        <rect className={s.lightFill} x={shade.x} y={shade.y} width={shade.width} height={shade.height} mask={`url(#${id}-light)`} />
        <rect className={s.shadeFill} x={shade.x} y={shade.y} width={shade.width} height={shade.height} mask={`url(#${id}-shadow)`} />
        <path className={s.trees} d={terrain.trees} />
        <path className={`${s.contour} ${s.fine}`} d={terrain.fine} />
        <path className={s.contour} d={minor} />
        <path className={`${s.contour} ${s.index}`} d={major} />

        <g transform={`translate(${lake.x} ${lake.y})`}>
          <path className={s.water} d={lake.shore} />
          {lake.depths.map((d, i) => (
            <path key={i} className={s.depth} d={d} />
          ))}
        </g>
        {reaches.map((reach, i) => (
          <path key={i} className={s.stream} d={pathOf(reach)} style={{ strokeWidth: widths[i] }} />
        ))}
        <text className={s.waterName} x={layout.lake.x} y={layout.lake.y + 4} textAnchor="middle">
          Base Tarn
        </text>

        {labels.map((l) => (
          <text
            key={`${l.text}-${l.x.toFixed(0)}`}
            className={s.elev}
            transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.angle.toFixed(1)})`}
            textAnchor="middle"
            dy="0.35em"
            style={{ stroke: `var(--relief-${Math.max(0, l.band)})` }}
          >
            {l.text}
          </text>
        ))}
      </g>
    </g>
  )
})
