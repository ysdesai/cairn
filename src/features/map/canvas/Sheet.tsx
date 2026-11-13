import { memo } from 'react'
import type { Layout } from './layout'
import s from './MapCanvas.module.css'

/** One kilometre on the sheet, in sheet units. */
const KM = 100

/** The paper the map is printed on, margin included. Sits under the terrain. */
export const SheetUnder = memo(function SheetUnder({ layout }: { layout: Layout }) {
  const m = layout.margin
  return (
    <g aria-hidden="true">
      <rect className={s.paper} x={-m} y={-m} width={layout.width + m * 2} height={layout.height + m * 2} />
      <rect className={s.paperEdge} x={-m} y={-m} width={layout.width + m * 2} height={layout.height + m * 2} />
    </g>
  )
})

/**
 * Grid, neatline with graduated ticks, grid numbers, the contour note, scale bar and north arrow.
 * Sits over the terrain. The sheet's own title is the screen's title block, so the margin has none.
 */
export const SheetOver = memo(function SheetOver({ layout }: { layout: Layout }) {
  const { width: W, height: H, grid, margin: m } = layout
  const outer = m * 0.3
  const wide = m >= 40
  const cols = Math.floor(W / grid)
  const rows = Math.floor(H / grid)
  const subs = 10
  const sub = grid / subs

  const ticks: React.ReactNode[] = []
  for (let x = 0; x <= W; x += sub) {
    const major = Math.abs(x % grid) < 0.01
    const len = major ? outer : x % (grid / 2) < 0.01 ? outer * 0.7 : outer * 0.4
    ticks.push(<line key={`tx${x}`} className={s.tick} x1={x} x2={x} y1={0} y2={-len} />)
    ticks.push(<line key={`bx${x}`} className={s.tick} x1={x} x2={x} y1={H} y2={H + len} />)
  }
  for (let y = 0; y <= H; y += sub) {
    const major = Math.abs(y % grid) < 0.01
    const len = major ? outer : y % (grid / 2) < 0.01 ? outer * 0.7 : outer * 0.4
    ticks.push(<line key={`ly${y}`} className={s.tick} x1={0} x2={-len} y1={y} y2={y} />)
    ticks.push(<line key={`ry${y}`} className={s.tick} x1={W} x2={W + len} y1={y} y2={y} />)
  }

  const vertical: React.ReactNode[] = []
  const horizontal: React.ReactNode[] = []
  const numbers: React.ReactNode[] = []
  for (let i = 1; i <= cols; i++) {
    const x = i * grid
    if (x >= W) break
    vertical.push(<line key={i} className={s.gridLine} x1={x} x2={x} y1={0} y2={H} />)
  }
  for (let j = 1; j <= rows; j++) {
    const y = j * grid
    if (y >= H) break
    horizontal.push(<line key={j} className={s.gridLine} x1={0} x2={W} y1={y} y2={y} />)
  }
  // Grid numbers read like a printed sheet's easting and northing, large digits last.
  for (let i = 0; i <= cols; i++) {
    const x = i * grid
    if (x > W) break
    const label = String(30 + Math.round(x / grid))
    numbers.push(
      <text key={`nt${i}`} className={s.gridNum} x={x} y={-outer - 6} textAnchor="middle">
        {label}
      </text>,
      <text key={`nb${i}`} className={s.gridNum} x={x} y={H + outer + 14} textAnchor="middle">
        {label}
      </text>,
    )
  }
  for (let j = 0; j <= rows; j++) {
    const y = j * grid
    if (y > H) break
    const label = String(60 + Math.round((H - y) / grid))
    numbers.push(
      <text key={`nl${j}`} className={s.gridNum} x={-outer - 6} y={y + 3.5} textAnchor="end">
        {label}
      </text>,
      <text key={`nr${j}`} className={s.gridNum} x={W + outer + 6} y={y + 3.5} textAnchor="start">
        {label}
      </text>,
    )
  }

  const [sx, sy] = layout.scale
  const km = layout.scaleKm
  const bar = km * KM
  const [nx, ny] = layout.north

  return (
    <g aria-hidden="true">
      {vertical}
      {horizontal}
      <rect className={s.neatOuter} x={-outer} y={-outer} width={W + outer * 2} height={H + outer * 2} />
      <rect className={s.neat} x={0} y={0} width={W} height={H} />
      {ticks}
      {numbers}
      {wide ? (
        <text className={s.note} x={W / 2} y={H + m - 8} textAnchor="middle">
          Contour interval 100 m · Index every 500 m
        </text>
      ) : null}

      {/* Scale bar: every other half-kilometre filled, a figure at each kilometre. */}
      <g transform={`translate(${sx} ${sy})`}>
        <rect className={s.scaleLine} x={0} y={-3} width={bar} height={6} fill="none" />
        {Array.from({ length: km }, (_, i) => (
          <rect key={i} className={s.scaleFill} x={i * KM} y={-3} width={KM / 2} height={6} />
        ))}
        {Array.from({ length: km + 1 }, (_, i) => (
          <text key={i} className={s.scaleNum} x={i * KM} y={-9} textAnchor="middle">
            {i}
          </text>
        ))}
        <text className={s.scaleNum} x={bar + 8} y={3}>
          km
        </text>
        {wide ? null : (
          <text className={s.note} x={0} y={22}>
            Contour interval 100 m
          </text>
        )}
      </g>

      {/* North arrow: a half-filled head on a plain staff. */}
      <g transform={`translate(${nx} ${ny})`}>
        <line className={s.northLine} x1={0} y1={0} x2={0} y2={-34} />
        <path className={s.northHalf} d="M0 -38 L-6 -22 L0 -26 Z" />
        <path className={s.northLine} d="M0 -38 L6 -22 L0 -26" fill="none" />
        <text className={s.northLetter} x={0} y={-45} textAnchor="middle">
          N
        </text>
      </g>
    </g>
  )
})
