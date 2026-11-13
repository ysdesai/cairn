import { motion } from 'framer-motion'
import { Check, ChevronRight, Plus, Zap } from 'lucide-react'
import { Button, Chip, cx, FlagGlyph, listContainer, listItem, ProblemRow } from '../../ui'
import type { ListCursor } from '../../ui'
import type { ProblemView, SessionView } from '../../domain/types'
import type { SessionItemKind } from '../../state/schema'
import { Head } from './Head'
import { useNarrow } from './useNarrow'
import { plural, sentenceCase, words } from './briefing'
import s from './Route.module.css'

type Item = SessionView['items'][number]
type State = 'done' | 'next' | 'pending'

const GROUP: Record<SessionItemKind, string> = { drill: 'Warm-up', review: 'Revise', new: 'New ground' }

type Node =
  | { type: 'head'; key: string; kind: SessionItemKind; minutes: number; state: State }
  | { type: 'item'; key: string; item: Item; index: number; state: State }
  | { type: 'end'; state: State }

/**
 * The budget as a row of stops, one segment per stop and as long as its minutes; the unplanned
 * remainder is a dashed hairline. Ink for what is ahead, ember only for what is done.
 */
function Stops({ session }: { session: SessionView }) {
  const room = Math.max(0, session.budget - session.plannedMinutes)
  const over = session.plannedMinutes > session.budget
  return (
    <span
      className={s.stops}
      role="img"
      aria-label={`${session.plannedMinutes} of ${session.budget} minutes planned over ${session.items.length} stops; ${session.doneCount} done`}
    >
      {session.items.map((item, i) => (
        <span key={`${item.kind}-${item.slug ?? 'drill'}`} className={cx(s.stop, item.done && s.stopDone)} style={{ flexGrow: Math.max(1, item.minutes) }} data-i={i} />
      ))}
      {room > 0 ? <span className={s.room} style={{ flexGrow: room }} /> : null}
      {over ? <span className={s.limit} style={{ left: `${(session.budget / session.plannedMinutes) * 100}%` }} /> : null}
    </span>
  )
}

function nodesOf(session: SessionView, finished: boolean): Node[] {
  const out: Node[] = []
  let lastKind: SessionItemKind | null = null
  session.items.forEach((item, index) => {
    const state: State = item.done ? 'done' : index === session.nextIndex ? 'next' : 'pending'
    if (item.kind !== lastKind) {
      const minutes = session.items.filter((other) => other.kind === item.kind).reduce((sum, other) => sum + other.minutes, 0)
      out.push({ type: 'head', key: `head-${item.kind}`, kind: item.kind, minutes, state })
      lastKind = item.kind
    }
    out.push({ type: 'item', key: `${item.kind}-${item.slug ?? 'drill'}`, item, index, state })
  })
  out.push({ type: 'end', state: finished ? 'done' : 'pending' })
  return out
}

interface RouteProps {
  session: SessionView
  views: Record<string, ProblemView>
  cursor: ListCursor
  /** Due revisions that are not on the route, most urgent first: the cap's allowance first, then the ones it holds back. */
  outside: ProblemView[]
  /** How many of those are inside today's cap. */
  fit: number
  onOpen: (item: Item) => void
  onPull: () => void
  onBuildAnother: () => void
}

/** Today's queue drawn as a trail: a waypoint for each stop, the route behind you solid and the route ahead dashed. */
export function Route({ session, views, cursor, outside, fit, onOpen, onPull, onBuildAnother }: RouteProps) {
  const finished = session.items.length > 0 && session.nextIndex === -1
  const nodes = nodesOf(session, finished)
  const narrow = useNarrow()
  const held = outside.length - fit
  const next = outside[0]

  return (
    <motion.ol className={s.trail} variants={listContainer} initial="initial" animate="enter" aria-label="Today's route">
      {nodes.map((node, i) => {
        const above = i === 0 ? 'none' : node.state
        const below = nodes[i + 1]?.state ?? 'none'

        if (node.type === 'head') {
          return (
            <motion.li key={node.key} variants={listItem} className={cx(s.node, s.headNode, i > 0 && s.gap)} data-above={above} data-below={below}>
              <div className={s.rail} aria-hidden="true">
                <span className={s.cross} />
              </div>
              <div className={s.body}>
                <Head label={GROUP[node.kind]} aside={`${node.minutes} min`} />
              </div>
            </motion.li>
          )
        }

        if (node.type === 'end') {
          return (
            <motion.li key="end" variants={listItem} className={cx(s.node, s.endNode, s.gap)} data-above={above} data-below="none">
              <div className={s.rail} aria-hidden="true">
                <span className={cx(s.flag, finished && s.summit)}>
                  <FlagGlyph size={11} />
                </span>
              </div>
              <div className={s.body}>
                {finished ? (
                  <div className={s.finish}>
                    <h3 className="title title-sm">Route complete.</h3>
                    <p className="muted">Everything on today&rsquo;s route is logged. Pull in more work only if you have the time.</p>
                    <Button variant="primary" onClick={onBuildAnother} kbd="Enter">
                      Build another route
                    </Button>
                  </div>
                ) : (
                  <div className={s.plan}>
                    <div className={s.planTop}>
                      <span className="eyebrow">
                        Planned <span className="num">{session.plannedMinutes}</span> of <span className="num">{session.budget}</span> min
                      </span>
                      <span className="eyebrow num">
                        {session.doneCount} of {session.items.length} done
                      </span>
                    </div>
                    <Stops session={session} />
                  </div>
                )}
                {next ? (
                  <div className={s.pull}>
                    <p className="muted">
                      {fit > 0 ? (
                        <>
                          {sentenceCase(words(fit))} more {plural(fit, 'revision is', 'revisions are')} due today and did not fit.
                          {held > 0 ? <> The daily cap holds {words(held)} more back.</> : null}
                        </>
                      ) : (
                        <>
                          {sentenceCase(words(held))} {plural(held, 'revision is', 'revisions are')} waiting beyond the daily cap; {plural(held, 'it comes', 'they come')} up over the next days.
                        </>
                      )}
                    </p>
                    <Button size="sm" icon={<Plus />} onClick={onPull} className={s.pullButton} aria-label={`Pull ${next.problem.title} onto the route`}>
                      Pull one more
                    </Button>
                  </div>
                ) : null}
              </div>
            </motion.li>
          )
        }

        const { item, index } = node
        const view = item.slug ? views[item.slug] : undefined
        const isNext = node.state === 'next'
        const done = node.state === 'done'
        const active = cursor.shown && cursor.index === index
        const trailing = (
          <span className={s.trailing}>
            {isNext ? (
              <Chip tone="ember" variant="soft" className={s.nextChip}>
                Up next
              </Chip>
            ) : null}
            {done ? (
              <span className={s.doneMark}>
                <Check aria-hidden="true" />
                <span className={s.doneText}>Done</span>
              </span>
            ) : (
              <span className="num">≈ {item.minutes} min</span>
            )}
          </span>
        )

        return (
          <motion.li key={node.key} variants={listItem} className={s.node} data-above={above} data-below={below}>
            <div className={s.rail} aria-hidden="true">
              <span className={cx(s.mark, s[node.state])}>{done ? <Check /> : null}</span>
            </div>
            <div className={cx(s.body, s.item, isNext && s.isNext)}>
              {isNext ? <span className="sr-only">Up next. </span> : null}
              {view ? (
                <ProblemRow
                  view={view}
                  onOpen={() => onOpen(item)}
                  note={narrow ? undefined : item.reason}
                  detail={narrow ? item.reason : undefined}
                  showTopic={item.kind === 'review'}
                  trailing={trailing}
                  done={done}
                  active={active}
                />
              ) : (
                <button type="button" className={cx(s.drill, done && s.drillDone, active && s.drillActive)} data-active={active || undefined} onClick={() => onOpen(item)}>
                  <span className={s.drillGlyph}>
                    <Zap aria-hidden="true" />
                  </span>
                  <span className={s.drillText}>
                    <span className={s.drillTitle}>Pattern drill</span>
                    <span className={s.drillMeta}>{item.reason}</span>
                  </span>
                  <span className={s.drillTrail}>
                    {trailing}
                    <ChevronRight className={s.chevron} aria-hidden="true" />
                  </span>
                </button>
              )}
            </div>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
