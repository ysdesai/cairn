import * as Popover from '@radix-ui/react-popover'
import { ChevronUp, Crosshair, Maximize, Minus, Plus } from 'lucide-react'
import { TOPIC_BY_ID } from '../../data'
import type { TopicId } from '../../data/types'
import { cx, Frame, Tip } from '../../ui'
import { CAMP_STATE, READY_PERCENT } from './campState'
import { BeaconMark, CampMark } from './canvas/Camp'
import { TrailMark, type TrailState } from './canvas/Trail'
import s from './MapHud.module.css'

const TOTAL = 150
const CAMPS = 18

interface TitleBlockProps {
  /** One short strip, for a phone: the headline and the two counts on a line. */
  strip?: boolean
  solved: number
  reached: number
  here: TopicId | null
  onOpenCamp: (id: TopicId) => void
}

/**
 * The title block of a printed sheet, and the screen's headline: a sentence from where the climb
 * stands, with the camp to look at in italics. Below it, how much of the massif has been walked.
 */
export function TitleBlock({ strip, solved, reached, here, onOpenCamp }: TitleBlockProps) {
  const fresh = solved === 0
  const next = here ? TOPIC_BY_ID[here] : null
  const camp = (id: TopicId, name: string) => (
    <button type="button" className={s.link} onClick={() => onOpenCamp(id)}>
      <em>{name}</em>
    </button>
  )
  const headline =
    fresh && next ? (
      <>Start at base camp: {camp(next.id, next.name)}.</>
    ) : next ? (
      <>Next on the route: {camp(next.id, next.short)}.</>
    ) : (
      <>
        Every camp is <em>reached</em>. Revisions keep the cairns standing.
      </>
    )

  return (
    <Frame as="div" pad="none" className={cx(s.title, strip && s.strip)}>
      <div className={s.titleInner}>
        {strip ? null : <p className="eyebrow">Sheet 02 · The massif</p>}
        <p className={cx('title title-sm', s.headline)}>{headline}</p>
        <p className={s.figure}>
          <span className={cx('stat', s.big)}>{solved}</span>
          <span className={cx('num', s.of)}>of {TOTAL} solved</span>
          <span className={cx('num', s.reached)}>
            {reached} of {CAMPS} camps reached
          </span>
        </p>
        <Scale value={solved / TOTAL} total={TOTAL} label={`${solved} of ${TOTAL} problems solved`} />
      </div>
    </Frame>
  )
}

/** A ruled scale bar: ticks every ten problems, longer every fifty, ember up to the current position. */
function Scale({ value, total, label }: { value: number; total: number; label: string }) {
  const ticks = Array.from({ length: total / 10 + 1 }, (_, i) => i * 10)
  return (
    <div className={s.scale} role="img" aria-label={label}>
      <span className={s.scaleFill} style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
      <span className={s.scaleTicks} aria-hidden="true">
        {ticks.map((t) => (
          <i key={t} className={cx(s.tick, t % 50 === 0 && s.tickMajor)} style={{ left: `${(t / total) * 100}%` }} />
        ))}
      </span>
    </div>
  )
}

const TRAILS: { state: TrailState; label: string; note: string }[] = [
  { state: 'walked', label: 'Walked', note: 'The camp behind is complete' },
  { state: 'open', label: 'Open', note: 'Ready or under way' },
  { state: 'ahead', label: 'Ahead', note: 'Further up' },
]

interface LegendProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The legend: a small control at the foot of the map that opens a card above itself. Its symbols
 * are the map's own, drawn by the same components, and each state says what it means.
 */
export function Legend({ open, onOpenChange }: LegendProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button type="button" className={cx(s.legendBtn, open && s.legendBtnOpen)} aria-label="Legend">
          <span className="eyebrow">Legend</span>
          <ChevronUp className={cx(s.chev, open && s.chevOpen)} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={s.legendPop} side="top" align="start" sideOffset={8} collisionPadding={12} onOpenAutoFocus={(e) => e.preventDefault()}>
          <Frame as="div" tone="raised" pad="none" className={s.legend}>
            <div className={s.legendBody}>
              <p className="eyebrow">Camps</p>
              <ul className={s.camps}>
                <li>
                  <CampMark state="complete" />
                  <span className={s.what}>
                    <b>{CAMP_STATE.complete.label}</b>
                    <span>{CAMP_STATE.complete.note}</span>
                  </span>
                </li>
                <li>
                  <CampMark state="complete" mastered />
                  <span className={s.what}>
                    <b>Mastered</b>
                    <span>Every cairn at five stones</span>
                  </span>
                </li>
                <li>
                  <CampMark state="active" progress={0.55} />
                  <span className={s.what}>
                    <b>{CAMP_STATE.active.label}</b>
                    <span>{CAMP_STATE.active.note}; the arc is how many</span>
                  </span>
                </li>
                <li>
                  <CampMark state="ready" recommended />
                  <span className={s.what}>
                    <b>{CAMP_STATE.ready.label}</b>
                    <span>{CAMP_STATE.ready.note}, ringed and breathing</span>
                  </span>
                </li>
                <li>
                  <CampMark state="ahead" />
                  <span className={s.what}>
                    <b>{CAMP_STATE.ahead.label}</b>
                    <span>{CAMP_STATE.ahead.note}</span>
                  </span>
                </li>
              </ul>

              <p className={cx('eyebrow', s.sub)}>Trails and position</p>
              <ul className={s.trails}>
                {TRAILS.map((t) => (
                  <li key={t.state}>
                    <TrailMark state={t.state} />
                    <span className={s.what}>
                      <b>{t.label}</b>
                      <span>{t.note}</span>
                    </span>
                  </li>
                ))}
                <li>
                  <BeaconMark />
                  <span className={s.what}>
                    <b>Where you are</b>
                    <span>The first camp on the route</span>
                  </span>
                </li>
              </ul>

              <hr className={cx('rule', s.legendRule)} />
              <p className={s.promise}>
                A camp is ready when each camp before it is <span className="num">{READY_PERCENT}%</span> solved. The map suggests an order. It never locks a camp.
              </p>
            </div>
          </Frame>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface CameraProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onHere: () => void
  /** There is nowhere left to climb, so "here" fits the whole map. */
  summit: boolean
}

/** The camera buttons, in a column. The keys are bound by the screen. */
export function Camera({ onZoomIn, onZoomOut, onFit, onHere, summit }: CameraProps) {
  return (
    <Frame as="div" tone="raised" pad="none" className={s.camera}>
      <div role="group" aria-label="Map camera" className={s.cameraList}>
        <Tip content="Zoom in" kbd="+" side="left">
          <button type="button" className={s.cam} onClick={onZoomIn} aria-label="Zoom in">
            <Plus />
          </button>
        </Tip>
        <Tip content="Zoom out" kbd="-" side="left">
          <button type="button" className={s.cam} onClick={onZoomOut} aria-label="Zoom out">
            <Minus />
          </button>
        </Tip>
        <Tip content="Fit the whole map" kbd="0" side="left">
          <button type="button" className={s.cam} onClick={onFit} aria-label="Fit the whole map">
            <Maximize />
          </button>
        </Tip>
        <Tip content={summit ? 'Show the whole map' : 'Where am I'} kbd="h" side="left">
          <button type="button" className={cx(s.cam, s.camHere)} onClick={onHere} aria-label={summit ? 'Show the whole map' : 'Go to where you are'}>
            <Crosshair />
          </button>
        </Tip>
      </div>
    </Frame>
  )
}
