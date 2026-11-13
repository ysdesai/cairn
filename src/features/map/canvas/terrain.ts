/**
 * The land under the camps, built once per composition from a height field that is itself built
 * around the camp positions: a peak under every camp, a ridge under every trail, a low valley at
 * base camp with a lake in it, and a stream cut down to the lake.
 *
 * The field is sampled once on a grid, its pits are filled so water could always run out, and the
 * grid is traced into contour lines (every hundred metres, every fifth one an index line). The
 * index lines double as the edges of the hypsometric tints, and the same grid gives a soft
 * hillshade. Nothing here depends on the theme: colours arrive through CSS variables.
 */
import { TOPIC_BY_ID } from '../../../data'
import type { TopicId } from '../../../data/types'
import { mulberry32 } from '../../../domain/rng'
import { buildContours, fbm, hill, valueNoise } from '../../../ui'
import { boxesOverlap, curveThrough, distToLine, lineHitsBox, type Box, type Pt } from './geometry'
import { labelLines, nameLines, RING, type Composition, type Layout } from './layout'
import { buildRoutes } from './routes'
import { simplifyPath } from './simplify'

/** Contours every INTERVAL metres, an index line every fifth. */
const INTERVAL = 100
const BASE_ELEVATION = 1000
const LINES = 35
const MAJOR_EVERY = 5
/** Grid margin buildContours adds beyond each edge, in cells. */
const MARGIN = 3
const SHADE_LIFT = 1.6
const SHADE_GAIN = 2.4
/** How far a thinned contour may stray from the traced one, in sheet units: well under a pixel at any zoom. */
const THIN = 0.45

export interface ElevationLabel {
  x: number
  y: number
  /** Degrees, kept upright. */
  angle: number
  text: string
  /** The tint band whose lower edge the figure sits on. */
  band: number
}

export interface Terrain {
  id: Composition
  /** Regions at or above each index contour, lowest first: the hypsometric tints. */
  bands: string[]
  lines: { d: string; major: boolean; band: number }[]
  /** Supplementary contours halfway between the others, drawn only close up. */
  fine: string
  /** Soft hillshade as two luminance masks over the whole mapped area. */
  shade: { shadow: string; light: string; x: number; y: number; width: number; height: number }
  lake: { x: number; y: number; shore: string; depths: string[] }
  stream: Pt[]
  /** Woodland in the valleys, as one path of small dots. */
  trees: string
  labels: ElevationLabel[]
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A line of at most `count` points along a polyline: all the height field needs of a ridge. */
function coarsen(line: readonly Pt[], count: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < count; i++) out.push(line[Math.round((i / (count - 1)) * (line.length - 1))])
  return out
}

interface Ridge {
  pts: Pt[]
  from: number
  to: number
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Distance from a point to the nearest part of a coarse polyline, and how far along it that is (0…1). */
function nearest(px: number, py: number, pts: readonly Pt[]): { d2: number; at: number } {
  let best = Infinity
  let at = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2))
    const d2 = (a[0] + dx * t - px) ** 2 + (a[1] + dy * t - py) ** 2
    if (d2 < best) {
      best = d2
      at = (i - 1 + t) / (pts.length - 1)
    }
  }
  return { d2: best, at }
}

/** A point is inside the lake where this is above zero. It is rotated, wobbly and deepest in the middle. */
function lakeDepth(layout: Layout, wobble: (x: number, y: number) => number) {
  const { x: cx, y: cy, rx, ry, turn } = layout.lake
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return (x: number, y: number) => {
    const dx = x - cx
    const dy = y - cy
    const u = (dx * cos + dy * sin) / rx
    const v = (-dx * sin + dy * cos) / ry
    const q = Math.sqrt(u * u + v * v) + (wobble(x / 38, y / 38) - 0.5) * 0.55
    return 1 - q
  }
}

/**
 * Raise every pit to the level at which water would spill out of it, so no closed hollow is
 * left to be mistaken for a hill. (Priority flood, with a tiny slope so filled floors still drain.)
 */
function fillPits(values: Float32Array, cols: number, rows: number): Float32Array {
  const out = Float32Array.from(values)
  const seen = new Uint8Array(cols * rows)
  const heap: number[] = []
  const less = (a: number, b: number) => out[a] < out[b]
  const push = (i: number) => {
    heap.push(i)
    let k = heap.length - 1
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (!less(heap[k], heap[parent])) break
      ;[heap[k], heap[parent]] = [heap[parent], heap[k]]
      k = parent
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let k = 0
      for (;;) {
        const l = k * 2 + 1
        const r = l + 1
        let m = k
        if (l < heap.length && less(heap[l], heap[m])) m = l
        if (r < heap.length && less(heap[r], heap[m])) m = r
        if (m === k) break
        ;[heap[k], heap[m]] = [heap[m], heap[k]]
        k = m
      }
    }
    return top
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i === 0 || j === 0 || i === cols - 1 || j === rows - 1) {
        seen[j * cols + i] = 1
        push(j * cols + i)
      }
    }
  }
  while (heap.length) {
    const c = pop()
    const ci = c % cols
    const cj = (c - ci) / cols
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = ci + di
        const nj = cj + dj
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue
        const n = nj * cols + ni
        if (seen[n]) continue
        seen[n] = 1
        if (out[n] <= out[c]) out[n] = out[c] + 1e-5
        push(n)
      }
    }
  }
  return out
}

export function buildTerrain(layout: Layout): Terrain {
  const { width, height, cell, unit, seed } = layout
  const ids = Object.keys(layout.camps) as TopicId[]

  const elevation = (id: TopicId) => {
    const topic = TOPIC_BY_ID[id]
    const spur = topic.unlocks.length === 0 ? 0.04 : 0
    return 0.17 + 0.83 * (topic.level / 7) + spur * (topic.level / 7)
  }
  const camps = ids.map((id) => {
    const topic = TOPIC_BY_ID[id]
    const spot = layout.camps[id]
    const leaf = topic.unlocks.length === 0 && topic.level > 0
    const core = (leaf ? 74 : 92) * unit
    const skirt = (leaf ? 150 : 210) * unit
    return { id, x: spot.x, y: spot.y, e: elevation(id), peak: hill(spot.x, spot.y, core), plain: hill(spot.x, spot.y, skirt) }
  })
  const campIndex = new Map(camps.map((c, i) => [c.id, i]))

  const routes = buildRoutes(layout)
  const ridges: Ridge[] = routes.map((route) => {
    const pts = coarsen(route.line, 9)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return {
      pts,
      from: camps[campIndex.get(route.from)!].e,
      to: camps[campIndex.get(route.to)!].e,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    }
  })

  const broad = fbm(valueNoise(seed), 3, 2, 0.5)
  const rough = fbm(valueNoise(seed + 5), 4, 2.1, 0.5)
  const warp = fbm(valueNoise(seed + 9), 2, 2, 0.5)
  const woods = fbm(valueNoise(seed + 17), 3, 2, 0.5)
  const inLake = lakeDepth(layout, valueNoise(seed + 13))
  const stream = curveThrough(layout.stream, 10)
  const streamCoarse = coarsen(stream, 24)

  const base = layout.camps['arrays-hashing']
  const top = layout.camps['math-geometry']
  const ax = top.x - base.x
  const ay = top.y - base.y
  const axisLength2 = ax * ax + ay * ay
  const ridgeSigma = 46 * unit

  const field = (px: number, py: number) => {
    let near = Infinity
    for (const c of camps) near = Math.min(near, (px - c.x) ** 2 + (py - c.y) ** 2)
    // A little warp makes the contours organic; it fades out at the camps so peaks stay put.
    const fade = smooth(24 * unit, 120 * unit, Math.sqrt(near))
    const wx = px + (warp(px / (240 * unit), py / (240 * unit)) - 0.5) * 64 * unit * fade
    const wy = py + (warp(px / (240 * unit) + 7.3, py / (240 * unit) + 2.9) - 0.5) * 64 * unit * fade

    let sum = 0
    for (const c of camps) {
      const v = c.e * (0.72 * c.peak(wx, wy) + 0.28 * c.plain(wx, wy))
      sum += v * v * v * v * v
    }
    for (const r of ridges) {
      const reach = ridgeSigma * 3
      if (wx < r.x0 - reach || wx > r.x1 + reach || wy < r.y0 - reach || wy > r.y1 + reach) continue
      const { d2, at } = nearest(wx, wy, r.pts)
      // The crest dips a little between camps, as a col does.
      const crest = (r.from + (r.to - r.from) * smooth(0, 1, at)) * (1 - 0.1 * Math.sin(Math.PI * at))
      const v = crest * 0.86 * Math.exp(-d2 / (2 * ridgeSigma * ridgeSigma))
      sum += v * v * v * v * v
    }
    const mountains = Math.pow(sum, 0.2)

    const along = Math.max(0, Math.min(1, ((px - base.x) * ax + (py - base.y) * ay) / axisLength2))
    const slope = 0.05 + 0.2 * along
    const rugged = (rough(px / (64 * unit), py / (64 * unit)) - 0.5) * 0.08 * (0.3 + mountains)
    const rolling = (broad(px / (300 * unit), py / (300 * unit)) - 0.5) * 0.1
    let v = mountains * 0.94 + slope + rolling + rugged

    // The stream has cut a shallow valley, so contours bend upstream where they cross it.
    v -= 0.05 * Math.exp(-nearest(px, py, streamCoarse).d2 / (2 * (15 * unit) ** 2))

    // The lake is a flat bowl with a shore that rises quickly.
    const bowl = smooth(-0.55, 0.12, inLake(px, py))
    return v * (1 - bowl) + -0.04 * bowl
  }

  // One pass over the grid buildContours will walk; everything below reads from it.
  const cols = Math.ceil(width / cell) + 1 + MARGIN * 2
  const rows = Math.ceil(height / cell) + 1 + MARGIN * 2
  const raw = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) raw[j * cols + i] = field((i - MARGIN) * cell, (j - MARGIN) * cell)
  const grid = fillPits(raw, cols, rows)
  let lo = Infinity
  let hi = -Infinity
  for (const v of grid) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const step = (hi - lo) / (LINES + 2)
  const sampled = (x: number, y: number) => grid[Math.round(y / cell + MARGIN) * cols + Math.round(x / cell + MARGIN)]
  const trace = (levels: number[]) =>
    buildContours({ width, height, cell, thresholds: levels, majorEvery: MAJOR_EVERY, field: sampled })

  const shapes = trace(Array.from({ length: LINES }, (_, i) => lo + step * (i + 1)))
  const fine = trace(Array.from({ length: LINES + 1 }, (_, i) => lo + step * (i + 0.5)))
  const majors = shapes.filter((s) => s.major)
  const lines = shapes.map((s) => ({ d: simplifyPath(s.d, THIN), major: s.major, band: Math.min(7, Math.floor((s.index + 1) / MAJOR_EVERY)) }))

  // Where nothing else should be set: camp symbols and their names, with a little room.
  const avoid: Box[] = ids.map((id) => {
    const spot = layout.camps[id]
    const { box } = labelLines(spot.side, nameLines(TOPIC_BY_ID[id].short, layout.wrap), ['12/15'])
    const pad = 10
    return {
      x0: Math.min(spot.x - RING - 14, spot.x + box.x0 - pad),
      x1: Math.max(spot.x + RING + 14, spot.x + box.x1 + pad),
      y0: Math.min(spot.y - RING - 14, spot.y + box.y0 - pad),
      y1: Math.max(spot.y + RING + 14, spot.y + box.y1 + pad),
    }
  })
  const trails = routes.map((r) => r.line)

  return {
    id: layout.id,
    bands: majors.slice(0, 7).map((s) => simplifyPath(s.d, THIN)),
    lines,
    fine: fine.map((s) => simplifyPath(s.d, THIN)).join(''),
    shade: shading(grid, cols, rows, cell, step),
    lake: lakeShapes(layout, inLake),
    stream,
    trees: scatterTrees(layout, { sampled, lo, hi, woods, inLake, avoid, trails, stream: streamCoarse }),
    labels: placeLabels(layout, majors, avoid, trails, streamCoarse),
  }
}

/** Hillshade from the grid: light from the north-west, as every printed map has it. */
function shading(grid: Float32Array, cols: number, rows: number, cell: number, step: number): Terrain['shade'] {
  const at = (i: number, j: number) => grid[Math.max(0, Math.min(rows - 1, j)) * cols + Math.max(0, Math.min(cols - 1, i))]
  // Slope in contour steps per world unit, exaggerated so gentle country still catches the light.
  const lift = SHADE_LIFT / step
  const [lx, ly, lz] = (() => {
    const x = -0.62
    const y = -0.62
    const z = 0.48
    const len = Math.hypot(x, y, z)
    return [x / len, y / len, z / len]
  })()
  const shadow = new Uint8ClampedArray(new ArrayBuffer(cols * rows * 4))
  const light = new Uint8ClampedArray(new ArrayBuffer(cols * rows * 4))
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const nx = -((at(i + 1, j) - at(i - 1, j)) / (2 * cell)) * lift
      const ny = -((at(i, j + 1) - at(i, j - 1)) / (2 * cell)) * lift
      const delta = (nx * lx + ny * ly + lz) / Math.hypot(nx, ny, 1) - lz
      const o = (j * cols + i) * 4
      shadow[o] = shadow[o + 1] = shadow[o + 2] = Math.max(0, Math.min(1, -delta * SHADE_GAIN)) * 255
      light[o] = light[o + 1] = light[o + 2] = Math.max(0, Math.min(1, delta * SHADE_GAIN)) * 255
      shadow[o + 3] = light[o + 3] = 255
    }
  }
  const png = (data: Uint8ClampedArray<ArrayBuffer>) => {
    const canvas = document.createElement('canvas')
    canvas.width = cols
    canvas.height = rows
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.putImageData(new ImageData(data, cols, rows), 0, 0)
    return canvas.toDataURL('image/png')
  }
  return {
    shadow: png(shadow),
    light: png(light),
    x: -(MARGIN + 0.5) * cell,
    y: -(MARGIN + 0.5) * cell,
    width: cols * cell,
    height: rows * cell,
  }
}

/** The lake's shore and two depth lines, traced finely in their own small frame. */
function lakeShapes(layout: Layout, inLake: (x: number, y: number) => number): Terrain['lake'] {
  const { x, y, rx, ry } = layout.lake
  const w = Math.ceil(rx * 2.8)
  const h = Math.ceil(ry * 2.8)
  const ox = Math.round(x - w / 2)
  const oy = Math.round(y - h / 2)
  const shapes = buildContours({
    width: w,
    height: h,
    cell: 2,
    thresholds: [0, 0.34, 0.66],
    majorEvery: 99,
    field: (fx, fy) => inLake(fx + ox, fy + oy),
  })
  return { x: ox, y: oy, shore: shapes[0].d, depths: shapes.slice(1).map((s) => s.d) }
}

interface Scatter {
  sampled: (x: number, y: number) => number
  lo: number
  hi: number
  woods: (x: number, y: number) => number
  inLake: (x: number, y: number) => number
  avoid: Box[]
  trails: Pt[][]
  stream: Pt[]
}

/** Woodland: a stipple of small dots in patches across the low ground, clear of everything else. */
function scatterTrees(layout: Layout, s: Scatter): string {
  const rng = mulberry32(layout.seed + 3)
  const gap = 9
  const out: string[] = []
  const r = 0.95
  for (let gy = layout.margin; gy < layout.height - layout.margin; gy += gap) {
    for (let gx = layout.margin; gx < layout.width - layout.margin; gx += gap) {
      const x = gx + (rng() - 0.5) * gap * 0.9
      const y = gy + (rng() - 0.5) * gap * 0.9
      const keep = rng()
      if ((s.sampled(x, y) - s.lo) / (s.hi - s.lo) > 0.2) continue
      if (s.woods(x / (80 * layout.unit + 30), y / (80 * layout.unit + 30)) < 0.5 + keep * 0.12) continue
      if (s.inLake(x, y) > -0.4) continue
      if (s.avoid.some((b) => x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 - 4 && y < b.y1 + 4)) continue
      if (s.trails.some((t) => distToLine(x, y, t) < 16)) continue
      if (distToLine(x, y, s.stream) < 12) continue
      out.push(`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`)
    }
  }
  return out.join('')
}

/** Points spaced `gap` apart along a polyline, so "30 units either way" means the same everywhere. */
function resample(pts: Pt[], gap: number): Pt[] {
  const out: Pt[] = [pts[0]]
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    let px = pts[i - 1][0]
    let py = pts[i - 1][1]
    const qx = pts[i][0]
    const qy = pts[i][1]
    let seg = Math.hypot(qx - px, qy - py)
    while (acc + seg >= gap) {
      const t = (gap - acc) / seg
      px += (qx - px) * t
      py += (qy - py) * t
      out.push([px, py])
      seg = Math.hypot(qx - px, qy - py)
      acc = 0
    }
    acc += seg
  }
  return out
}

const RING_POINTS = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g

/**
 * A few elevation figures set along the index contours, each where the line runs long and
 * straight, in open country: clear of camps and their names, trails, the lake and the neatline.
 */
function placeLabels(
  layout: Layout,
  majors: { index: number; d: string }[],
  avoid: Box[],
  trails: Pt[][],
  stream: Pt[],
): ElevationLabel[] {
  const { width, height, lake } = layout
  const placed: ElevationLabel[] = []
  const perBand = 2
  const spacing = 200 * layout.unit + 40

  majors.forEach((shape, bandIndex) => {
    const text = (BASE_ELEVATION + (shape.index + 1) * INTERVAL).toLocaleString('en-US')
    const candidates: { x: number; y: number; angle: number; score: number }[] = []
    for (const ring of shape.d.split('M').filter(Boolean)) {
      const pts: Pt[] = [...ring.matchAll(RING_POINTS)].map((m) => [Number(m[1]), Number(m[2])])
      if (pts.length < 24) continue
      const even = resample(pts, 6)
      const reach = 6
      for (let i = reach; i < even.length - reach; i += 2) {
        const a = even[i - reach]
        const b = even[i]
        const c = even[i + reach]
        const bend = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]))
        const turn = Math.min(bend, Math.PI * 2 - bend)
        if (turn > 0.15) continue
        const [x, y] = b
        const pad = layout.margin + 16
        if (x < pad || x > width - pad || y < pad || y > height - pad) continue
        const spot: Box = { x0: x - 18, x1: x + 18, y0: y - 8, y1: y + 8 }
        if (avoid.some((box) => boxesOverlap(spot, box))) continue
        if (Math.hypot((x - lake.x) / (lake.rx + 40), (y - lake.y) / (lake.ry + 30)) < 1) continue
        if (trails.some((t) => lineHitsBox(t, spot, 6))) continue
        if (distToLine(x, y, stream) < 22) continue
        let angle = (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI
        if (angle > 90) angle -= 180
        if (angle <= -90) angle += 180
        // Prefer figures that read nearly level.
        candidates.push({ x, y, angle, score: -Math.abs(angle) - turn * 120 })
      }
    }
    candidates.sort((p, q) => q.score - p.score)
    let taken = 0
    for (const cand of candidates) {
      if (taken >= perBand) break
      if (placed.some((p) => Math.hypot(p.x - cand.x, p.y - cand.y) < spacing)) continue
      placed.push({ x: cand.x, y: cand.y, angle: cand.angle, text, band: bandIndex })
      taken++
    }
  })
  return placed
}
