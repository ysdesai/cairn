import { motion } from 'framer-motion'
import { useState } from 'react'
import { getProblem } from '../../data'
import { formatDate, formatMinutes, toISO } from '../../domain/dates'
import { RATING_META } from '../../state/schema'
import type { MockResult, MockSession } from '../../state/schema'
import { Button, Chip, Empty, GradeMark, listContainer, listItem, RATING_TONE } from '../../ui'
import { useProblemSheet } from '../../app/nav'
import { minutesUsed } from './format'
import s from './History.module.css'

const FIRST_PAGE = 8

function Outcome({ result }: { result: MockResult | undefined }) {
  if (!result || result.outcome === 'unfinished') return <Chip>Did not finish</Chip>
  return (
    <Chip tone={RATING_TONE[result.outcome]} variant="soft" dot>
      {RATING_META[result.outcome].label}
    </Chip>
  )
}

export function History({ mocks }: { mocks: MockSession[] }) {
  const sheet = useProblemSheet()
  const [all, setAll] = useState(false)
  const newest = [...mocks].sort((a, b) => b.startedAt - a.startedAt)
  const shown = all ? newest : newest.slice(0, FIRST_PAGE)

  const attempted = newest.reduce((n, m) => n + m.slugs.length, 0)
  const finished = newest.reduce((n, m) => n + m.slugs.filter((slug) => m.results[slug] && m.results[slug].outcome !== 'unfinished').length, 0)

  return (
    <section className={s.section} aria-labelledby="mock-history">
      <div className={s.head}>
        <div>
          <p className="eyebrow">Logbook</p>
          <h2 id="mock-history" className="title">
            Past mocks
          </h2>
        </div>
        {newest.length > 0 ? (
          <p className={s.summary}>
            Finished <span className="num">{finished}</span> of <span className="num">{attempted}</span> problems
          </p>
        ) : null}
      </div>

      {newest.length === 0 ? (
        <Empty
          compact
          seed={21}
          title="No mocks yet"
          body="Start one above. Each mock you finish is listed here with how every problem went and the time it took."
        />
      ) : (
        <>
          <motion.ol className={s.list} variants={listContainer} initial="initial" animate="enter">
            {shown.map((mock, index) => {
              const date = toISO(new Date(mock.startedAt))
              const Item = index < 12 ? motion.li : 'li'
              const motionProps = index < 12 ? { variants: listItem } : {}
              return (
                <Item key={mock.id} className={s.item} {...motionProps}>
                  <div className={s.when}>
                    <p className="num">{formatDate(date)}</p>
                    <p className="eyebrow">{formatDate(date, 'dow')}</p>
                  </div>
                  <ul className={s.problems}>
                    {mock.slugs.map((slug) => {
                      const problem = getProblem(slug)
                      if (!problem) return null
                      const result = mock.results[slug]
                      return (
                        <li key={slug} className={s.problem}>
                          <span className={s.name}>
                            <GradeMark difficulty={problem.difficulty} />
                            <button type="button" className={s.title} onClick={() => sheet.open(slug)}>
                              <span className="truncate">{problem.title}</span>
                            </button>
                          </span>
                          <span className={s.result}>
                            <Outcome result={result} />
                            {result?.minutes != null ? <span className={`num ${s.mins}`}>{formatMinutes(result.minutes)}</span> : null}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <div className={s.used}>
                    <p className="num">{formatMinutes(minutesUsed(mock))}</p>
                    <p className="eyebrow">of {formatMinutes(mock.config.minutes)}</p>
                  </div>
                </Item>
              )
            })}
          </motion.ol>
          {newest.length > FIRST_PAGE ? (
            <div className={s.more}>
              <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
                {all ? 'Show recent only' : `Show all ${newest.length}`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
