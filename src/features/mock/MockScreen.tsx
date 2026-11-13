import { motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useDerived } from '../../state/hooks'
import { pageVariants } from '../../ui'
import { Rating } from './Rating'
import { Running } from './Running'
import { Setup } from './Setup'
import s from './MockScreen.module.css'

/**
 * The mock interview screen. Which of the three states shows is decided by the stored mock,
 * not by local state, so a reload or a trip to another screen lands in the right place.
 */
export default function MockScreen() {
  const mock = useDerived().activeMock
  const state = !mock ? 'setup' : mock.status === 'running' ? 'running' : 'rating'
  // The first state needs no entrance of its own: the shell already animates the route.
  const settled = useRef(false)
  useEffect(() => {
    settled.current = true
  }, [])

  // When one state replaces another the old form is gone, so the new view opens at the top and
  // takes keyboard focus on its headline: Tab then starts inside it, not at the skip link.
  const stage = useRef<HTMLDivElement>(null)
  const shown = useRef(state)
  useLayoutEffect(() => {
    if (shown.current === state) return
    shown.current = state
    window.scrollTo(0, 0)
    const heading = stage.current?.querySelector<HTMLElement>('h1')
    if (!heading) return
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }, [state])

  return (
    <div className="page">
      <motion.div ref={stage} key={state} className={s.stage} variants={pageVariants} initial={settled.current ? 'initial' : false} animate="enter">
        {!mock ? <Setup /> : mock.status === 'running' ? <Running key={mock.id} mock={mock} /> : <Rating key={mock.id} mock={mock} />}
      </motion.div>
    </div>
  )
}
