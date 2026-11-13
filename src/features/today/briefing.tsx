import type { ReactNode } from 'react'
import { PROBLEMS_BY_TOPIC, TOPIC_BY_ID } from '../../data'
import { formatMinutes } from '../../domain/dates'
import type { Derived, SessionView } from '../../domain/types'
import s from './briefing.module.css'

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** Numbers under ten as words, the rest as digits. */
export function words(n: number): string {
  return n >= 0 && n < 10 ? WORDS[n] : String(n)
}

export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function plural(n: number, one: string, many: string = `${one}s`): string {
  return n === 1 ? one : many
}

export interface Briefing {
  title: ReactNode
  lede: ReactNode
}

/** Due revisions that are not on today's route. */
export interface Backlog {
  /** Inside today's cap, but not on the route (they did not fit the time, or were never added). */
  fit: number
  /** Held back by the daily cap. They roll forward. */
  held: number
}

const minutes = (n: number) => <span className="num">{Math.round(n)}</span>

/** Numbers under ten as words, larger ones as figures in the mono face. */
const count = (n: number): ReactNode => (n < 10 ? words(n) : <span className="num">{n}</span>)

const Clause = ({ children }: { children: ReactNode }) => <span className={s.clause}>{children}</span>

/** The sentence about revisions that are due but not on the route. It never opens with a figure. */
function backlogLine(backlog: Backlog, cap: number, budget: number): ReactNode {
  const { fit, held } = backlog
  const total = fit + held
  if (total === 0) return null
  if (fit > 0 && held > 0) {
    return (
      <>
        {' '}
        Another {count(total)} {plural(total, 'revision is', 'revisions are')} waiting: {count(fit)} due today but not on the route, and the cap of{' '}
        <span className="num">{cap}</span> a day holds the other {count(held)}.
      </>
    )
  }
  if (fit > 0) {
    return (
      <>
        {' '}
        Another {count(fit)} {plural(fit, 'revision is', 'revisions are')} due today and did not fit in <span className="num">{budget}</span> minutes. Pull{' '}
        {fit === 1 ? 'it' : 'them'} in below.
      </>
    )
  }
  return (
    <>
      {' '}
      Another {count(held)} {plural(held, 'revision is', 'revisions are')} waiting; the cap of <span className="num">{cap}</span> a day keeps them
      from piling up.
    </>
  )
}

/** The headline and lede, written from where the user actually stands today. */
export function briefing(derived: Derived, session: SessionView, firstRun: boolean, backlog: Backlog): Briefing {
  const { counts, queue, activity, today, forecast } = derived
  const pending = session.items.filter((item) => !item.done)
  const revisions = pending.filter((item) => item.kind === 'review').length
  const fresh = pending.filter((item) => item.kind === 'new')
  const revisionsDone = session.items.filter((item) => item.kind === 'review' && item.done).length
  const finished = session.items.length > 0 && session.nextIndex === -1
  const toGo = pending.reduce((sum, item) => sum + item.minutes, 0)
  const anyWaiting = backlog.fit + backlog.held > 0

  const cap = backlogLine(backlog, queue.cap, session.budget)

  if (firstRun) {
    const base = TOPIC_BY_ID['arrays-hashing']
    return {
      title: (
        <>
          <Clause>The mountain is waiting.</Clause> <Clause>
            Start at <em>base camp</em>.
          </Clause>
        </>
      ),
      lede: (
        <>
          {base.name} is {words(PROBLEMS_BY_TOPIC['arrays-hashing'].length)} problems on counting and lookups; everything else builds on
          them.
          {toGo > 0 ? <> Today&rsquo;s route is about {minutes(toGo)} minutes.</> : null}
        </>
      ),
    }
  }

  if (counts.todo === 0 && queue.totalDue === 0 && revisions === 0 && fresh.length === 0) {
    return {
      title: (
        <>
          The whole massif is <em>behind you</em>.
        </>
      ),
      lede: (
        <>
          All <span className="num">{counts.total}</span> problems are solved, <span className="num">{counts.mastered}</span> of them mastered.
          Revisions return as their dates come around.
        </>
      ),
    }
  }

  if (finished) {
    const day = activity.days[today]
    const parts: string[] = []
    if (day && day.reviews > 0) parts.push(`${words(day.reviews)} ${plural(day.reviews, 'revision')}`)
    if (day && day.solves > 0) parts.push(`${words(day.solves)} new ${plural(day.solves, 'problem')}`)
    const tomorrow = forecast[1]?.scheduled ?? 0
    return {
      title: (
        <>
          That is today&rsquo;s route <em>done</em>.
        </>
      ),
      lede: (
        <>
          You logged {parts.length > 0 ? parts.join(' and ') : 'the whole route'}
          {day && day.minutes > 0 ? (
            <>
              {' '}
              in {minutes(day.minutes)} minutes
            </>
          ) : null}
          .{' '}
          {tomorrow > 0
            ? `${sentenceCase(words(tomorrow))} ${plural(tomorrow, 'revision is', 'revisions are')} scheduled for tomorrow.`
            : 'Nothing is scheduled for tomorrow.'}
          {cap}
        </>
      ),
    }
  }

  const first = fresh[0]?.problem
  // A long problem title makes a headline of three lines; the topic does the same job.
  const next = first ? { title: first.title.length > 26 ? TOPIC_BY_ID[first.topic].name : first.title } : undefined
  const left = session.doneCount > 0 ? ' left' : ''
  const over = session.plannedMinutes > session.budget
  const plan = (
    <>
      {sentenceCase(words(pending.length))} {plural(pending.length, 'stop')}
      {left}, about {minutes(toGo)}{' '}
      {session.doneCount === 0 ? (
        over ? (
          <>
            minutes, a little past your <span className="num">{session.budget}</span>
          </>
        ) : (
          <>
            of your <span className="num">{session.budget}</span> minutes
          </>
        )
      ) : (
        'minutes'
      )}
      .{cap}
    </>
  )

  if (revisions > 0 && next) {
    return {
      title: (
        <>
          <Clause>
            {sentenceCase(words(revisions))} {plural(revisions, 'revision')},
          </Clause>{' '}
          <Clause>
            then on to <em>{next.title}</em>.
          </Clause>
        </>
      ),
      lede: plan,
    }
  }
  if (revisions > 0) {
    return {
      title:
        revisionsDone > 0 ? (
          <>
            {sentenceCase(words(revisions))} {plural(revisions, 'revision')} left to <em>clear</em>.
          </>
        ) : (
          <>
            {sentenceCase(words(revisions))} {plural(revisions, 'revision')} to <em>clear</em> today.
          </>
        ),
      lede: plan,
    }
  }
  if (next) {
    // Revisions are only "cleared" when nothing inside today's allowance is left to do.
    const onTo = (
      <>
        On to <em>{next.title}</em>.
      </>
    )
    let title: ReactNode
    if (backlog.fit > 0) {
      title =
        revisionsDone > 0 ? (
          <>
            <Clause>Planned revisions done.</Clause> <Clause>{onTo}</Clause>
          </>
        ) : (
          <>
            New ground first: <em>{next.title}</em>.
          </>
        )
    } else if (anyWaiting || revisionsDone > 0) {
      title = (
        <>
          <Clause>{revisionsDone > 0 ? 'Revisions cleared.' : 'Today’s revisions are done.'}</Clause> <Clause>{onTo}</Clause>
        </>
      )
    } else {
      title = (
        <>
          <Clause>Nothing to revise.</Clause> <Clause>{onTo}</Clause>
        </>
      )
    }
    return { title, lede: plan }
  }
  if (pending.length > 0) {
    return {
      title:
        session.doneCount > 0 ? (
          <>
            Only the <em>warm-up</em> is left.
          </>
        ) : (
          <>
            A warm-up of <em>pattern cards</em>.
          </>
        ),
      lede: (
        <>
          {plan} A longer sitting makes room for revisions and new problems.
        </>
      ),
    }
  }
  return {
    title: (
      <>
        Nothing fits in <em>{formatMinutes(session.budget)}</em>.
      </>
    ),
    lede: <>Choose a longer sitting and the route fills in with what is due and what comes next.</>,
  }
}
