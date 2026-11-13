/**
 * Framing the sheet. The screen puts furniture on top of the drawing (a title block, a legend
 * control, the camera buttons); `fitSheet` finds the largest framing of the whole sheet in which
 * none of that furniture covers a camp, a name, or a trail. It is plain arithmetic over the
 * layout, so it is checked by a test at every size that matters.
 */
import { TOPIC_BY_ID } from '../../../data'
import type { TopicId } from '../../../data/types'
import type { Box, Pt } from './geometry'
import { beaconBox, campFootprint, nameLines, type Layout } from './layout'
import { buildRoutes } from './routes'

/** A rectangle on screen, in pixels from the top left of the canvas. */
export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** The part of the canvas the map may use, in pixels from the canvas's top left. */
export interface Area {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Cam {
  x: number
  y: number
  k: number
}

/** What must stay uncovered, in sheet units. */
export interface Obstacles {
  /** Each camp's symbol, name and counts. */
  camps: { id: TopicId; box: Box }[]
  /** Points along every trail. */
  points: Pt[]
  /** The sheet's own furniture that is worth seeing: the scale bar and the north arrow. */
  marks: Box[]
}

const cache = new Map<string, Obstacles>()

export function obstaclesOf(layout: Layout): Obstacles {
  const hit = cache.get(layout.id)
  if (hit) return hit
  const camps = (Object.keys(layout.camps) as TopicId[]).map((id) => {
    const spot = layout.camps[id]
    const b = campFootprint(spot.side, nameLines(TOPIC_BY_ID[id].short, layout.wrap), ['12/15'])
    return { id, box: { x0: spot.x + b.x0, x1: spot.x + b.x1, y0: spot.y + b.y0, y1: spot.y + b.y1 } }
  })
  const points: Pt[] = []
  for (const route of buildRoutes(layout)) {
    // Every few points is plenty: the line is sampled much finer than a camp is wide.
    route.line.forEach((p, i) => {
      if (i % 3 === 0 || i === route.line.length - 1) points.push(p)
    })
  }
  const out = { camps, points, marks: marksOf(layout) }
  cache.set(layout.id, out)
  return out
}

/** The scale bar and the north arrow, as boxes in sheet units. */
export function marksOf(layout: Layout): Box[] {
  const [sx, sy] = layout.scale
  const [nx, ny] = layout.north
  const note = layout.margin >= 40 ? 8 : 30
  return [
    { x0: sx - 6, x1: sx + layout.scaleKm * 100 + 30, y0: sy - 18, y1: sy + note },
    { x0: nx - 12, x1: nx + 12, y0: ny - 52, y1: ny + 4 },
  ]
}

/** The flag over the camp the user is at, in sheet units. */
export function beaconOf(layout: Layout, id: TopicId): Box {
  const spot = layout.camps[id]
  const b = beaconBox(spot.side)
  return { x0: spot.x + b.x0, x1: spot.x + b.x1, y0: spot.y + b.y0, y1: spot.y + b.y1 }
}

const PAD = 10
/** How far a trail or a camp must stay from furniture, in screen pixels. */
const CLEAR = 6
/** The smallest the map may be made to make room, as a share of the plain fit. */
const FLOOR = 0.7
/** The most of the map that keeping the scale bar and north arrow clear is worth. */
const MARKS_FLOOR = 0.94

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

/** The largest zoom at which the whole sheet fits an area, and where it then sits when centred. */
export function plainFit(layout: Layout, area: Area): Cam {
  const m = layout.margin
  const sw = layout.width + m * 2
  const sh = layout.height + m * 2
  const aw = Math.max(1, area.right - area.left)
  const ah = Math.max(1, area.bottom - area.top)
  const k = Math.max(0.05, Math.min((aw - PAD * 2) / sw, (ah - PAD * 2) / sh))
  return { k, x: area.left + (aw - sw * k) / 2 + m * k, y: area.top + (ah - sh * k) / 2 + m * k }
}

/** Where, across the spare room, the sheet may sit: the middle first, then nearer and nearer the edges. */
const SPOTS: readonly (readonly [number, number])[] = (() => {
  const steps = [0, 0.25, 0.5, 0.75, 1]
  const all = steps.flatMap((x) => steps.map((y) => [x, y] as const))
  return all.sort((a, b) => (a[0] - 0.5) ** 2 + (a[1] - 0.5) ** 2 - ((b[0] - 0.5) ** 2 + (b[1] - 0.5) ** 2))
})()

/**
 * How many camps, names and trail points a framing leaves under the furniture. With `marks`, the
 * scale bar and the north arrow count too: worth keeping clear, but not worth a much smaller map.
 */
export function covered(layout: Layout, cam: Cam, reserved: readonly Rect[], here: TopicId | null, marks = true): number {
  if (reserved.length === 0) return 0
  const obs = obstaclesOf(layout)
  const pad = CLEAR / cam.k
  let count = 0
  for (const r of reserved) {
    const box: Box = { x0: (r.x0 - cam.x) / cam.k - pad, x1: (r.x1 - cam.x) / cam.k + pad, y0: (r.y0 - cam.y) / cam.k - pad, y1: (r.y1 - cam.y) / cam.k + pad }
    for (const camp of obs.camps) if (overlaps(camp.box, box)) count++
    if (marks) for (const mark of obs.marks) if (overlaps(mark, box)) count++
    if (here && overlaps(beaconOf(layout, here), box)) count++
    for (const [x, y] of obs.points) if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) count++
  }
  return count
}

/** The largest framing, searching from the plain fit downward to `floor` of it, with nothing under the furniture. */
function search(layout: Layout, area: Area, reserved: readonly Rect[], here: TopicId | null, base: Cam, floor: number, marks: boolean) {
  const m = layout.margin
  const sw = layout.width + m * 2
  const sh = layout.height + m * 2
  const aw = Math.max(1, area.right - area.left) - PAD * 2
  const ah = Math.max(1, area.bottom - area.top) - PAD * 2
  let best: { cam: Cam; count: number } = { cam: base, count: Infinity }
  for (let k = base.k; k >= base.k * floor; k *= 0.99) {
    const slackX = Math.max(0, aw - sw * k)
    const slackY = Math.max(0, ah - sh * k)
    for (const [fx, fy] of SPOTS) {
      const cam: Cam = { k, x: area.left + PAD + slackX * fx + m * k, y: area.top + PAD + slackY * fy + m * k }
      const count = covered(layout, cam, reserved, here, marks)
      if (count === 0) return { cam, count }
      if (count < best.count) best = { cam, count }
    }
  }
  return best
}

/**
 * Frame the whole sheet in `area`, as large as it can be while no `reserved` rectangle covers
 * a camp, its name, or a trail. The scale bar and north arrow are kept clear too unless that
 * would cost more than a few percent of the map. Falls back to the least covered framing.
 */
export function fitSheet(layout: Layout, area: Area, reserved: readonly Rect[], here: TopicId | null = null): Cam {
  const base = plainFit(layout, area)
  if (reserved.length === 0 || covered(layout, base, reserved, here) === 0) return base
  const tidy = search(layout, area, reserved, here, base, MARKS_FLOOR, true)
  if (tidy.count === 0) return tidy.cam
  return search(layout, area, reserved, here, base, FLOOR, false).cam
}
