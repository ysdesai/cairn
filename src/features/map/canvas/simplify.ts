/**
 * Contour lines come off the height grid with a vertex every few units, most of them on straight
 * runs. Painting tens of thousands of vertices every frame of a zoom is what makes the sheet heavy,
 * so each line is thinned (Ramer-Douglas-Peucker) to a tolerance far below a pixel at any zoom.
 */
import type { Pt } from './geometry'

/** Squared distance from p to the segment ab. */
function dist2(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  const x = a[0] + dx * t - p[0]
  const y = a[1] + dy * t - p[1]
  return x * x + y * y
}

/** Thin an open polyline: the points kept always include both ends. Iterative, so long lines cannot overflow the stack. */
export function simplifyLine(points: readonly Pt[], tolerance: number): Pt[] {
  const n = points.length
  if (n <= 2) return [...points]
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const tol2 = tolerance * tolerance
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [lo, hi] = stack.pop()!
    let far = -1
    let best = tol2
    for (let i = lo + 1; i < hi; i++) {
      const d = dist2(points[i], points[lo], points[hi])
      if (d > best) {
        best = d
        far = i
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([lo, far], [far, hi])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/** Thin a closed ring (first point equals last): split at the point farthest from the start so the join stays put. */
export function simplifyRing(points: readonly Pt[], tolerance: number): Pt[] {
  if (points.length < 8) return [...points]
  let far = 1
  let best = -1
  for (let i = 1; i < points.length - 1; i++) {
    const d = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2
    if (d > best) {
      best = d
      far = i
    }
  }
  const a = simplifyLine(points.slice(0, far + 1), tolerance)
  const b = simplifyLine(points.slice(far), tolerance)
  return [...a, ...b.slice(1)]
}

const NUMBER_PAIR = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g

/** Thin every subpath of an SVG path made of M, L and Z, as d3-geo writes them. */
export function simplifyPath(d: string, tolerance: number): string {
  if (!d) return d
  const out: string[] = []
  for (const sub of d.split('M')) {
    if (!sub) continue
    const pts: Pt[] = [...sub.matchAll(NUMBER_PAIR)].map((m) => [Number(m[1]), Number(m[2])])
    if (pts.length < 2) continue
    const closed = sub.trimEnd().endsWith('Z') || (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1])
    const thin = closed ? simplifyRing(pts, tolerance) : simplifyLine(pts, tolerance)
    out.push(`M${thin.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}${closed ? 'Z' : ''}`)
  }
  return out.join('')
}
