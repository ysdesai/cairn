import { cx } from '../../ui'
import s from './SummitArt.module.css'

/**
 * A small drawn summit: a flag goes in at the peak, then one contour ring spreads across the
 * ground from its foot. Transform and opacity only; at rest it is the finished drawing.
 */
export function SummitArt({ className }: { className?: string }) {
  return (
    <svg className={cx(s.art, className)} viewBox="0 -8 140 92" aria-hidden="true" focusable="false">
      <g className={s.contours}>
        <ellipse cx="70" cy="72" rx="22" ry="3.2" />
        <ellipse cx="70" cy="72" rx="40" ry="6" />
        <ellipse cx="70" cy="72" rx="60" ry="9" />
      </g>
      <ellipse className={s.ripple} cx="70" cy="72" rx="22" ry="3.2" />
      <path className={s.ground} d="M2 72H138" />
      <path className={s.peak} d="M6 72 31 48 43 56 70 14 92 44 104 36 134 72" />
      <path className={s.crease} d="M70 14 62 36 70 45 77 31" />
      <path className={s.crease} d="M31 48 36 62M104 36 99 55" />
      <path className={s.pole} d="M70 14V-4" />
      <path className={s.pennant} d="M70 -4 83 0 70 4Z" />
    </svg>
  )
}
