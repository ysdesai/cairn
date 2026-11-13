/**
 * The two hand-placed compositions of the massif. Landscape climbs from the lower left to the
 * upper right; portrait climbs from the bottom to the top. Coordinates are in sheet units with
 * (0, 0) at the top left corner of the mapped area; the sheet's margin lies outside it.
 *
 * Positions are not computed. They were placed by eye so the trails cross as little as the graph
 * allows, no trail runs through another camp or its name, and the leaf topics stand off the main
 * ridge as spurs of their own.
 */
import type { TopicId } from '../../../data/types'
import type { Box, Pt } from './geometry'

export type Composition = 'landscape' | 'portrait'
export type Side = 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br'

export interface Spot {
  x: number
  y: number
  /** Which side of the symbol the name sits on. */
  side: Side
}

export interface Layout {
  id: Composition
  /** Mapped area. The neatline is drawn around it. */
  width: number
  height: number
  /** Paper outside the neatline, holding the grid numbers and the sheet notes. */
  margin: number
  /** Distance between grid lines. */
  grid: number
  /** Height-field sampling step. Smaller is smoother and slower. */
  cell: number
  /** Size of the landforms relative to the landscape sheet. */
  unit: number
  /** Names break onto two lines (phones). */
  wrap: boolean
  seed: number
  camps: Record<TopicId, Spot>
  /** Points a trail passes through between its two camps, keyed "from>to". */
  via: Partial<Record<string, readonly Pt[]>>
  lake: { x: number; y: number; rx: number; ry: number; turn: number }
  /** The stream, from its spring down to the lake. */
  stream: readonly Pt[]
  /** Where the scale bar sits, and how many kilometres it spans. */
  scale: Pt
  scaleKm: number
  north: Pt
}

/** Radius of a camp's ring, in sheet units. The symbol, its halo, trails and labels all key off it. */
export const RING = 22
const NAME_LEAD = 20
const STAT_LEAD = 17

/** Average advance of a name (Fraunces italic, 18px) and of a count (Geist Mono, 13.5px). */
const NAME_W = 8.5
const STAT_W = 8.2

/** The "you are here" flag: a tag with a pointer, on the side of a camp opposite its name. */
export const BEACON_W = 100
export const BEACON_H = 19

/** "Bit Manipulation" becomes two lines when names must be narrow. */
export function nameLines(short: string, wrap: boolean): string[] {
  if (!wrap || short.length <= 10 || !short.includes(' ')) return [short]
  const words = short.split(' ')
  let best: string[] = [short]
  let bestWidth = Infinity
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
    const width = Math.max(pair[0].length, pair[1].length)
    if (width < bestWidth) {
      best = pair
      bestWidth = width
    }
  }
  return best
}

export interface LabelLine {
  kind: 'name' | 'stat'
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
}

/** Where each line of a camp's label sits, relative to the camp's centre, and the box they fill. */
export function labelLines(side: Side, names: readonly string[], stats: readonly string[]): { lines: LabelLine[]; box: Box } {
  const count = names.length + stats.length
  const height = names.length * NAME_LEAD + stats.length * STAT_LEAD
  let x = 0
  let anchor: LabelLine['anchor'] = 'middle'
  let top: number
  switch (side) {
    case 'b':
      top = RING + 6
      break
    case 't':
      top = -(RING + 6) - height
      break
    case 'l':
    case 'r':
      top = -height / 2
      x = side === 'r' ? RING + 9 : -(RING + 9)
      anchor = side === 'r' ? 'start' : 'end'
      break
    default:
      // Diagonal: tucked beside the symbol, clear of trails that leave straight up or down.
      x = side.endsWith('r') ? RING * 0.8 + 8 : -(RING * 0.8 + 8)
      anchor = side.endsWith('r') ? 'start' : 'end'
      top = side.startsWith('t') ? -height - 6 : 6
  }
  const lines: LabelLine[] = []
  let y = top
  for (let i = 0; i < count; i++) {
    const isName = i < names.length
    const lead = isName ? NAME_LEAD : STAT_LEAD
    // The baseline sits about 0.8 of the line below its top.
    lines.push({ kind: isName ? 'name' : 'stat', text: isName ? names[i] : stats[i - names.length], x, y: y + lead * 0.8, anchor })
    y += lead
  }
  const widest = Math.max(...names.map((n) => n.length * NAME_W), ...stats.map((t) => t.length * STAT_W))
  const x0 = anchor === 'middle' ? -widest / 2 : anchor === 'start' ? x : x - widest
  return { lines, box: { x0, x1: x0 + widest, y0: top, y1: top + height } }
}

/** The room the "you are here" flag needs on the side of a camp opposite its name. */
export function beaconSide(side: Side): 't' | 'b' {
  return side.startsWith('t') ? 'b' : 't'
}

/** The flag's box, relative to the camp's centre. */
export function beaconBox(side: Side): Box {
  const edge = beaconSide(side) === 't' ? -(RING + 6) : RING + 6
  const y0 = edge < 0 ? edge - BEACON_H - 6 : edge
  return { x0: -BEACON_W / 2, x1: BEACON_W / 2, y0, y1: y0 + BEACON_H + 6 }
}

/** Everything a camp occupies on the sheet, relative to its centre: symbol, pulse, name and counts. */
export function campFootprint(side: Side, names: readonly string[], stats: readonly string[]): Box {
  const { box } = labelLines(side, names, stats)
  const r = RING + 10
  return { x0: Math.min(-r, box.x0), x1: Math.max(r, box.x1), y0: Math.min(-r, box.y0), y1: Math.max(r, box.y1) }
}

export const LANDSCAPE: Layout = {
  id: 'landscape',
  width: 1660,
  height: 780,
  margin: 46,
  grid: 200,
  cell: 5,
  unit: 1,
  wrap: false,
  seed: 11,
  camps: {
    'arrays-hashing': { x: 130, y: 605, side: 'b' },
    stack: { x: 360, y: 670, side: 'b' },
    'two-pointers': { x: 320, y: 485, side: 'l' },
    'sliding-window': { x: 530, y: 310, side: 't' },
    'binary-search': { x: 545, y: 460, side: 'b' },
    'linked-list': { x: 530, y: 620, side: 'b' },
    trees: { x: 750, y: 450, side: 'b' },
    tries: { x: 790, y: 190, side: 't' },
    heap: { x: 960, y: 340, side: 'b' },
    backtracking: { x: 950, y: 560, side: 'l' },
    intervals: { x: 970, y: 130, side: 't' },
    greedy: { x: 1150, y: 150, side: 't' },
    'advanced-graphs': { x: 1330, y: 190, side: 't' },
    graphs: { x: 1180, y: 470, side: 'b' },
    'dp-1d': { x: 1170, y: 660, side: 'b' },
    'dp-2d': { x: 1360, y: 445, side: 't' },
    'bit-manipulation': { x: 1440, y: 630, side: 'b' },
    'math-geometry': { x: 1560, y: 100, side: 't' },
  },
  via: {},
  lake: { x: 150, y: 405, rx: 95, ry: 42, turn: -0.2 },
  stream: [
    [470, 10],
    [420, 70],
    [440, 140],
    [370, 200],
    [330, 265],
    [270, 320],
    [240, 365],
    [195, 395],
  ],
  scale: [56, 170],
  scaleKm: 2,
  north: [250, 116],
}

export const PORTRAIT: Layout = {
  id: 'portrait',
  width: 460,
  height: 920,
  margin: 36,
  grid: 100,
  cell: 4,
  unit: 0.6,
  wrap: true,
  seed: 23,
  camps: {
    'arrays-hashing': { x: 220, y: 809, side: 'b' },
    stack: { x: 80, y: 720, side: 'b' },
    'two-pointers': { x: 266, y: 720, side: 'r' },
    'sliding-window': { x: 88, y: 610, side: 'b' },
    'binary-search': { x: 250, y: 610, side: 'l' },
    'linked-list': { x: 360, y: 609, side: 't' },
    trees: { x: 243, y: 504, side: 'r' },
    tries: { x: 79, y: 400, side: 'b' },
    heap: { x: 251, y: 400, side: 'r' },
    backtracking: { x: 397, y: 400, side: 'b' },
    intervals: { x: 54, y: 285, side: 'b' },
    greedy: { x: 161, y: 285, side: 't' },
    'advanced-graphs': { x: 174, y: 175, side: 't' },
    graphs: { x: 272, y: 285, side: 'b' },
    'dp-1d': { x: 406, y: 285, side: 'l' },
    'dp-2d': { x: 305, y: 175, side: 'r' },
    'bit-manipulation': { x: 406, y: 165, side: 't' },
    'math-geometry': { x: 237, y: 82, side: 't' },
  },
  via: {},
  lake: { x: 395, y: 865, rx: 55, ry: 26, turn: 0.15 },
  stream: [
    [405, 500],
    [432, 560],
    [425, 650],
    [446, 730],
    [420, 800],
    [400, 845],
  ],
  scale: [34, 886],
  scaleKm: 1,
  north: [424, 92],
}

export const LAYOUTS: Record<Composition, Layout> = { landscape: LANDSCAPE, portrait: PORTRAIT }
