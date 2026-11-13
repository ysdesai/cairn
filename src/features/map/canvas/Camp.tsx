import { memo, useId, type KeyboardEvent } from 'react'
import type { TopicId } from '../../../data/types'
import type { TopicState } from '../../../domain/types'
import { BEACON_H, BEACON_W, beaconSide, labelLines, RING, type Side } from './layout'
import s from './MapCanvas.module.css'

export interface CampProps {
  id: TopicId
  x: number
  y: number
  side: Side
  /** The name, one line or two. */
  names: string[]
  state: TopicState
  progress: number
  solved: number
  total: number
  waiting: number
  allMastered: boolean
  recommended: boolean
  here: boolean
  selected: boolean
  /** Hover or focus on a camp lifts it and its neighbours and quiets the rest. */
  tone: 'rest' | 'hot' | 'dim'
  tabStop: boolean
  label: string
  glow: string
  onOpen: (id: TopicId) => void
  onHover: (id: TopicId | null) => void
  onFocusCamp: (id: TopicId) => void
  onBlurCamp: (id: TopicId) => void
  onKey: (event: KeyboardEvent, id: TopicId) => void
}

export const STATE_CLASS: Record<TopicState, string> = {
  complete: s.campComplete,
  active: s.campActive,
  ready: s.campReady,
  ahead: s.campAhead,
}

const BEACON_TEXT = 'YOU ARE HERE'

/** Summit glyph: a survey triangle with its point. */
const TRIANGLE = 'M-8 6.4 L0 -8 L8 6.4 Z'

interface SymbolProps {
  state: TopicState
  progress: number
  mastered: boolean
  /** id of the alpenglow gradient, for a camp whose every problem is mastered. */
  glow: string
}

/**
 * The camp symbol itself: halo, ring, progress arc and glyph. The map draws it on every camp and
 * the legend and panel draw it again through `CampMark`, so the three can never disagree.
 */
export function CampSymbol({ state, progress, mastered, glow }: SymbolProps) {
  return (
    <g className={s.symbol}>
      <circle className={s.halo} r={RING + 5.5} />
      {state === 'active' ? <circle className={s.track} r={RING} /> : null}
      <circle className={s.ring} r={RING} style={mastered && state === 'complete' ? { stroke: `url(#${glow})` } : undefined} />
      {state === 'active' && progress > 0 ? (
        <circle className={s.arc} r={RING} pathLength={100} strokeDasharray={`${Math.max(1.5, progress * 100)} 100`} transform="rotate(-90)" />
      ) : null}
      {state === 'complete' ? (
        <g>
          <line className={s.pole} x1={-4.3} y1={9.8} x2={-4.3} y2={-10.4} />
          <path className={s.pennant} d="M-3.8 -10.4 L9 -5.6 L-3.8 -0.7 Z" style={mastered ? { fill: `url(#${glow})` } : undefined} />
        </g>
      ) : (
        <g>
          <path className={s.glyph} d={TRIANGLE} />
          <circle className={s.glyphDot} cx={0} cy={2} r={1.8} />
        </g>
      )}
    </g>
  )
}

interface MarkProps {
  state: TopicState
  /** 0…1, for the arc of a camp in progress. */
  progress?: number
  /** Every problem at five stones: the ring and flag take the alpenglow. */
  mastered?: boolean
  /** Next on the route: the outer ring the map draws round a recommended camp. */
  recommended?: boolean
  /** Square size in pixels. */
  size?: number
  /** How much heavier to draw the strokes than on the sheet, so a small mark stays a mark. */
  weight?: number
  className?: string
}

/** A camp symbol on its own, outside the map: in the legend, the camp panel and the command palette. */
export function CampMark({ state, progress = 0.5, mastered = false, recommended = false, size = 32, weight = 1.5, className }: MarkProps) {
  const id = `mark-${useId().replace(/:/g, '')}`
  const reach = RING + 11
  const classes = [STATE_CLASS[state], mastered && s.campMastered, className].filter(Boolean).join(' ')
  return (
    <svg
      className={s.mark}
      style={{ ['--sw' as string]: weight }}
      width={size}
      height={size}
      viewBox={`${-reach} ${-reach} ${reach * 2} ${reach * 2}`}
      aria-hidden="true"
      focusable="false"
    >
      {mastered ? (
        <defs>
          <GlowGradient id={id} />
        </defs>
      ) : null}
      <g className={classes}>
        {recommended ? <circle className={s.recRing} r={RING + 8} /> : null}
        <CampSymbol state={state} progress={progress} mastered={mastered} glow={id} />
      </g>
    </svg>
  )
}

/** The alpenglow, as an SVG gradient. */
export function GlowGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="var(--glow-1)" />
      <stop offset="0.5" stopColor="var(--glow-2)" />
      <stop offset="1" stopColor="var(--glow-3)" />
    </linearGradient>
  )
}

/** The "you are here" flag, as the map draws it, for the legend. */
export function BeaconMark() {
  return (
    <svg className={s.beaconMark} width={56} height={((BEACON_H + 8) * 56) / BEACON_W} viewBox={`${-BEACON_W / 2} -1 ${BEACON_W} ${BEACON_H + 8}`} aria-hidden="true" focusable="false">
      <g transform="translate(0 0)">
        <rect className={s.beaconTag} x={-BEACON_W / 2} y={0} width={BEACON_W} height={BEACON_H} rx={2.5} />
        <path className={s.beaconTag} d={`M-4.5 ${BEACON_H - 0.5} H4.5 L0 ${BEACON_H + 5} Z`} />
        <text className={s.beaconText} x={0} y={BEACON_H / 2 + 3.6}>
          {BEACON_TEXT}
        </text>
      </g>
    </svg>
  )
}

export const Camp = memo(function Camp(p: CampProps) {
  const { x, y, side, state } = p
  const { lines, box } = labelLines(side, p.names, [`${p.solved}/${p.total}`])
  const beacon = beaconSide(side)
  const by = beacon === 't' ? -(RING + 6) : RING + 6
  const reach = RING + 11

  const className = [
    s.camp,
    STATE_CLASS[state],
    p.allMastered && s.campMastered,
    p.recommended && s.campNext,
    p.selected && s.campSelected,
    p.tone === 'hot' && s.campHot,
    p.tone === 'dim' && s.campDim,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <g
      className={className}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={p.tabStop ? 0 : -1}
      aria-label={p.label}
      aria-pressed={p.selected}
      data-camp={p.id}
      data-state={state}
      onClick={() => p.onOpen(p.id)}
      onKeyDown={(e) => p.onKey(e, p.id)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && p.onHover(p.id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && p.onHover(null)}
      onFocus={() => p.onFocusCamp(p.id)}
      onBlur={() => p.onBlurCamp(p.id)}
    >
      <circle className={s.hit} r={RING + 14} />
      <rect className={s.hit} x={box.x0 - 4} y={box.y0 - 2} width={box.x1 - box.x0 + 8} height={box.y1 - box.y0 + 4} />

      {p.recommended ? (
        <>
          <circle className={s.pulse} r={RING + 3} />
          <circle className={`${s.pulse} ${s.pulseLate}`} r={RING + 3} />
          <circle className={s.recRing} r={RING + 8} />
        </>
      ) : null}

      {p.selected ? <circle className={s.selDisc} r={RING + 17} /> : null}

      <CampSymbol state={state} progress={p.progress} mastered={p.allMastered} glow={p.glow} />

      {p.selected ? (
        <path
          className={s.reticle}
          d={`M${-reach} ${-RING - 1}V${-reach}H${-RING - 1} M${RING + 1} ${-reach}H${reach}V${-RING - 1} M${reach} ${RING + 1}V${reach}H${RING + 1} M${-RING - 1} ${reach}H${-reach}V${RING + 1}`}
        />
      ) : null}
      <circle className={s.focusRing} r={RING + 12} />

      {p.here ? (
        <g aria-hidden="true">
          <circle className={s.pulse} r={RING} />
          <g transform={`translate(0 ${by})`}>
            <path className={s.beaconTag} d={beacon === 't' ? 'M-5 -0.5 H5 L0 5.5 Z' : 'M-5 0.5 H5 L0 -5.5 Z'} />
            <g transform={`translate(0 ${beacon === 't' ? -BEACON_H - 4.5 : 4.5})`}>
              <rect className={s.beaconTag} x={-BEACON_W / 2} y={0} width={BEACON_W} height={BEACON_H} rx={2.5} />
              <text className={s.beaconText} x={0} y={BEACON_H / 2 + 3.6}>
                {BEACON_TEXT}
              </text>
            </g>
          </g>
        </g>
      ) : null}

      {p.waiting > 0 ? (
        <g className={s.badge} transform={`translate(${RING * 0.8} ${-RING * 0.8})`} aria-hidden="true">
          <circle className={s.badgeDisc} r={10.5} />
          <text className={`num ${s.badgeText}`} y={4}>
            {p.waiting > 99 ? '99' : p.waiting}
          </text>
        </g>
      ) : null}

      <g aria-hidden="true">
        {lines.map((line, i) => (
          <text
            key={i}
            className={line.kind === 'name' ? `place ${s.name}` : `num ${s.stat}`}
            x={line.x}
            y={line.y}
            textAnchor={line.anchor}
          >
            {line.text}
          </text>
        ))}
      </g>
    </g>
  )
})
