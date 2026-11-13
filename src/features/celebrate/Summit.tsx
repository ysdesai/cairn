import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { area, curveMonotoneX, line } from 'd3-shape'
import { useMemo, useRef, type CSSProperties } from 'react'
import { diffDays } from '../../domain/dates'
import { useDerived, useToday } from '../../state/hooks'
import { Button, fade, LAYER, Terrain, useHotkeyLayer, valueNoise } from '../../ui'
import s from './Summit.module.css'

const W = 1200
const H = 360

/** Four ranges, far to near. Each is a ridge line with a few contour echoes under it. */
const RANGES = [
  { seed: 11, base: 232, amp: 200, scale: 250, fill: 46, echoes: [16, 36] },
  { seed: 29, base: 272, amp: 165, scale: 200, fill: 66, echoes: [14, 32, 54] },
  { seed: 47, base: 316, amp: 125, scale: 160, fill: 84, echoes: [12, 28] },
  { seed: 63, base: 354, amp: 72, scale: 120, fill: 100, echoes: [] as number[] },
]

function useRanges() {
  return useMemo(() => {
    return RANGES.map((range) => {
      const noise = valueNoise(range.seed)
      const points: [number, number][] = []
      for (let x = -20; x <= W + 20; x += 10) {
        // Folding the noise about its midpoint gives sharp crests and wide valleys; a finer
        // layer on top roughens the slopes.
        const broad = 1 - Math.abs(noise(x / range.scale, range.seed * 0.37) * 2 - 1)
        const fine = noise(x / (range.scale * 0.3), range.seed)
        points.push([x, range.base - (broad * 0.8 + fine * 0.2) * range.amp])
      }
      const ridge = line().curve(curveMonotoneX)(points) ?? ''
      const body =
        area<[number, number]>()
          .x((p) => p[0])
          .y0(H + 4)
          .y1((p) => p[1])
          .curve(curveMonotoneX)(points) ?? ''
      const echoes = range.echoes.map((dy) => line().curve(curveMonotoneX)(points.map(([x, y]) => [x, y + dy] as [number, number])) ?? '')
      return { ...range, ridge, body, echoes }
    })
  }, [])
}

/** The one time the app stops you: every problem is solved. */
export default function Summit({ onClose }: { onClose: () => void }) {
  const derived = useDerived()
  const today = useToday()
  const ranges = useRanges()
  const button = useRef<HTMLButtonElement>(null)
  useHotkeyLayer(LAYER.confirm, true)

  const firstSolve = derived.list.reduce<string | null>((first, view) => {
    const on = view.srs?.firstOn
    return on && (!first || on < first) ? on : first
  }, null)
  const days = firstSolve ? Math.max(0, diffDays(firstSolve, today)) : 0
  const attempts = derived.list.reduce((n, view) => n + view.attempts.length, 0)

  // A modal dialog of its own, portalled to <body>: it stacks over a problem sheet that is still
  // open (the usual place a last solve is logged), takes focus from it, and gives it back on close.
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          asChild
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            button.current?.focus()
          }}
        >
          <motion.div className={s.overlay} variants={fade} initial="initial" animate="enter" exit="exit">
            <div className={s.sky} aria-hidden="true">
              <Terrain seed={5} width={1200} height={600} levels={15} scale={240} fade="down" />
              <div className={s.sun} />
            </div>

            <svg className={s.range} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              {ranges.map((range, i) => (
                <g key={range.seed} className={s.layer} style={{ '--i': i } as CSSProperties}>
                  <path className={s.body} d={range.body} style={{ '--fill': `${range.fill}%` } as CSSProperties} />
                  {range.echoes.map((d, j) => (
                    <path key={j} className={s.echo} d={d} style={{ opacity: 0.55 - j * 0.15 }} />
                  ))}
                  <path className={s.ridge} d={range.ridge} />
                </g>
              ))}
            </svg>

            <div className={s.content}>
              <span className={`eyebrow ${s.rise}`} style={{ '--d': '0.7s' } as CSSProperties}>
                Summit · first light
              </span>
              <Dialog.Title asChild>
                <h2 className={`display ${s.headline} ${s.rise}`} style={{ '--d': '0.85s' } as CSSProperties}>
                  All {derived.counts.total}.
                </h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className={`${s.lede} ${s.rise}`} style={{ '--d': '1.05s' } as CSSProperties}>
                  Every waypoint is behind you. Revisions still come back on their schedule.
                </p>
              </Dialog.Description>

              <dl className={`${s.totals} ${s.rise}`} style={{ '--d': '1.2s' } as CSSProperties}>
                <div>
                  <dt className="eyebrow">Days since the first solve</dt>
                  <dd className="stat">{days}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Attempts logged</dt>
                  <dd className="stat">{attempts}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Problems mastered</dt>
                  <dd className="stat">{derived.counts.mastered}</dd>
                </div>
              </dl>

              <div className={s.rise} style={{ '--d': '1.4s' } as CSSProperties}>
                <Button ref={button} variant="primary" size="lg" onClick={onClose}>
                  Carry on
                </Button>
              </div>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
