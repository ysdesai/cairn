import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isTopicId, ROADMAP_ORDER, TOPIC_BY_ID } from '../../data'
import type { TopicId } from '../../data/types'
import { ROUTES } from '../../app/nav'
import { useDerived, useStatus } from '../../state/hooks'
import { cx, Loader, spring, useHotkeys } from '../../ui'
import MapCanvas from './canvas/MapCanvas'
import { Camera, Legend, TitleBlock } from './MapHud'
import TopicPanel from './TopicPanel'
import type { MapCanvasHandle, OpenedBy, ScreenRect } from './types'
import s from './MapScreen.module.css'

const PHONE = '(max-width: 760px)'

/** Width the camera column takes on a phone with a camp open: the buttons, and the gutter beside them. */
const CAMERA_COLUMN = 60

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE)
    const on = () => setPhone(query.matches)
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [])
  return phone
}

interface Inset {
  /** Pixels of the canvas the panel (and the controls beside it) cover on the side it docks to. */
  right: number
  bottom: number
}

const NO_INSET: Inset = { right: 0, bottom: 0 }

/** Measure how much of the canvas the open panel covers, so the camera can centre in the rest. */
function usePanelInset(open: boolean, phone: boolean) {
  const [inset, setInset] = useState<Inset>(NO_INSET)
  const [node, setNode] = useState<HTMLElement | null>(null)

  const setRef = useCallback((el: HTMLElement | null) => {
    setNode(el)
  }, [])

  useEffect(() => {
    if (!open || !node) {
      setInset(NO_INSET)
      return
    }
    // offset* ignores the entrance transform, so the inset is final from the first frame.
    const measure = () => {
      const next = phone
        ? { right: CAMERA_COLUMN, bottom: window.innerHeight - node.offsetTop }
        : { right: node.offsetWidth + 24, bottom: 0 }
      setInset((prev) => (prev.right === next.right && prev.bottom === next.bottom ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [open, node, phone])

  return { inset, node, setRef }
}

/**
 * The screen furniture lying over the drawing, measured, so the map can be framed around it.
 * Every element marked `data-furniture` inside `hud` counts; `shift` is the distance the camera
 * buttons have been slid to the left, which an element's offsets do not include.
 */
function useFurniture(hud: RefObject<HTMLElement | null>, shift: number): ScreenRect[] {
  const [rects, setRects] = useState<ScreenRect[]>([])
  const measure = useCallback(() => {
    const root = hud.current
    if (!root) return
    const next = [...root.querySelectorAll<HTMLElement>('[data-furniture]')].map((el) => {
      const dx = el.dataset.furniture === 'camera' ? -shift : 0
      const x0 = el.offsetLeft + dx
      const y0 = el.offsetTop
      return { x0, y0, x1: x0 + el.offsetWidth, y1: y0 + el.offsetHeight }
    })
    setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [hud, shift])

  // After every render: slots appear, disappear and change size with the screen's state.
  useLayoutEffect(() => {
    measure()
    const root = hud.current
    if (!root) return
    const observer = new ResizeObserver(measure)
    root.querySelectorAll('[data-furniture]').forEach((el) => observer.observe(el))
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  })

  return rects
}

/**
 * Sheet 02: the massif. The drawing fills the viewport; everything else here is marginalia on top
 * of it: a title block, a legend control, camera buttons, and the camp panel.
 */
export default function MapScreen() {
  const status = useStatus()
  if (status === 'loading') return <Loader label="Opening the map" />
  return <MapView />
}

function MapView() {
  const params = useParams<{ topicId?: string }>()
  const navigate = useNavigate()
  const derived = useDerived()
  const phone = usePhone()
  const handle = useRef<MapCanvasHandle>(null)
  const hud = useRef<HTMLDivElement>(null)
  const [legendOpen, setLegendOpen] = useState(false)
  const [openedBy, setOpenedBy] = useState<OpenedBy>('pointer')

  const selected: TopicId | null = params.topicId && isTopicId(params.topicId) ? params.topicId : null
  const here = useMemo(() => ROADMAP_ORDER.find((id) => derived.topics[id].recommended) ?? null, [derived.topics])
  const reached = derived.topicList.filter((t) => t.state === 'complete').length
  const { inset, node: panelNode, setRef } = usePanelInset(selected !== null, phone)

  // A URL that names no camp is a mistake in the address, not a place: land on the plain map.
  useEffect(() => {
    if (params.topicId && !selected) navigate(ROUTES.map, { replace: true })
  }, [params.topicId, selected, navigate])

  const onSelect = useCallback(
    (id: TopicId | null, by: OpenedBy = 'pointer') => {
      if (id) setOpenedBy(by)
      navigate(id ? ROUTES.topic(id) : ROUTES.map, { replace: selected !== null })
    },
    [navigate, selected],
  )

  // Closing a camp that was opened from the keyboard puts focus back on its camp, not on the page.
  const lastSelected = useRef<TopicId | null>(null)
  useEffect(() => {
    const prev = lastSelected.current
    lastSelected.current = selected
    if (!prev || selected) return
    const active = document.activeElement
    const inPanel = !!active && !!panelNode?.contains(active)
    if ((inPanel || active === document.body || !active) && (openedBy === 'key' || (inPanel && active?.matches(':focus-visible')))) {
      handle.current?.focusCamp(prev)
    }
  }, [selected, openedBy, panelNode])

  const goHere = useCallback(() => {
    if (here) handle.current?.flyTo(here)
    else handle.current?.fit()
  }, [here])

  useHotkeys({
    '+': () => handle.current?.zoomIn(),
    '=': () => handle.current?.zoomIn(),
    '-': () => handle.current?.zoomOut(),
    '0': () => handle.current?.fit(),
    h: goHere,
  })
  useHotkeys({ Escape: () => onSelect(null) }, { enabled: selected !== null })

  // A phone's panel is a bottom sheet over the map: the title and the legend step aside, and the
  // camera buttons stand in a column at the top of the strip of map left above it.
  const sheetOpen = phone && selected !== null
  const shift = phone ? 0 : Math.max(0, inset.right - 12)
  const furniture = useFurniture(hud, shift)

  const headline = `The massif: ${derived.counts.solved} of 150 solved, ${reached} of 18 camps reached${here ? `. Next on the route: ${TOPIC_BY_ID[here].name}` : ''}.`

  return (
    <div className={s.screen}>
      <h1 className="sr-only">{headline}</h1>
      <div className={s.canvas}>
        <MapCanvas topics={derived.topics} selected={selected} onSelect={onSelect} here={here} inset={inset} furniture={furniture} handle={handle} />
      </div>
      <div className={s.veil} aria-hidden="true" />

      <div ref={hud} className={s.hud}>
        <div className={cx(s.titleSlot, sheetOpen && s.stowed)} data-furniture={sheetOpen ? undefined : 'title'} inert={sheetOpen}>
          <TitleBlock strip={phone} solved={derived.counts.solved} reached={reached} here={here} onOpenCamp={onSelect} />
        </div>

        <div className={cx(s.legendSlot, sheetOpen && s.stowed)} data-furniture={sheetOpen ? undefined : 'legend'} inert={sheetOpen}>
          <Legend open={legendOpen && !sheetOpen} onOpenChange={setLegendOpen} />
        </div>

        <motion.div
          className={cx(s.cameraSlot, sheetOpen && s.cameraTop)}
          data-furniture="camera"
          initial={false}
          animate={{ x: -shift }}
          transition={spring.soft}
        >
          <Camera
            onZoomIn={() => handle.current?.zoomIn()}
            onZoomOut={() => handle.current?.zoomOut()}
            onFit={() => handle.current?.fit()}
            onHere={goHere}
            summit={here === null}
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {selected ? (
          <TopicPanel
            key="panel"
            view={derived.topics[selected]}
            topics={derived.topics}
            queue={derived.queue}
            today={derived.today}
            phone={phone}
            openedBy={openedBy}
            onSelect={onSelect}
            onClose={() => onSelect(null)}
            panelRef={setRef}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
