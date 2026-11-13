/**
 * The camera: one transform on one group, driven by d3-zoom for the hands (drag, wheel, pinch)
 * and by a spring for the code (fit, fly to a camp, zoom buttons). React never re-renders per
 * frame; the group's transform attribute is set directly.
 */
import { animate, type AnimationPlaybackControls } from 'framer-motion'
import { select } from 'd3-selection'
import { zoom as zoomBehavior, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom'
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { TopicId } from '../../../data/types'
import { spring } from '../../../ui'
import { fitSheet, plainFit, type Area, type Cam, type Rect } from './fit'
import type { Pt } from './geometry'
import type { Layout } from './layout'

export type { Area, Cam }

interface Options {
  rootRef: RefObject<HTMLDivElement | null>
  layerRef: RefObject<SVGGElement | null>
  layout: Layout
  width: number
  height: number
  /** Clear of the bars and the topic panel: where a camp should sit to be seen. */
  area: () => Area
  /** Clear of the bars only. */
  open: () => Area
  /** Screen furniture that must not cover a camp or a trail when the whole map is framed. */
  furniture: () => Rect[]
  /** Changes whenever the panel or the furniture change size or place. */
  insetKey: string
  furnitureKey: string
  reduce: boolean
  /** The camp whose panel is open. The camera keeps it in the middle of `area`. */
  focus: Pt | null
  focusKey: string | null
  /** Where the user is on the climb: its flag is part of what must stay uncovered. */
  here: TopicId | null
  /** Called after every change of camera, including mid-glide. */
  onMove: (cam: Cam) => void
  /** The person took the map into their own hands. */
  onUserMove: () => void
}

const SELECT_ZOOM = 1.4
const MIN_FACTOR = 0.85
/** The least of the sheet that may stay on screen when it is dragged away, as a share of its size. */
const KEEP = 0.4

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface Camera {
  fit(): void
  /** Centre a sheet point in the clear area, keeping the zoom unless it is smaller than a close-up. */
  flyTo(point: Pt, instant?: boolean): void
  zoomBy(factor: number): void
  /** Glide just far enough that a point is on screen and not under furniture, if it is not. */
  reveal(point: Pt): void
  /** Where a sheet point is on the canvas right now. */
  project(point: Pt): { x: number; y: number }
  current(): Cam
  /** The zoom at which the whole sheet fits the clear area: the reference for "close up". */
  baseScale(): number
}

/** Stands in until the camera exists, so callbacks that run early have something to call. */
export const IDLE_CAMERA: Camera = {
  fit() {},
  flyTo() {},
  zoomBy() {},
  reveal() {},
  project: () => ({ x: 0, y: 0 }),
  current: () => ({ x: 0, y: 0, k: 1 }),
  baseScale: () => 1,
}

export function useCamera(options: Options): Camera {
  const opts = useRef(options)
  const cam = useRef<Cam>({ x: 0, y: 0, k: 1 })
  const behavior = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const userMoved = useRef(false)
  const placed = useRef<string | null>(null)
  const settled = useRef(false)

  useLayoutEffect(() => {
    opts.current = options
  })

  /** The whole sheet in an area, with the furniture kept off the camps. */
  const fitFor = useCallback((area: Area): Cam => {
    const { layout, furniture, here } = opts.current
    return fitSheet(layout, area, furniture(), here)
  }, [])

  /** Zoom bounds. Cheap to ask for every frame: they only change with the window, the panel and the furniture. */
  const limitsKey = useRef('')
  const limitsValue = useRef({ min: 0.1, max: 3, close: 1 })
  const limits = useCallback(() => {
    const o = opts.current
    const key = `${o.layout.id}|${o.width}x${o.height}|${o.insetKey}|${o.furnitureKey}|${o.here ?? ''}`
    if (key === limitsKey.current) return limitsValue.current
    const open = plainFit(o.layout, o.open()).k
    const clear = Math.min(plainFit(o.layout, o.area()).k, fitFor(o.open()).k, fitFor(o.area()).k)
    limitsKey.current = key
    limitsValue.current = { min: Math.min(open, clear) * MIN_FACTOR, max: Math.max(3, open * 3.2), close: open * SELECT_ZOOM }
    return limitsValue.current
  }, [fitFor])

  const stop = useCallback(() => {
    anim.current?.stop()
    anim.current = null
  }, [])

  /** Hand a camera to d3, which constrains it and tells us (below) to paint it. */
  const set = useCallback(
    (c: Cam) => {
      const node = opts.current.rootRef.current
      const z = behavior.current
      if (!node || !z) return
      const { min, max } = limits()
      select(node).call(z.transform, zoomIdentity.translate(c.x, c.y).scale(clamp(c.k, min, max)))
    },
    [limits],
  )

  const go = useCallback(
    (target: Cam, instant: boolean) => {
      stop()
      if (instant || opts.current.reduce) {
        set(target)
        return
      }
      const area = opts.current.area()
      const cx = (area.left + area.right) / 2
      const cy = (area.top + area.bottom) / 2
      const from = cam.current
      const w0 = [(cx - from.x) / from.k, (cy - from.y) / from.k]
      const w1 = [(cx - target.x) / target.k, (cy - target.y) / target.k]
      anim.current = animate(0, 1, {
        ...spring.glide,
        onUpdate: (t) => {
          const k = from.k * Math.pow(target.k / from.k, t)
          set({ k, x: cx - (w0[0] + (w1[0] - w0[0]) * t) * k, y: cy - (w0[1] + (w1[1] - w0[1]) * t) * k })
        },
        onComplete: () => set(target),
      })
    },
    [set, stop],
  )

  const centered = useCallback((point: Pt, k: number): Cam => {
    const area = opts.current.area()
    return { k, x: (area.left + area.right) / 2 - point[0] * k, y: (area.top + area.bottom) / 2 - point[1] * k }
  }, [])

  // The hands: attach d3-zoom once.
  useEffect(() => {
    const node = opts.current.rootRef.current
    if (!node) return
    const z = zoomBehavior<HTMLDivElement, unknown>()
      .filter((event: Event) => {
        if (event.type === 'dblclick' && (event.target as Element | null)?.closest('[data-camp]')) return false
        return (!(event as MouseEvent).ctrlKey || event.type === 'wheel') && !(event as MouseEvent).button
      })
      .constrain((t) => {
        // The sheet may leave the screen, but never most of it: at least KEEP of it (and never
        // less than half the room there is) stays inside the part of the canvas under the bars.
        const { layout, open } = opts.current
        const m = layout.margin
        const area = open()
        const aw = area.right - area.left
        const ah = area.bottom - area.top
        const sw = (layout.width + m * 2) * t.k
        const sh = (layout.height + m * 2) * t.k
        const needX = Math.min(sw * KEEP, aw * 0.5)
        const needY = Math.min(sh * KEEP, ah * 0.5)
        // The sheet's left edge is at t.x - m * k.
        const minX = area.left + needX - sw + m * t.k
        const maxX = area.right - needX + m * t.k
        const minY = area.top + needY - sh + m * t.k
        const maxY = area.bottom - needY + m * t.k
        const x = clamp(t.x, minX, Math.max(minX, maxX))
        const y = clamp(t.y, minY, Math.max(minY, maxY))
        return x === t.x && y === t.y ? t : zoomIdentity.translate(x, y).scale(t.k)
      })
      .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const t = event.transform
        cam.current = { x: t.x, y: t.y, k: t.k }
        opts.current.layerRef.current?.setAttribute('transform', `translate(${t.x} ${t.y}) scale(${t.k})`)
        if (event.sourceEvent) {
          stop()
          userMoved.current = true
          opts.current.onUserMove()
        }
        opts.current.onMove(cam.current)
      })
    behavior.current = z
    select(node).call(z)
    return () => {
      select(node).on('.zoom', null)
      behavior.current = null
      stop()
    }
  }, [stop])

  // Zoom limits follow the viewport, the panel and the furniture.
  useEffect(() => {
    const { min, max } = limits()
    behavior.current?.scaleExtent([min, max])
  }, [limits, options.layout.id, options.width, options.height, options.insetKey, options.furnitureKey])

  // First sight, a new composition or a new window size: frame the massif, or the open camp.
  useLayoutEffect(() => {
    const { width, height, layout, focus } = opts.current
    if (!width || !height || !behavior.current) return
    const first = placed.current !== layout.id
    if (!first && userMoved.current) {
      set(cam.current)
      return
    }
    placed.current = layout.id
    if (first) userMoved.current = false
    const target = focus ? centered(focus, limits().close) : fitFor(opts.current.area())
    set(target)
    settled.current = true
  }, [options.layout.id, options.width, options.height, set, centered, limits, fitFor])

  // The furniture moved (it was measured, or it changed size): re-frame the map if nobody has moved it.
  const lastFurniture = useRef(options.furnitureKey)
  useLayoutEffect(() => {
    if (lastFurniture.current === options.furnitureKey) return
    lastFurniture.current = options.furnitureKey
    const { focus } = opts.current
    if (!settled.current || userMoved.current || focus) return
    set(fitFor(opts.current.area()))
  }, [options.furnitureKey, set, fitFor])

  // A different camp opens, or the panel changes size: glide to it.
  const lastFocus = useRef<string | null>(options.focusKey)
  const lastInset = useRef(options.insetKey)
  useEffect(() => {
    const changed = lastFocus.current !== options.focusKey || lastInset.current !== options.insetKey
    lastFocus.current = options.focusKey
    lastInset.current = options.insetKey
    if (!changed || !settled.current || !options.focus) return
    go(centered(options.focus, Math.max(cam.current.k, limits().close)), false)
  }, [options.focusKey, options.insetKey, options.focus, go, centered, limits])

  return {
    fit() {
      userMoved.current = false
      go(fitFor(opts.current.area()), false)
    },
    flyTo(point, instant = false) {
      go(centered(point, Math.max(cam.current.k, limits().close)), instant)
    },
    zoomBy(factor) {
      const area = opts.current.area()
      const cx = (area.left + area.right) / 2
      const cy = (area.top + area.bottom) / 2
      const { min, max } = limits()
      const from = cam.current
      const k = clamp(from.k * factor, min, max)
      const wx = (cx - from.x) / from.k
      const wy = (cy - from.y) / from.k
      go({ k, x: cx - wx * k, y: cy - wy * k }, false)
    },
    reveal(point) {
      const area = opts.current.area()
      const p = { x: point[0] * cam.current.k + cam.current.x, y: point[1] * cam.current.k + cam.current.y }
      const pad = 64
      const outside = p.x < area.left + pad || p.x > area.right - pad || p.y < area.top + pad || p.y > area.bottom - pad
      // A camp can be inside the area and still sit under a corner of furniture.
      const under = opts.current.furniture().some((r) => p.x > r.x0 - 24 && p.x < r.x1 + 24 && p.y > r.y0 - 24 && p.y < r.y1 + 24)
      if (outside || under) go(centered(point, cam.current.k), false)
    },
    project(point) {
      return { x: point[0] * cam.current.k + cam.current.x, y: point[1] * cam.current.k + cam.current.y }
    },
    current: () => cam.current,
    baseScale: () => plainFit(opts.current.layout, opts.current.open()).k,
  }
}
