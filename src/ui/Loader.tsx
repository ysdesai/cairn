import { cx } from './cx'
import s from './Loader.module.css'

/** Three stones settling, on a loop. For the moment before a screen has its data. */
export function Loader({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div className={cx(s.loader, className)} role="status">
      <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
        <ellipse className={s.a} cx="12" cy="18.6" rx="8.6" ry="3.4" />
        <ellipse className={s.b} cx="11.4" cy="12.4" rx="6.1" ry="2.9" />
        <ellipse className={s.c} cx="12.5" cy="6.9" rx="3.7" ry="2.4" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
