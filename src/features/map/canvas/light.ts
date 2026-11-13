/**
 * First light. Where the climb has been, the ground is lit: warm pools around every camp that
 * is complete or under way, brighter as more of it is solved, and a faint first light round the
 * camp the route points to next. Nothing is lit that has not been reached.
 */
import type { TopicId } from '../../../data/types'
import { mulberry32 } from '../../../domain/rng'
import type { TopicView } from '../../../domain/types'
import type { Box } from './geometry'
import { obstaclesOf } from './fit'
import type { Layout } from './layout'

export interface Glow {
  id: TopicId
  x: number
  y: number
  /** Reach of the pool, in sheet units. */
  r: number
  /** 0…1: how bright the pool is at its heart. */
  i: number
  /** Every problem mastered: the pool wears the alpenglow. */
  alpen: boolean
  /** Brightest pools also get a gold core. */
  core: boolean
}

export function glowsFor(layout: Layout, topics: Record<TopicId, TopicView>, here: TopicId | null): Glow[] {
  const u = layout.unit
  const out: Glow[] = []
  for (const id of Object.keys(layout.camps) as TopicId[]) {
    const view = topics[id]
    const spot = layout.camps[id]
    const base = { id, x: spot.x, y: spot.y }
    if (view.state === 'complete') {
      out.push({ ...base, r: 250 * u, i: 1, alpen: view.total > 0 && view.mastered === view.total, core: true })
    } else if (view.state === 'active') {
      // 3 of 5 glows less than 5 of 5, and a camp with one problem solved only just kindles.
      out.push({ ...base, r: (120 + 120 * view.progress) * u, i: 0.36 + 0.5 * view.progress, alpen: false, core: view.progress >= 0.5 })
    } else if (view.state === 'ready' && (view.recommended || here === id)) {
      out.push({ ...base, r: 110 * u, i: 0.34, alpen: false, core: false })
    }
  }
  return out
}

export interface Star {
  x: number
  y: number
  r: number
  twinkle: boolean
  cross: boolean
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

const cache = new Map<string, Star[]>()

/** A few stars over the highest ground, kept off every camp, name and trail. Seen only at night. */
export function starsFor(layout: Layout): Star[] {
  const hit = cache.get(layout.id)
  if (hit) return hit
  const rng = mulberry32(layout.seed + 211)
  const summit = layout.camps['math-geometry']
  const obs = obstaclesOf(layout)
  const wide = layout.id === 'landscape'
  const sky = wide ? 120 : 130
  const want = wide ? 34 : 22
  const out: Star[] = []
  for (let tries = 0; tries < 400 && out.length < want; tries++) {
    const near = rng() < 0.7
    const x = near ? summit.x + (rng() - 0.5) * layout.width * (wide ? 0.34 : 0.7) : 14 + rng() * (layout.width - 28)
    const y = 8 + Math.pow(rng(), 1.5) * sky
    if (x < 10 || x > layout.width - 10) continue
    const spot: Box = { x0: x - 8, x1: x + 8, y0: y - 8, y1: y + 8 }
    if (obs.camps.some((c) => overlaps(c.box, spot))) continue
    if (obs.points.some(([px, py]) => Math.hypot(px - x, py - y) < 14)) continue
    const r = 0.7 + rng() * 1.2
    out.push({ x, y, r, twinkle: rng() < 0.2, cross: r > 1.5 })
  }
  cache.set(layout.id, out)
  return out
}
