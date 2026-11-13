/**
 * Procedural terrain: seeded noise and contour extraction. Used for the decorative contour
 * backdrops and by the roadmap, which builds its massif from the same pieces.
 */
import { contours } from 'd3-contour'
import { geoIdentity, geoPath } from 'd3-geo'
import { mulberry32 } from '../domain/rng'

/** A height function over world coordinates. */
export type Field = (x: number, y: number) => number

/** Seeded smooth value noise in 0…1, one feature per unit. */
export function valueNoise(seed: number): Field {
  const rng = mulberry32(seed)
  const N = 256
  const values = new Float32Array(N)
  const order = Array.from({ length: N }, (_, i) => i)
  for (let i = 0; i < N; i++) values[i] = rng()
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const perm = new Uint8Array(N * 2)
  for (let i = 0; i < N * 2; i++) perm[i] = order[i & 255]
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const xi = x0 & 255
    const yi = y0 & 255
    const a = values[perm[perm[xi] + yi]]
    const b = values[perm[perm[xi + 1] + yi]]
    const c = values[perm[perm[xi] + yi + 1]]
    const d = values[perm[perm[xi + 1] + yi + 1]]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

/** Fractal noise: several octaves of `noise` summed, normalised back to 0…1. */
export function fbm(noise: Field, octaves = 4, lacunarity = 2, gain = 0.5): Field {
  let norm = 0
  for (let o = 0, amp = 1; o < octaves; o++, amp *= gain) norm += amp
  return (x, y) => {
    let sum = 0
    let amp = 1
    let freq = 1
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq + o * 17.31, y * freq + o * 9.17)
      amp *= gain
      freq *= lacunarity
    }
    return sum / norm
  }
}

/** A smooth bump centred on (cx, cy): 1 at the centre, falling off over `radius`. */
export function hill(cx: number, cy: number, radius: number): Field {
  const k = 1 / (2 * radius * radius)
  return (x, y) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) * k)
}

export interface ContourShape {
  /** The height this contour is drawn at. */
  value: number
  /** 0 for the lowest threshold. */
  index: number
  /** Every `majorEvery`-th line: drawn heavier, as index contours are on a real map. */
  major: boolean
  /** SVG path data in world coordinates. The filled region is everything at or above `value`. */
  d: string
}

export interface ContourOptions {
  width: number
  height: number
  field: Field
  /** World units per sample. Smaller is smoother and slower. Default 8. */
  cell?: number
  /** Either explicit heights, or a count of evenly spaced levels between the field's min and max. */
  thresholds: number[] | number
  majorEvery?: number
}

/**
 * Sample `field` over a width × height area and trace its contours.
 * The grid runs a little past every edge so no contour is closed along the visible border.
 */
export function buildContours({ width, height, field, cell = 8, thresholds, majorEvery = 5 }: ContourOptions): ContourShape[] {
  const margin = 3
  const cols = Math.ceil(width / cell) + 1 + margin * 2
  const rows = Math.ceil(height / cell) + 1 + margin * 2
  const values = new Array<number>(cols * rows)
  let min = Infinity
  let max = -Infinity
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v = field((i - margin) * cell, (j - margin) * cell)
      values[j * cols + i] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  const levels =
    typeof thresholds === 'number'
      ? Array.from({ length: thresholds }, (_, i) => min + ((i + 1) / (thresholds + 1)) * (max - min))
      : thresholds

  // d3-contour puts sample (i, j) at grid coordinate (i + 0.5, j + 0.5).
  const offset = -(margin + 0.5) * cell
  const path = geoPath(geoIdentity().scale(cell).translate([offset, offset])).digits(1)
  return contours()
    .size([cols, rows])
    .thresholds(levels)(values)
    .map((shape, index) => ({
      value: shape.value,
      index,
      major: index % majorEvery === majorEvery - 1,
      d: path(shape) ?? '',
    }))
}
