import { motion } from 'framer-motion'
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { mulberry32 } from '../../domain/rng'
import { WEAK_BELOW } from '../../domain/strength'
import type { TopicView } from '../../domain/types'
import { ROUTES } from '../../app/nav'
import { Button, ButtonLink, fade, useMeasure } from '../../ui'
import { CONFIDENCE_LABEL, PARTS, capitalize, pct, rankTopics, topicState, type TopicState } from './strengthMeta'
import s from './RangeChart.module.css'

/** Height an uncharted topic is drawn at, so the ridge stays one line. */
const NOMINAL = 20
const TICKS = [0, 25, 50, 75, 100]
const LABEL_CHARS = 16
const CHAR_W = 6.7

interface Zone {
  view: TopicView
  index: number
  cx: number
  left: number
  right: number
  peakY: number
  state: TopicState
  line: string
  area: string
}

interface Layout {
  width: number
  height: number
  top: number
  base: number
  plotH: number
  padL: number
  padR: number
  zoneW: number
  angle: number
  zones: Zone[]
}

function layoutFor(views: readonly TopicView[], width: number, ghost: boolean): Layout {
  const narrow = width < 560
  const padL = narrow ? 28 : 70
  const padR = narrow ? 6 : 58
  const zoneW = (width - padL - padR) / views.length
  // Steeper labels as the columns get tighter: 32° when they are wide, upright when they are slim.
  const angle = zoneW >= 52 ? -32 : zoneW >= 34 ? -52 : -90
  const plotH = ghost ? 100 : narrow ? 160 : 210
  const top = 40
  const base = top + plotH
  const labelH = Math.ceil(LABEL_CHARS * CHAR_W * Math.sin((-angle * Math.PI) / 180)) + 24
  const heights = views.map((v) => (!ghost && topicState(v) === 'ranked' ? (v.strength as number) : NOMINAL))
  const y = (h: number) => base - (h / 100) * plotH
  const rand = mulberry32(41)

  const saddles = heights.map((h, i) => {
    const neighbour = i === 0 ? h : Math.min(h, heights[i - 1])
    return (i === 0 ? 0.45 : 0.6) * neighbour
  })
  saddles.push(0.4 * heights[heights.length - 1])

  const zones = views.map((view, i): Zone => {
    const cx = padL + (i + 0.5) * zoneW
    const left = padL + i * zoneW
    const right = left + zoneW
    const peak = heights[i]
    const sl = saddles[i]
    const sr = saddles[i + 1]
    // Two points on each flank, nudged off the straight slope, so the silhouette reads as rock.
    const flank = (from: number, towardX: number, edgeX: number): [number, number][] =>
      [0.34, 0.68].map((f) => {
        const base = from + (peak - from) * Math.pow(f, 0.85)
        const wobble = (rand() - 0.5) * 0.3 * (peak - from)
        return [edgeX + (towardX - edgeX) * f, y(Math.min(peak - 1, Math.max(from, base + wobble)))]
      })
    const pts: [number, number][] = [[left, y(sl)], ...flank(sl, cx, left), [cx, y(peak)], ...flank(sr, cx, right).reverse(), [right, y(sr)]]
    const line = pts.map(([px, py], k) => `${k === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join('')
    return {
      view,
      index: i,
      cx,
      left,
      right,
      peakY: y(peak),
      state: ghost ? 'uncharted' : topicState(view),
      line,
      area: `${line}L${right.toFixed(1)},${base}L${left.toFixed(1)},${base}Z`,
    }
  })

  return { width, height: base + labelH, top, base, plotH, padL, padR, zoneW, angle, zones }
}

interface RangeChartProps {
  /** The topics in roadmap order. */
  views: readonly TopicView[]
  /** A flat, dotted preview with no figures, hover or readout, for the first-run page. */
  ghost?: boolean
  /** Set under the chart and above the readout: the key to what is drawn. */
  caption?: ReactNode
}

/**
 * "The range": the topics as a ridgeline whose peak heights are their strengths. Topics that are
 * uncharted, or too early to trust, are dotted outlines at a nominal height; the weakest ranked
 * topic is picked out in ember. Only ranked topics can be the weakest or the strongest.
 *
 * One tab stop: the chart is a single focusable group (arrow keys move between topics, Enter
 * opens one), and the ranked list under it carries every topic's link. The figures for the
 * chosen topic sit in a readout below the chart, so nothing floats over neighboring slopes.
 */
export default function RangeChart({ views, ghost = false, caption }: RangeChartProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const uid = useId().replace(/:/g, '')
  const navigate = useNavigate()
  const [sel, setSel] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const pressKind = useRef<string>('mouse')

  const layout = useMemo(() => (width > 0 ? layoutFor(views, width, ghost) : null), [views, width, ghost])

  const ranked = rankTopics(views)
  const weakest = !ghost && ranked.length >= 2 ? ranked[0] : null
  const strongest = !ghost && ranked.length >= 2 ? ranked[ranked.length - 1] : null
  const weakestIndex = weakest ? views.indexOf(weakest) : -1
  const measured = views.filter((v) => topicState(v) !== 'uncharted').length

  // The readout shows what the pointer is on, else the last choice, else the weakest.
  const shown = hover ?? sel ?? (weakestIndex >= 0 ? weakestIndex : null)

  const summary = ghost
    ? 'A preview of the range: eighteen topics, none charted yet.'
    : measured === 0
      ? 'The range: no topic has been solved in yet.'
      : `The range, topic strength from 0 to 100. ${ranked.length} of ${views.length} topics ranked.` +
        (strongest && weakest ? ` Strongest ${strongest.topic.name} at ${strongest.strength}, weakest ${weakest.topic.name} at ${weakest.strength}.` : '') +
        ' Arrow keys move between topics and Enter opens one. The list below gives every number.'

  const indexAt = (e: ReactPointerEvent<HTMLElement>) => {
    if (!layout) return null
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - layout.padL) / layout.zoneW)
    return i < 0 || i >= views.length ? null : i
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return
    const at = sel ?? (weakestIndex >= 0 ? weakestIndex : 0)
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = at - 1
    else if (e.key === 'ArrowRight') next = at + 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = views.length - 1
    else if (e.key === 'Enter' && shown !== null) {
      e.preventDefault()
      navigate(ROUTES.topic(views[shown].topic.id))
      return
    }
    if (next === null) return
    e.preventDefault()
    setSel(Math.max(0, Math.min(views.length - 1, next)))
  }

  const step = (by: number) => setSel(Math.max(0, Math.min(views.length - 1, (shown ?? 0) + by)))

  return (
    <div ref={ref} className={s.wrap} style={{ minHeight: layout ? undefined : 320 }}>
      {layout ? (
        <motion.div className={s.stage} variants={fade} initial="initial" animate="enter">
          <div
            className={s.plot}
            {...(ghost
              ? { role: 'img' as const }
              : {
                  role: 'group' as const,
                  tabIndex: 0,
                  onKeyDown,
                  onFocus: () => setSel((cur) => cur ?? (weakestIndex >= 0 ? weakestIndex : 0)),
                  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
                    pressKind.current = e.pointerType
                    if (e.pointerType !== 'mouse') {
                      const i = indexAt(e)
                      if (i !== null) setSel(i)
                    }
                  },
                  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
                    const i = indexAt(e)
                    if (e.pointerType === 'mouse') setHover(i)
                    else if (e.buttons > 0 && i !== null) setSel(i)
                  },
                  onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => e.pointerType === 'mouse' && setHover(null),
                  onClick: (e: React.MouseEvent<HTMLElement>) => {
                    // A mouse click opens the topic; a touch only chooses it, and the readout carries the link.
                    if (pressKind.current !== 'mouse' || e.detail === 0) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const i = Math.floor((e.clientX - rect.left - layout.padL) / layout.zoneW)
                    if (i >= 0 && i < views.length) navigate(ROUTES.topic(views[i].topic.id))
                  },
                })}
            aria-label={summary}
          >
            <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}-ink`} gradientUnits="userSpaceOnUse" x1="0" y1={layout.top} x2="0" y2={layout.base}>
                  <stop offset="0" className={s.inkTop} />
                  <stop offset="1" className={s.inkBottom} />
                </linearGradient>
                <linearGradient id={`${uid}-ember`} gradientUnits="userSpaceOnUse" x1="0" y1={layout.top} x2="0" y2={layout.base}>
                  <stop offset="0" className={s.emberTop} />
                  <stop offset="1" className={s.emberBottom} />
                </linearGradient>
                <clipPath id={`${uid}-rock`}>
                  {layout.zones.filter((z) => z.state === 'ranked').map((z) => (
                    <path key={z.view.topic.id} d={z.area} />
                  ))}
                </clipPath>
              </defs>

              {/* The axis, the strata and the weak line state numbers, so they wait for real data. */}
              {ghost ? (
                <>
                  <line className={s.baseline} x1={layout.padL} x2={layout.width - layout.padR} y1={layout.base} y2={layout.base} />
                  <text className={s.tick} x={layout.padL} y={layout.top} dominantBaseline="central">
                    PREVIEW · NOTHING CHARTED
                  </text>
                </>
              ) : (
                TICKS.map((t) => {
                  const ty = layout.base - (t / 100) * layout.plotH
                  return (
                    <g key={t}>
                      <line className={t === 0 ? s.baseline : s.grid} x1={layout.padL} x2={layout.width - layout.padR} y1={ty} y2={ty} />
                      <text className={s.tick} x={layout.padL - 8} y={ty} textAnchor="end" dominantBaseline="central">
                        {t}
                      </text>
                    </g>
                  )
                })
              )}

              {layout.zones.filter((z) => z.state === 'ranked').map((z) => (
                <path key={`fill-${z.view.topic.id}`} d={z.area} fill={`url(#${uid}-${z.view === weakest ? 'ember' : 'ink'})`} />
              ))}

              {/* Strata every ten points, cut to the silhouette: the contour texture of the massif. */}
              <g clipPath={`url(#${uid}-rock)`}>
                {Array.from({ length: 9 }, (_, k) => {
                  const sy = layout.base - ((k + 1) * 10 * layout.plotH) / 100
                  return <line key={k} className={s.strata} x1={layout.padL} x2={layout.width - layout.padR} y1={sy} y2={sy} />
                })}
              </g>

              {ghost || ranked.length === 0 ? null : (
                <>
                  <line className={s.weakLine} x1={layout.padL} x2={layout.width - layout.padR} y1={layout.base - (WEAK_BELOW / 100) * layout.plotH} y2={layout.base - (WEAK_BELOW / 100) * layout.plotH} />
                  {layout.padR > 20 ? (
                    <text className={s.weakNote} x={layout.width - layout.padR + 8} y={layout.base - (WEAK_BELOW / 100) * layout.plotH} dominantBaseline="central">
                      <tspan x={layout.width - layout.padR + 8} dy="-0.6em">Weak</tspan>
                      <tspan x={layout.width - layout.padR + 8} dy="1.2em">below {WEAK_BELOW}</tspan>
                    </text>
                  ) : null}
                </>
              )}

              {layout.zones.map((z) => {
                const isWeakest = z.view === weakest
                const on = shown === z.index && !ghost
                const lx = z.cx + 2
                const ly = layout.base + 14
                const ranked = z.state === 'ranked'
                return (
                  <g key={z.view.topic.id}>
                    {on ? <rect className={s.hitOn} x={z.left} y={layout.top - 14} width={layout.zoneW} height={layout.base - layout.top + 36} /> : null}
                    <path className={!ranked ? s.ridgeDotted : isWeakest ? s.ridgeWeak : s.ridge} d={z.line} data-on={on || undefined} />
                    {ranked ? (
                      <>
                        <circle className={isWeakest ? s.peakWeak : s.peak} cx={z.cx} cy={z.peakY} r={on ? 3.5 : 2.5} />
                        <text className={isWeakest ? s.valueWeak : s.value} x={z.cx} y={z.peakY - 9} textAnchor="middle">
                          {z.view.strength}
                        </text>
                      </>
                    ) : null}
                    <text
                      className={!ranked ? s.labelUncharted : isWeakest ? s.labelWeak : s.label}
                      x={lx}
                      y={ly}
                      textAnchor="end"
                      dominantBaseline="central"
                      transform={`rotate(${layout.angle} ${lx} ${ly})`}
                    >
                      {z.view.topic.short}
                    </text>
                  </g>
                )
              })}

              {weakest
                ? (() => {
                    const z = layout.zones[weakestIndex]
                    const flip = z.cx > layout.width * 0.6
                    return (
                      <g pointerEvents="none">
                        <line className={s.leader} x1={z.cx} x2={z.cx} y1={z.peakY - 20} y2={14} />
                        <text className={s.callout} x={z.cx + (flip ? -7 : 7)} y={14} textAnchor={flip ? 'end' : 'start'} dominantBaseline="central">
                          <tspan className={s.calloutEyebrow}>Weakest </tspan>
                          <tspan className={s.calloutName}>{weakest.topic.short}</tspan>
                        </text>
                      </g>
                    )
                  })()
                : null}
            </svg>
          </div>

          {caption}
          {ghost ? null : <Readout view={shown !== null ? views[shown] : null} onStep={step} />}
        </motion.div>
      ) : null}
    </div>
  )
}

/** The figures for one topic, pinned under the chart. */
function Readout({ view, onStep }: { view: TopicView | null; onStep: (by: number) => void }) {
  if (!view) {
    return (
      <div className={`${s.readout} ${s.readoutEmpty}`} aria-live="polite">
        <p className={s.readHint}>Point at a peak, or tap one, to read its figures here.</p>
      </div>
    )
  }
  const state = topicState(view)
  return (
    <div className={s.readout} aria-live="polite">
      <div className={s.readTop}>
        <Button size="sm" variant="ghost" iconOnly className={s.step} aria-label="Previous topic" icon={<ChevronLeft />} onClick={() => onStep(-1)} />
        <div className={s.readName}>
          <span className={`place ${s.readTitle}`}>{view.topic.name}</span>
          {state === 'uncharted' ? (
            <span className="eyebrow">Uncharted</span>
          ) : state === 'early' ? (
            <span className="eyebrow">Too early · {CONFIDENCE_LABEL[view.confidence].toLowerCase()}</span>
          ) : (
            <span className="num">
              {view.strength}
              <span className={s.of}> / 100</span>
              <span className={s.conf}> · {CONFIDENCE_LABEL[view.confidence].toLowerCase()}</span>
            </span>
          )}
        </div>
        <Button size="sm" variant="ghost" iconOnly className={s.step} aria-label="Next topic" icon={<ChevronRight />} onClick={() => onStep(1)} />
      </div>
      {state === 'ranked' ? (
        <>
          <div className={s.parts}>
            {PARTS.map(({ key, label }) => (
              <span key={key} className={s.part}>
                <span className={s.partLabel}>{label}</span>
                <span className={s.partTrack}>{view.parts[key] === null ? null : <span style={{ width: `${(view.parts[key] as number) * 100}%` }} />}</span>
                <span className="num">{pct(view.parts[key])}</span>
              </span>
            ))}
          </div>
          <p className={s.readNote}>{view.weakness ? capitalize(view.weakness) : 'No ingredient under 60%.'}</p>
        </>
      ) : (
        <p className={s.readNote}>
          {state === 'uncharted'
            ? 'Nothing solved here yet, so there is no strength to draw.'
            : 'Only a few attempts so far. A score needs more before it means much, so it is held back and the topic is not ranked.'}
        </p>
      )}
      <ButtonLink className={s.open} size="sm" variant="ghost" href={`#${ROUTES.topic(view.topic.id)}`} icon={<ArrowUpRight />}>
        Open {view.topic.name}
      </ButtonLink>
    </div>
  )
}
