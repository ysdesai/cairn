/** The 22 trails of a composition as drawable paths, built once per composition. */
import { TOPIC_EDGES } from '../../../data'
import type { TopicId } from '../../../data/types'
import { pointAlong, polyLength, trailCurve, trimEnds, type Pt } from './geometry'
import { RING, type Layout } from './layout'

export interface Route {
  key: string
  from: TopicId
  to: TopicId
  /** The full curve between the two camp centres: the terrain's ridges follow it. */
  line: Pt[]
  /** Path data for the visible part, trimmed to the camp symbols. */
  d: string
  /** Path data for the whole curve, centre to centre: the light that follows a walked trail runs under the camps. */
  full: string
  /** Direction marks along the way, for legs that have been walked. */
  chevrons: { x: number; y: number; angle: number }[]
}

const cache = new Map<string, Route[]>()

export function buildRoutes(layout: Layout): Route[] {
  const hit = cache.get(layout.id)
  if (hit) return hit
  const routes = TOPIC_EDGES.map((edge) => {
    const a = layout.camps[edge.from]
    const b = layout.camps[edge.to]
    const key = `${edge.from}>${edge.to}`
    const line = trailCurve([a.x, a.y], [b.x, b.y], key, layout.via[key])
    const shown = trimEnds(line, [a.x, a.y], RING + 4, [b.x, b.y], RING + 4)
    const total = polyLength(shown)
    const chevrons: Route['chevrons'] = []
    for (let at = 34; at < total - 26; at += 62) {
      const p = pointAlong(shown, at)
      chevrons.push({ x: p.x, y: p.y, angle: (p.angle * 180) / Math.PI })
    }
    return {
      key,
      from: edge.from,
      to: edge.to,
      line,
      d: shown.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''),
      full: line.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''),
      chevrons,
    }
  })
  cache.set(layout.id, routes)
  return routes
}
