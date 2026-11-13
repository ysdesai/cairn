/**
 * The massif, drawn as a survey sheet: hypsometric tints, contours with index lines and elevation
 * figures, a lake and a stream, a grid and a neatline, first light on the ground that has been
 * walked, trails drawn the way maps draw footpaths, and camps drawn as survey symbols with a
 * progress ring.
 *
 * Structure: one SVG, one camera group. Terrain is built once per composition and never
 * re-renders; the light, trails and camps are small memoized pieces that only re-render when their
 * own state changes, so hovering costs a handful of nodes and panning costs none.
 */
import { useReducedMotion } from 'framer-motion'
import { useCallback, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ROADMAP_ORDER, TOPIC_EDGES } from '../../../data'
import type { TopicId } from '../../../data/types'
import type { TopicView } from '../../../domain/types'
import { Frame, Meter, useHotkeys, useMeasure } from '../../../ui'
import type { MapCanvasHandle, MapCanvasProps } from '../types'
import { Camp, GlowGradient } from './Camp'
import { LANDSCAPE, PORTRAIT, RING, nameLines } from './layout'
import { glowsFor } from './light'
import { LightLayer, Stars } from './LightLayer'
import s from './MapCanvas.module.css'
import { buildRoutes } from './routes'
import { SheetOver, SheetUnder } from './Sheet'
import { TerrainLayer } from './TerrainLayer'
import { Trail, type TrailState } from './Trail'
import { IDLE_CAMERA, useCamera, type Area, type Camera } from './useCamera'
import { useTerrain } from './useTerrain'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const STATE_PHRASE: Record<TopicView['state'], string> = {
  complete: 'complete',
  active: 'in progress',
  ready: 'ready to start',
  ahead: 'not started',
}

function trailState(from: TopicView, to: TopicView): TrailState {
  if (from.state === 'complete' && to.solved > 0) return 'walked'
  if (to.state === 'ready' || to.state === 'active') return 'open'
  return 'ahead'
}

function ariaLabel(view: TopicView, here: boolean): string {
  const parts = [`${view.topic.short}: ${view.solved} of ${view.total} solved, ${STATE_PHRASE[view.state]}`]
  if (view.due > 0) parts.push(`${view.due} waiting for revision`)
  if (view.recommended) parts.push('next on the route')
  if (here) parts.push('you are here')
  return parts.join(', ')
}

export default function MapCanvas({ topics, selected, onSelect, here, inset, furniture, handle }: MapCanvasProps) {
  const reduce = useReducedMotion() ?? false
  const rootRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<SVGGElement | null>(null)
  const terrainRef = useRef<SVGGElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const topProbe = useRef<HTMLDivElement | null>(null)
  const bottomProbe = useRef<HTMLDivElement | null>(null)
  const [measure, size] = useMeasure<HTMLDivElement>()
  const setRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node
      measure(node)
    },
    [measure],
  )
  const glow = `glow-${useId().replace(/:/g, '')}`
  const help = `help-${useId().replace(/:/g, '')}`

  const ready = size.width > 0 && size.height > 0
  // Wide windows get the landscape sheet; phones and tall windows get the portrait one.
  const layout = ready && size.width / size.height < 0.95 ? PORTRAIT : LANDSCAPE
  const terrain = useTerrain(layout)
  const routes = useMemo(() => buildRoutes(layout), [layout])

  const [hover, setHover] = useState<TopicId | null>(null)
  const [focus, setFocus] = useState<TopicId | null>(null)
  const [stop, setStop] = useState<TopicId | null>(null)
  const hoverRef = useRef<TopicId | null>(null)
  hoverRef.current = hover

  const { incident, neighbors } = useMemo(() => {
    const incident = new Map<TopicId, Set<string>>()
    const neighbors = new Map<TopicId, Set<TopicId>>()
    for (const e of TOPIC_EDGES) {
      const key = `${e.from}>${e.to}`
      for (const [a, b] of [
        [e.from, e.to],
        [e.to, e.from],
      ] as const) {
        incident.set(a, (incident.get(a) ?? new Set()).add(key))
        neighbors.set(a, (neighbors.get(a) ?? new Set()).add(b))
      }
    }
    return { incident, neighbors }
  }, [])

  // ---- The camera -------------------------------------------------------------------------
  const readBars = useCallback(() => ({ top: topProbe.current?.offsetHeight ?? 56, bottom: bottomProbe.current?.offsetHeight ?? 96 }), [])
  const sizeRef = useRef(size)
  sizeRef.current = size
  const insetRef = useRef(inset)
  insetRef.current = inset
  const open = useCallback((): Area => {
    const b = readBars()
    return { left: 0, top: b.top, right: sizeRef.current.width, bottom: sizeRef.current.height - b.bottom }
  }, [readBars])
  const area = useCallback((): Area => {
    const b = readBars()
    const i = insetRef.current
    return {
      left: 0,
      top: b.top,
      right: Math.max(1, sizeRef.current.width - i.right),
      bottom: sizeRef.current.height - Math.max(i.bottom, b.bottom),
    }
  }, [readBars])

  const furnitureRef = useRef(furniture)
  furnitureRef.current = furniture
  const furnitureKey = furniture.map((r) => `${r.x0},${r.y0},${r.x1},${r.y1}`).join('|')
  const getFurniture = useCallback(() => furnitureRef.current, [])

  const focusPoint = useMemo(() => (selected ? ([layout.camps[selected].x, layout.camps[selected].y] as const) : null), [layout, selected])
  const activeRef = useRef<TopicId | null>(null)
  const placeTipRef = useRef<() => void>(() => {})
  const cameraRef = useRef<Camera>(IDLE_CAMERA)
  const camera = useCamera({
    rootRef,
    layerRef,
    layout,
    width: size.width,
    height: size.height,
    area,
    open,
    furniture: getFurniture,
    insetKey: `${inset.right}:${inset.bottom}`,
    furnitureKey,
    reduce,
    focus: focusPoint,
    focusKey: selected,
    here,
    onMove: (cam) => {
      placeTipRef.current()
      terrainRef.current?.style.setProperty('--ink', (1 / cam.k).toFixed(4))
      // Close-up detail switches on by zoom, through one attribute the stylesheet reads.
      const ratio = cam.k / Math.max(0.05, cameraRef.current.baseScale())
      const level = ratio > 1.9 ? 'in' : ratio > 1.35 ? 'mid' : 'out'
      const root = rootRef.current
      if (root && root.dataset.zoom !== level) root.dataset.zoom = level
    },
    onUserMove: () => {
      // Dragging the map is not pointing at a camp.
      if (hoverRef.current) setHover(null)
    },
  })
  cameraRef.current = camera

  // ---- Hover, focus and the keyboard ------------------------------------------------------
  const active = hover ?? focus
  activeRef.current = active
  const tipId = active && active !== selected ? active : null
  const near = active ? neighbors.get(active) : undefined
  const traced = active ?? selected

  const focusCamp = useCallback((id: TopicId) => {
    rootRef.current?.querySelector<SVGGElement>(`[data-camp="${id}"]`)?.focus({ preventScroll: true })
  }, [])

  useImperativeHandle(
    handle,
    (): MapCanvasHandle => ({
      zoomIn: () => cameraRef.current.zoomBy(1.5),
      zoomOut: () => cameraRef.current.zoomBy(1 / 1.5),
      fit: () => cameraRef.current.fit(),
      flyTo: (id) => {
        const spot = layout.camps[id]
        cameraRef.current.flyTo([spot.x, spot.y])
      },
      focusCamp,
    }),
    [layout, focusCamp],
  )

  const spatial = useCallback(
    (from: TopicId, dir: 1 | -1): TopicId | null => {
      const a = layout.camps[from]
      let best: TopicId | null = null
      let bestScore = Infinity
      for (const id of ROADMAP_ORDER) {
        if (id === from) continue
        const b = layout.camps[id]
        const along = (b.y - a.y) * dir
        const lateral = Math.abs(b.x - a.x)
        if (along < 24 || lateral > along * 1.8) continue
        const score = Math.hypot(b.x - a.x, b.y - a.y) + lateral * 0.6
        if (score < bestScore) {
          bestScore = score
          best = id
        }
      }
      return best
    },
    [layout],
  )

  const onKey = useCallback(
    (event: KeyboardEvent, id: TopicId) => {
      const at = ROADMAP_ORDER.indexOf(id)
      let next: TopicId | null | undefined
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault()
          onSelect(id, 'key')
          return
        case 'ArrowRight':
          next = ROADMAP_ORDER[at + 1]
          break
        case 'ArrowLeft':
          next = ROADMAP_ORDER[at - 1]
          break
        case 'ArrowUp':
          next = spatial(id, -1)
          break
        case 'ArrowDown':
          next = spatial(id, 1)
          break
        case 'Home':
          next = ROADMAP_ORDER[0]
          break
        case 'End':
          next = ROADMAP_ORDER[ROADMAP_ORDER.length - 1]
          break
        default:
          return
      }
      event.preventDefault()
      if (next) focusCamp(next)
    },
    [focusCamp, onSelect, spatial],
  )

  // With no camp focused, the arrows still walk the roadmap, from the open camp or from where you are.
  const stepAlong = useCallback(
    (dir: 1 | -1) => {
      const from = selected ?? here
      const at = from ? ROADMAP_ORDER.indexOf(from) : dir === 1 ? -1 : ROADMAP_ORDER.length
      const next = ROADMAP_ORDER[Math.min(ROADMAP_ORDER.length - 1, Math.max(0, at + dir))]
      if (next) focusCamp(next)
    },
    [selected, here, focusCamp],
  )
  useHotkeys({ ArrowRight: () => stepAlong(1), ArrowLeft: () => stepAlong(-1) })

  const openCamp = useCallback((id: TopicId) => onSelect(id, 'pointer'), [onSelect])

  const onFocusCamp = useCallback(
    (id: TopicId) => {
      setFocus(id)
      setStop(id)
      const spot = layout.camps[id]
      cameraRef.current.reveal([spot.x, spot.y])
    },
    [layout],
  )
  const onBlurCamp = useCallback((id: TopicId) => setFocus((f) => (f === id ? null : f)), [])

  // ---- The hover card ---------------------------------------------------------------------
  const placeTip = useCallback(() => {
    const el = tipRef.current
    const id = activeRef.current
    if (!el || !id) return
    const spot = layout.camps[id]
    const p = cameraRef.current.project([spot.x, spot.y])
    const k = cameraRef.current.current().k
    const w = el.offsetWidth
    const h = el.offsetHeight
    const edge = 10
    const left = clamp(p.x - w / 2, edge, Math.max(edge, sizeRef.current.width - w - edge))
    const above = p.y - RING * k - 14 - h
    const top = above > readBars().top + edge ? above : p.y + RING * k + 14
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
  }, [layout, readBars])
  placeTipRef.current = placeTip
  useLayoutEffect(() => {
    placeTip()
  }, [tipId, placeTip, size.width, size.height])

  // The terrain arrives after the camera has been placed: give its lines their width.
  useLayoutEffect(() => {
    terrainRef.current?.style.setProperty('--ink', (1 / cameraRef.current.current().k).toFixed(4))
  }, [terrain])

  const tipView = tipId ? topics[tipId] : null

  const tabStop = stop ?? selected ?? here ?? ROADMAP_ORDER[0]

  // First light: pools round the camps that have been reached, and a soft bloom along the trails walked.
  const glows = useMemo(() => glowsFor(layout, topics, here), [layout, topics, here])
  const walked = useMemo(() => routes.filter((r) => trailState(topics[r.from], topics[r.to]) === 'walked').map((r) => r.full), [routes, topics])

  return (
    <div ref={setRoot} className={s.root} role="group" aria-label="Roadmap: the 18 topics as camps on one massif" aria-describedby={help}>
      <p id={help} className="sr-only">
        Left and right arrow keys move between camps along the roadmap, up and down move to the nearest camp above or below, Enter opens a camp.
      </p>
      <div ref={topProbe} className={s.probeTop} aria-hidden="true" />
      <div ref={bottomProbe} className={s.probeBottom} aria-hidden="true" />

      {ready ? (
        <svg className={s.svg} width="100%" height="100%">
          <defs>
            <GlowGradient id={glow} />
          </defs>
          <g ref={layerRef}>
            <SheetUnder layout={layout} />
            {terrain ? <TerrainLayer layout={layout} terrain={terrain} groupRef={terrainRef} /> : null}
            <Stars layout={layout} />
            <LightLayer layout={layout} glows={glows} walked={walked} />
            <SheetOver layout={layout} />
            <g>
              {routes.map((route) => (
                <Trail
                  key={route.key}
                  route={route}
                  state={trailState(topics[route.from], topics[route.to])}
                  tone={!traced ? 'rest' : incident.get(traced)?.has(route.key) ? 'hot' : active ? 'dim' : 'rest'}
                />
              ))}
            </g>
            <g>
              {ROADMAP_ORDER.map((id) => {
                const view = topics[id]
                const spot = layout.camps[id]
                return (
                  <Camp
                    key={id}
                    id={id}
                    x={spot.x}
                    y={spot.y}
                    side={spot.side}
                    names={nameLines(view.topic.short, layout.wrap)}
                    state={view.state}
                    progress={view.progress}
                    solved={view.solved}
                    total={view.total}
                    waiting={view.due}
                    allMastered={view.total > 0 && view.mastered === view.total}
                    recommended={view.recommended}
                    here={here === id}
                    selected={selected === id}
                    tone={!active ? 'rest' : id === active ? 'hot' : near?.has(id) || id === selected ? 'rest' : 'dim'}
                    tabStop={tabStop === id}
                    label={ariaLabel(view, here === id)}
                    glow={glow}
                    onOpen={openCamp}
                    onHover={setHover}
                    onFocusCamp={onFocusCamp}
                    onBlurCamp={onBlurCamp}
                    onKey={onKey}
                  />
                )
              })}
            </g>
          </g>
        </svg>
      ) : null}

      {tipView ? (
        <div ref={tipRef} className={s.tip} aria-hidden="true">
          <Frame tone="raised" pad="sm" label={`Level ${tipView.topic.level}`}>
            <div className={`place ${s.tipName}`}>{tipView.topic.name}</div>
            <dl className={s.tipGrid}>
              <div>
                <dt className="eyebrow">Solved</dt>
                <dd className="num">
                  {tipView.solved}/{tipView.total}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Mastered</dt>
                <dd className="num">{tipView.mastered}</dd>
              </div>
              <div>
                <dt className="eyebrow">Waiting</dt>
                <dd className="num">{tipView.due}</dd>
              </div>
              <div>
                <dt className="eyebrow">Strength</dt>
                <dd className={tipView.strength == null ? 'place muted' : 'num'}>{tipView.strength == null ? 'Uncharted' : Math.round(tipView.strength)}</dd>
              </div>
            </dl>
            <Meter className={s.tipMeter} value={tipView.strength == null ? null : tipView.strength / 100} tone="ember" height={3} />
          </Frame>
        </div>
      ) : null}
    </div>
  )
}
