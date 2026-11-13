import { describe, expect, it } from 'vitest'
import { simplifyPath, simplifyLine } from './simplify'
import type { Pt } from './geometry'

describe('thinning a contour', () => {
  it('drops points on a straight run and keeps the ends', () => {
    const line: Pt[] = Array.from({ length: 50 }, (_, i) => [i * 5, 0])
    expect(simplifyLine(line, 0.4)).toEqual([line[0], line[49]])
  })

  it('keeps a bend', () => {
    const line: Pt[] = [
      [0, 0],
      [10, 0],
      [20, 0],
      [20, 10],
      [20, 20],
    ]
    expect(simplifyLine(line, 0.4)).toEqual([line[0], line[2], line[4]])
  })

  it('keeps a ring closed and within tolerance of the circle it came from', () => {
    const ring = Array.from({ length: 181 }, (_, i) => `${i ? 'L' : 'M'}${(100 + 80 * Math.cos((i / 180) * Math.PI * 2)).toFixed(1)},${(100 + 80 * Math.sin((i / 180) * Math.PI * 2)).toFixed(1)}`).join('') + 'Z'
    const thin = simplifyPath(ring, 0.4)
    expect(thin.endsWith('Z')).toBe(true)
    const pts = [...thin.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(pts.length).toBeLessThan(181)
    expect(pts.length).toBeGreaterThan(20)
    // Every vertex stays on the circle.
    for (const [x, y] of pts) expect(Math.abs(Math.hypot(x - 100, y - 100) - 80)).toBeLessThan(0.2)
  })

  it('leaves an empty path alone', () => {
    expect(simplifyPath('', 0.4)).toBe('')
  })
})
