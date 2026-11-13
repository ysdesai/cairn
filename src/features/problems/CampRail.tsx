import { useEffect, useRef, useState } from 'react'
import type { TopicId } from '../../data/types'
import { cx } from '../../ui'
import s from './CampRail.module.css'

export interface RailCamp {
  id: TopicId
  number: number
  short: string
  name: string
  solved: number
  total: number
  /** Rows showing under the current filters. */
  shown: number
}

interface CampRailProps {
  camps: RailCamp[]
  filtered: boolean
}

/** Pixels below the top of the window where a camp counts as "the one you are in": under the top bar and the pinned toolbar. */
const READING_LINE = 190

export const campAnchor = (id: TopicId) => `camp-${id}`

/**
 * The index of the atlas: the 18 camps as a trail down the margin, with the one on screen marked.
 * A node fills with alpenglow once every problem in the camp is solved. Wide screens only; narrower
 * ones have the Camp filter.
 */
export function CampRail({ camps, filtered }: CampRailProps) {
  const [current, setCurrent] = useState<TopicId | null>(camps[0]?.id ?? null)
  const frame = useRef(0)
  /** While a jump is scrolling, the scroll position is not allowed to move the marker back through the camps in between. */
  const jumping = useRef(0)
  const key = camps.map((c) => c.id).join()

  useEffect(() => {
    const find = () => {
      frame.current = 0
      if (jumping.current) return
      let found: TopicId | null = null
      for (const id of key.split(',') as TopicId[]) {
        const el = document.getElementById(campAnchor(id))
        if (!el) continue
        if (el.getBoundingClientRect().top <= READING_LINE) found = id
        else break
      }
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const ids = key.split(',') as TopicId[]
      setCurrent(atEnd && window.scrollY > 0 ? ids[ids.length - 1] : (found ?? ids[0] ?? null))
    }
    const onScroll = () => {
      if (!frame.current) frame.current = window.requestAnimationFrame(find)
    }
    find()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame.current) window.cancelAnimationFrame(frame.current)
    }
  }, [key])

  const jump = (id: TopicId) => {
    const el = document.getElementById(campAnchor(id))
    if (!el) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const done = () => {
      window.clearTimeout(jumping.current)
      jumping.current = 0
      window.removeEventListener('scrollend', done)
    }
    window.clearTimeout(jumping.current)
    jumping.current = window.setTimeout(done, 1500)
    window.addEventListener('scrollend', done, { once: true })
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
    setCurrent(id)
  }

  return (
    <nav className={s.rail} aria-label="Camps">
      <p className={cx('eyebrow', s.label)}>Camps</p>
      <ol className={s.list}>
        {camps.map((camp) => {
          const complete = camp.total > 0 && camp.solved === camp.total
          const on = camp.id === current
          return (
            <li key={camp.id}>
              <button
                type="button"
                className={s.item}
                aria-current={on ? 'location' : undefined}
                aria-label={`Camp ${camp.number}, ${camp.name}, ${camp.solved} of ${camp.total} solved${filtered ? `, ${camp.shown} shown` : ''}`}
                onClick={() => jump(camp.id)}
              >
                <span className={s.node} data-complete={complete || undefined} aria-hidden="true" />
                <span className={cx('num', s.number)} aria-hidden="true">
                  {String(camp.number).padStart(2, '0')}
                </span>
                <span className={s.name} aria-hidden="true">
                  {camp.short}
                </span>
                <span className={cx('num', s.count)} aria-hidden="true">
                  {filtered ? camp.shown : `${camp.solved}/${camp.total}`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
