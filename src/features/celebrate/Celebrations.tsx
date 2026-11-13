import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Flame, X } from 'lucide-react'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../app/nav'
import { getProblem } from '../../data'
import type { TopicId } from '../../data/types'
import type { AppEvent } from '../../state/store'
import { useActions, useEvents, useTopicView } from '../../state/hooks'
import { Button, Cairn, cx, Frame, spring } from '../../ui'
import { SummitArt } from './SummitArt'
import Summit from './Summit'
import s from './Celebrations.module.css'

const DURATION = { mastered: 5000, 'topic-complete': 8000, streak: 4000 } as const

/**
 * Leave on its own after `ms`. Hovering or focusing the card holds the clock, so a card
 * being read or clicked never slips away.
 */
function useDwell(ms: number, onDone: () => void) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const paused = hover || focus
  const left = useRef(ms)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (paused) return
    const started = Date.now()
    const id = window.setTimeout(() => done.current(), Math.max(0, left.current))
    return () => {
      window.clearTimeout(id)
      left.current -= Date.now() - started
    }
  }, [paused])

  return {
    paused,
    handlers: {
      onPointerEnter: () => setHover(true),
      onPointerLeave: () => setHover(false),
      onFocus: () => setFocus(true),
      onBlur: () => setFocus(false),
    },
  }
}

const card = {
  initial: { opacity: 0, y: 18, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.soft },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.18 } },
}

/**
 * A problem sheet is a modal dialog: while it is open, a press outside it counts as "clicking
 * away" and focus is held inside. A card is not outside it, so presses and focus that begin on a
 * card stop here instead of reaching the dialog's listeners.
 */
const keepToItself = { onPointerDown: (e: SyntheticEvent) => e.stopPropagation(), onFocus: (e: SyntheticEvent) => e.stopPropagation() }

/**
 * Marks that arrive on their own and leave on their own: one at a time, oldest first.
 *
 * Cards are portalled to <body>, like the sheet and the dialogs, so one lands above whichever is
 * open (the last solve of a topic is logged inside the sheet). They sit under the top bar, clear
 * of the toasts at the foot of the screen, and never take the page's focus.
 */
export default function Celebrations() {
  const events = useEvents()
  const actions = useActions()
  const current = events[0]
  const latest = useRef(current)
  latest.current = current

  // The region exists only while a card is up or leaving. Opening a sheet marks the page's
  // standing elements as hidden from assistive tech; one that arrives later is announced.
  const [mounted, setMounted] = useState(false)
  if (current && current.type !== 'summit' && !mounted) setMounted(true)

  const dismiss = (id: string) => actions.dismissEvent(id)

  return (
    <>
      {mounted
        ? createPortal(
            <div className={s.region} role="status" aria-live="polite" aria-atomic="true" {...keepToItself}>
              <AnimatePresence
                mode="wait"
                onExitComplete={() => {
                  if (!latest.current) setMounted(false)
                }}
              >
                {current?.type === 'mastered' ? <Mastered key={current.id} event={current} onDismiss={dismiss} /> : null}
                {current?.type === 'topic-complete' ? <TopicComplete key={current.id} event={current} onDismiss={dismiss} /> : null}
                {current?.type === 'streak' ? <Streak key={current.id} event={current} onDismiss={dismiss} /> : null}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
      <AnimatePresence>{current?.type === 'summit' ? <Summit key={current.id} onClose={() => dismiss(current.id)} /> : null}</AnimatePresence>
    </>
  )
}

type Props<T extends AppEvent> = { event: T; onDismiss: (id: string) => void }

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" iconOnly icon={<X />} aria-label="Dismiss" className={s.close} onClick={onClick} />
  )
}

function Mastered({ event, onDismiss }: Props<Extract<AppEvent, { type: 'mastered' }>>) {
  const problem = getProblem(event.slug)
  const close = () => onDismiss(event.id)
  const { paused, handlers } = useDwell(problem ? DURATION.mastered : 0, close)
  if (!problem) return null
  return (
    <motion.div className={cx(s.card, s.mastered)} {...card} {...handlers}>
      <Frame tone="raised" pad="none" as="div" className={s.frame}>
        <div className={s.masteredBody}>
          <span className={s.glow} aria-hidden="true" />
          <Cairn step={5} mastered animate size={44} className={s.cairn} />
          <div className={s.text}>
            <span className="eyebrow">Mastered</span>
            <span className={cx('place', s.problem)}>{problem.title}</span>
            <span className={s.line}>It will not come back unless you revise it yourself.</span>
          </div>
          <CloseButton onClick={close} />
        </div>
        <span className={s.dwell} style={{ animationDuration: `${DURATION.mastered}ms`, animationPlayState: paused ? 'paused' : 'running' }} aria-hidden="true" />
      </Frame>
    </motion.div>
  )
}

function TopicComplete({ event, onDismiss }: Props<Extract<AppEvent, { type: 'topic-complete' }>>) {
  const navigate = useNavigate()
  const close = () => onDismiss(event.id)
  const { paused, handlers } = useDwell(DURATION['topic-complete'], close)
  const open = () => {
    navigate(ROUTES.topic(event.topic))
    close()
  }
  return (
    <motion.div className={cx(s.card, s.summitCard)} {...card} {...handlers}>
      <TopicCardBody topic={event.topic} paused={paused} onClose={close} onOpen={open} />
    </motion.div>
  )
}

function TopicCardBody({ topic, paused, onClose, onOpen }: { topic: TopicId; paused: boolean; onClose: () => void; onOpen: () => void }) {
  const view = useTopicView(topic)
  return (
    <Frame tone="raised" pad="none" as="div" className={s.frame}>
      <div className={s.summitBody}>
        <SummitArt className={s.art} />
        <div className={s.summitText}>
          <span className="eyebrow">Summit reached</span>
          <span className={cx('display', s.topicName)}>{view.topic.name}</span>
          <span className={s.facts}>
            <span className="num">{view.total}</span> problems
            {view.strength !== null ? (
              <>
                {' · '}strength <span className="num">{Math.round(view.strength)}</span>
              </>
            ) : null}
          </span>
          <div className={s.actions}>
            <Button size="sm" icon={<ArrowRight />} onClick={onOpen}>
              See it on the map
            </Button>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <span className={s.dwell} style={{ animationDuration: `${DURATION['topic-complete']}ms`, animationPlayState: paused ? 'paused' : 'running' }} aria-hidden="true" />
    </Frame>
  )
}

function Streak({ event, onDismiss }: Props<Extract<AppEvent, { type: 'streak' }>>) {
  useDwell(DURATION.streak, () => onDismiss(event.id))
  return (
    <motion.div className={s.pillWrap} {...card}>
      <span className={s.pill}>
        <Flame className={s.flame} aria-hidden="true" />
        <span>
          <span className="num">{event.days}</span> days in a row
        </span>
      </span>
    </motion.div>
  )
}
