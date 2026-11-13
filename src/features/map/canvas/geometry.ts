/**
 * Plain geometry for the survey sheet: trail curves as sampled polylines, trimming them to the
 * camp symbols, and the distance and crossing tests the terrain and the layout checks share.
 * No imports on purpose, so it can run anywhere.
 */
export type Pt = readonly [number, number]

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const mix = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Stable 0…1 value from a string, so each trail wanders the same way on every load. */
export function hash01(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** One span of a centripetal Catmull-Rom curve, which never loops or overshoots on uneven spacing. */
function span(p0: Pt, p1: Pt, p2: Pt, p3: Pt, samples: number, out: Pt[]) {
  const t1 = Math.sqrt(dist(p0, p1)) + 1e-4
  const t2 = t1 + Math.sqrt(dist(p1, p2)) + 1e-4
  const t3 = t2 + Math.sqrt(dist(p2, p3)) + 1e-4
  for (let i = 0; i < samples; i++) {
    const t = t1 + ((t2 - t1) * i) / samples
    const a1 = mix(p0, p1, t / t1)
    const a2 = mix(p1, p2, (t - t1) / (t2 - t1))
    const a3 = mix(p2, p3, (t - t2) / (t3 - t2))
    const b1 = mix(a1, a2, t / t2)
    const b2 = mix(a2, a3, (t - t1) / (t3 - t1))
    out.push(mix(b1, b2, (t - t1) / (t2 - t1)))
  }
}

/** A smooth curve through every point, sampled densely enough to be drawn as a polyline. */
export function curveThrough(points: readonly Pt[], samples = 14): Pt[] {
  if (points.length < 2) return [...points]
  const first = points[0]
  const last = points[points.length - 1]
  const pad = (a: Pt, b: Pt): Pt => [a[0] + (a[0] - b[0]), a[1] + (a[1] - b[1])]
  const all = [pad(first, points[1]), ...points, pad(last, points[points.length - 2])]
  const out: Pt[] = []
  for (let i = 1; i < all.length - 2; i++) span(all[i - 1], all[i], all[i + 1], all[i + 2], samples, out)
  out.push(last)
  return out
}

/**
 * The line a trail follows from one camp to the next. Short hops stay straight-ish; longer ones
 * get a gentle bend so the route reads as a path across country and not a diagram edge.
 * `via` points are passed through exactly.
 */
export function trailCurve(from: Pt, to: Pt, key: string, via?: readonly Pt[]): Pt[] {
  if (via && via.length) return curveThrough([from, ...via, to])
  const length = dist(from, to)
  if (length < 150) return curveThrough([from, to], 6)
  const nx = -(to[1] - from[1]) / length
  const ny = (to[0] - from[0]) / length
  const bend = (hash01(key) - 0.5) * 0.16 * length
  const mid = mix(from, to, 0.5)
  return curveThrough([from, [mid[0] + nx * bend, mid[1] + ny * bend], to])
}

/** Drop the part of a polyline that lies inside a circle at either end, cutting exactly at the edge. */
export function trimEnds(line: readonly Pt[], start: Pt, startR: number, end: Pt, endR: number): Pt[] {
  let a = 0
  while (a < line.length - 1 && dist(line[a], start) < startR) a++
  let b = line.length - 1
  while (b > a && dist(line[b], end) < endR) b--
  if (b <= a) return [line[a]]
  const edge = (inside: Pt, outside: Pt, c: Pt, r: number): Pt => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 18; i++) {
      const m = (lo + hi) / 2
      if (dist(mix(inside, outside, m), c) < r) lo = m
      else hi = m
    }
    return mix(inside, outside, hi)
  }
  const out: Pt[] = line.slice(a, b + 1)
  if (a > 0) out[0] = edge(line[a - 1], line[a], start, startR)
  if (b < line.length - 1) out[out.length - 1] = edge(line[b + 1], line[b], end, endR)
  return out
}

export function polyLength(line: readonly Pt[]): number {
  let sum = 0
  for (let i = 1; i < line.length; i++) sum += dist(line[i - 1], line[i])
  return sum
}

/** The point a given distance along a polyline, with the direction of travel there. */
export function pointAlong(line: readonly Pt[], at: number): { x: number; y: number; angle: number } {
  let left = at
  for (let i = 1; i < line.length; i++) {
    const d = dist(line[i - 1], line[i])
    if (left <= d || i === line.length - 1) {
      const t = d === 0 ? 0 : Math.min(1, left / d)
      const p = mix(line[i - 1], line[i], t)
      return { x: p[0], y: p[1], angle: Math.atan2(line[i][1] - line[i - 1][1], line[i][0] - line[i - 1][0]) }
    }
    left -= d
  }
  return { x: line[0][0], y: line[0][1], angle: 0 }
}

/** Squared distance from a point to a segment. */
export function segDist2(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2))
  const x = a[0] + dx * t - px
  const y = a[1] + dy * t - py
  return x * x + y * y
}

export function distToLine(px: number, py: number, line: readonly Pt[]): number {
  let best = Infinity
  for (let i = 1; i < line.length; i++) best = Math.min(best, segDist2(px, py, line[i - 1], line[i]))
  return Math.sqrt(best)
}

/** Do two segments properly cross (touching at a shared end does not count)? */
function cross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = o(a, b, c)
  const d2 = o(a, b, d)
  const d3 = o(c, d, a)
  const d4 = o(c, d, b)
  return d1 * d2 < 0 && d3 * d4 < 0
}

export function linesCross(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) if (cross(a[i - 1], a[i], b[j - 1], b[j])) return true
  }
  return false
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad
}

/** Does a polyline pass through a box (grown by `pad`)? */
export function lineHitsBox(line: readonly Pt[], box: Box, pad = 0): boolean {
  const x0 = box.x0 - pad
  const x1 = box.x1 + pad
  const y0 = box.y0 - pad
  const y1 = box.y1 + pad
  for (let i = 0; i < line.length; i++) {
    const [x, y] = line[i]
    if (x > x0 && x < x1 && y > y0 && y < y1) return true
    if (i > 0) {
      const a = line[i - 1]
      const b = line[i]
      const corners: Pt[] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]
      for (let c = 0; c < 4; c++) if (cross(a, b, corners[c], corners[(c + 1) % 4])) return true
    }
  }
  return false
}
