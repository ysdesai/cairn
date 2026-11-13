import { motion } from 'framer-motion'
import { useId } from 'react'
import { cx } from './cx'
import { spring } from './motion'
import s from './Cairn.module.css'

/** Five stones, widest at the bottom. One for each rung of the revision ladder. */
const STONES = [
  { cx: 12, cy: 26.2, rx: 9.2, ry: 3.1, rot: 0 },
  { cx: 11.3, cy: 20.6, rx: 7.4, ry: 2.8, rot: -4 },
  { cx: 12.7, cy: 15.5, rx: 5.9, ry: 2.5, rot: 5 },
  { cx: 11.7, cy: 10.9, rx: 4.5, ry: 2.2, rot: -6 },
  { cx: 12.4, cy: 6.9, rx: 3.2, ry: 1.9, rot: 4 },
] as const

export const CAIRN_STONES = STONES.length

interface CairnProps {
  /** Stones placed: 0…5. */
  step: number
  /** All five placed and the flag is up. */
  mastered?: boolean
  /** Height in px. Width follows (4:5). */
  size?: number
  /** ink: quiet. ember: this one wants attention (due). */
  tone?: 'ink' | 'ember'
  /** Let the newest stone drop in when `step` grows. */
  animate?: boolean
  className?: string
  /** Accessible description. Defaults to "n of 5 revisions cleared". */
  label?: string
  /** Purely visual: hide it from assistive technology (something beside it already says the same). */
  decorative?: boolean
}

/**
 * The cairn: how far a problem has climbed the revision ladder, as stacked stones.
 * Empty outlines are rungs still to come; a flag means mastered.
 */
export function Cairn({ step, mastered, size = 20, tone = 'ink', animate, className, label, decorative }: CairnProps) {
  const id = useId()
  const placed = Math.max(0, Math.min(CAIRN_STONES, Math.round(step)))
  const done = mastered || placed >= CAIRN_STONES
  const text = label ?? (done ? 'Mastered' : `${placed} of ${CAIRN_STONES} revisions cleared`)
  return (
    <svg
      className={cx(s.cairn, s[tone], done && s.mastered, className)}
      width={(size * 24) / 30}
      height={size}
      viewBox="0 0 24 30"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative || undefined}
    >
      {decorative ? null : <title>{text}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--glow-3)" />
          <stop offset="0.55" stopColor="var(--glow-2)" />
          <stop offset="1" stopColor="var(--glow-1)" />
        </linearGradient>
      </defs>
      {STONES.map((stone, i) => {
        const filled = i < placed
        const transform = `rotate(${stone.rot} ${stone.cx} ${stone.cy})`
        if (!filled) {
          return <ellipse key={i} className={s.ghost} cx={stone.cx} cy={stone.cy} rx={stone.rx - 0.5} ry={stone.ry - 0.5} transform={transform} />
        }
        const isNewest = animate && i === placed - 1
        return (
          <motion.ellipse
            key={`f${i}`}
            className={s.stone}
            cx={stone.cx}
            cy={stone.cy}
            rx={stone.rx}
            ry={stone.ry}
            transform={transform}
            style={done ? { fill: `url(#${id})` } : undefined}
            initial={isNewest ? { y: -14, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={spring.bouncy}
          />
        )
      })}
      {done ? (
        <motion.g
          className={s.flag}
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring.bouncy, delay: animate ? 0.18 : 0 }}
          style={{ transformOrigin: '12.4px 5px' }}
        >
          <path d="M12.4 5.2V0.6" />
          <path className={s.pennant} d="M12.4 0.6 17 2.1 12.4 3.6Z" />
        </motion.g>
      ) : null}
    </svg>
  )
}
