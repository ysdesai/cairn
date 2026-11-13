import { describe, expect, it } from 'vitest'
import type { TopicId } from '../../../data/types'
import { covered, fitSheet, plainFit, type Area, type Rect } from './fit'
import { LANDSCAPE, PORTRAIT } from './layout'

/** The screen's furniture, placed the way MapScreen.module.css places it. */
function furniture(w: number, h: number): { area: Area; rects: Rect[] } {
  const phone = w <= 760
  const top = 56
  const dock = phone ? 58 : 94
  const area: Area = { left: 0, top, right: w, bottom: h - dock }
  const title: Rect = phone ? { x0: 12, y0: top + 6, x1: 12 + Math.min(w - 24, 344), y1: top + 6 + 60 } : { x0: 16, y0: top + 12, x1: 16 + 268, y1: top + 12 + 190 }
  const foot = phone ? h - 58 - 12 : h - 58 - 18 - 12
  const legend: Rect = { x0: phone ? 12 : 16, y0: foot - (phone ? 44 : 40), x1: (phone ? 12 : 16) + 100, y1: foot }
  const edge = phone ? 12 : 16
  const camera: Rect = { x0: w - edge - 44, y0: foot - 4 * (phone ? 44 : 42), x1: w - edge, y1: foot }
  return { area, rects: [title, legend, camera] }
}

const SIZES: [number, number][] = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1280, 800],
  [1280, 680],
  [1024, 700],
  [820, 1100],
  [768, 1024],
  [412, 915],
  [390, 844],
  [375, 667],
  [360, 740],
  [360, 640],
]

describe('framing the whole map', () => {
  for (const here of ['arrays-hashing', 'tries'] as TopicId[]) {
    it.each(SIZES)(`leaves no camp, name or trail under the furniture at %i x %i (you are at ${here})`, (w, h) => {
      const layout = w / (h - 56) < 0.95 ? PORTRAIT : LANDSCAPE
      const { area, rects } = furniture(w, h)
      const cam = fitSheet(layout, area, rects, here)
      expect(covered(layout, cam, rects, here, false)).toBe(0)
      // Making room must not cost much: the map stays at least 78% of the size it would be with nothing in the way.
      expect(cam.k / plainFit(layout, area).k).toBeGreaterThan(0.78)
      // Where there is room to spare, the scale bar and the north arrow are clear as well.
      if (h >= 800) expect(covered(layout, cam, rects, here)).toBe(0)
    })
  }

  it('keeps the whole sheet inside the area', () => {
    for (const [w, h] of SIZES) {
      const layout = w / (h - 56) < 0.95 ? PORTRAIT : LANDSCAPE
      const { area, rects } = furniture(w, h)
      const cam = fitSheet(layout, area, rects, 'arrays-hashing')
      const m = layout.margin
      expect(cam.x - m * cam.k).toBeGreaterThanOrEqual(area.left - 0.5)
      expect(cam.y - m * cam.k).toBeGreaterThanOrEqual(area.top - 0.5)
      expect(cam.x + (layout.width + m) * cam.k).toBeLessThanOrEqual(area.right + 0.5)
      expect(cam.y + (layout.height + m) * cam.k).toBeLessThanOrEqual(area.bottom + 0.5)
    }
  })
})
