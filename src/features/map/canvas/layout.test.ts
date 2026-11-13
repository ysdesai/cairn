import { describe, expect, it } from 'vitest'
import { TOPIC_BY_ID, TOPIC_EDGES } from '../../../data'
import type { TopicId } from '../../../data/types'
import { boxesOverlap, distToLine, lineHitsBox, linesCross, trailCurve, trimEnds, type Box } from './geometry'
import { LAYOUTS, RING, labelLines, nameLines } from './layout'

/** The hand placement is the point of this sheet, so it is checked like code: nothing may drift into anything else. */
describe.each(Object.values(LAYOUTS))('$id composition', (layout) => {
  const ids = Object.keys(layout.camps) as TopicId[]
  const box = (id: TopicId): Box => {
    const spot = layout.camps[id]
    const { box: b } = labelLines(spot.side, nameLines(TOPIC_BY_ID[id].short, layout.wrap), ['12/15'])
    return { x0: spot.x + b.x0, x1: spot.x + b.x1, y0: spot.y + b.y0, y1: spot.y + b.y1 }
  }
  const ring = (id: TopicId): Box => {
    const { x, y } = layout.camps[id]
    return { x0: x - RING - 4, x1: x + RING + 4, y0: y - RING - 4, y1: y + RING + 4 }
  }
  const trails = TOPIC_EDGES.map((edge) => {
    const a = layout.camps[edge.from]
    const b = layout.camps[edge.to]
    const key = `${edge.from}>${edge.to}`
    const line = trailCurve([a.x, a.y], [b.x, b.y], key, layout.via[key])
    return { ...edge, line, shown: trimEnds(line, [a.x, a.y], RING + 4, [b.x, b.y], RING + 4) }
  })

  it('places all 18 camps and 22 trails inside the neatline', () => {
    expect(ids).toHaveLength(18)
    expect(trails).toHaveLength(22)
    for (const id of ids) {
      const { x, y } = layout.camps[id]
      expect(x).toBeGreaterThan(40)
      expect(x).toBeLessThan(layout.width - 40)
      expect(y).toBeGreaterThan(40)
      expect(y).toBeLessThan(layout.height - 40)
      const b = box(id)
      expect(b.x0).toBeGreaterThan(4)
      expect(b.x1).toBeLessThan(layout.width - 4)
      expect(b.y0).toBeGreaterThan(4)
      expect(b.y1).toBeLessThan(layout.height - 4)
    }
  })

  it('has no trail crossing another', () => {
    const crossings = []
    for (let i = 0; i < trails.length; i++) {
      for (let j = i + 1; j < trails.length; j++) {
        if (linesCross(trails[i].shown, trails[j].shown)) crossings.push(`${trails[i].from}>${trails[i].to} x ${trails[j].from}>${trails[j].to}`)
      }
    }
    expect(crossings).toEqual([])
  })

  it('keeps every trail clear of the camps and names it does not belong to', () => {
    const hits: string[] = []
    for (const t of trails) {
      for (const id of ids) {
        if (id !== t.from && id !== t.to && distToLine(layout.camps[id].x, layout.camps[id].y, t.line) < RING + 16) hits.push(`${t.from}>${t.to} near ${id}`)
        if (lineHitsBox(t.shown, box(id), 3)) hits.push(`${t.from}>${t.to} through the name of ${id}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('keeps names apart from each other and from other camps', () => {
    const hits: string[] = []
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue
        if (boxesOverlap(box(a), box(b), 3)) hits.push(`${a} and ${b} names overlap`)
        if (boxesOverlap(box(a), ring(b))) hits.push(`name of ${a} covers ${b}`)
        if (boxesOverlap(box(b), ring(a))) hits.push(`name of ${b} covers ${a}`)
        const d = Math.hypot(layout.camps[a].x - layout.camps[b].x, layout.camps[a].y - layout.camps[b].y)
        if (d < 90) hits.push(`${a} and ${b} are ${Math.round(d)} apart`)
      }
    }
    expect(hits).toEqual([])
  })

  it('climbs: base camp is the lowest, Math & Geometry the highest, and every trail goes up', () => {
    const up = (id: TopicId) => (layout.id === 'portrait' ? -layout.camps[id].y : layout.camps[id].x - layout.camps[id].y * 0.35)
    for (const id of ids) {
      if (id !== 'arrays-hashing') expect(up(id)).toBeGreaterThan(up('arrays-hashing'))
      if (id !== 'math-geometry') expect(up(id)).toBeLessThan(up('math-geometry'))
    }
    for (const t of trails) expect(up(t.to)).toBeGreaterThan(up(t.from))
  })
})
