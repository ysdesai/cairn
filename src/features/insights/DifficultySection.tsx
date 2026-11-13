import { motion } from 'framer-motion'
import type { Counts, DifficultyStat } from '../../domain/types'
import { DIFFICULTY_LABEL, GradeMark, Meter, fade } from '../../ui'
import InsightsSection from './InsightsSection'
import s from './DifficultySection.module.css'

interface DifficultySectionProps {
  difficulty: DifficultyStat[]
  counts: Counts
}

const SCALE_STEP = 10

/** Easy, medium and hard side by side, then all of the problems as one long bar. */
export default function DifficultySection({ difficulty, counts }: DifficultySectionProps) {
  const rotation = counts.learning + counts.due
  const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0)
  const ticks = Array.from({ length: Math.floor(counts.total / SCALE_STEP) + 1 }, (_, i) => i * SCALE_STEP)

  return (
    <InsightsSection
      id="difficulty"
      eyebrow="Grades"
      aside={
        <>
          <span className="num">{counts.solved}</span> of <span className="num">{counts.total}</span> solved
        </>
      }
      title="Where the grades stand"
      lede={
        counts.solved === 0 ? (
          'Easy, medium and hard fill in as you solve, each against its target time.'
        ) : (
          <>
            <span className="num">{counts.solved}</span> solved, <span className="num">{counts.mastered}</span> of them mastered, with{' '}
            <span className="num">{counts.todo}</span> still to attempt.
          </>
        )
      }
    >
      <div className={s.head} aria-hidden="true">
        <span />
        <span className="eyebrow">Solved</span>
        <span className="eyebrow">Mastered</span>
        <span className="eyebrow">Average first solve</span>
      </div>
      <ul className={s.rows}>
        {difficulty.map((d) => (
          <li key={d.difficulty} className={s.row}>
            <GradeMark difficulty={d.difficulty} label size={12} className={s.grade} />
            <div className={s.cell}>
              <span className={`eyebrow ${s.cellLabel}`}>Solved</span>
              <span className={s.figure}>
                <span className={`stat ${s.big}`}>{d.solved}</span>
                <span className={`num ${s.of}`}>of {d.total}</span>
              </span>
            </div>
            <div className={s.cell}>
              <span className={`eyebrow ${s.cellLabel}`}>Mastered</span>
              <span className={s.figure}>
                <span className={`stat ${s.big}`}>{d.mastered}</span>
                <span className={`num ${s.of}`}>of {d.total}</span>
              </span>
            </div>
            <div className={s.cell}>
              <span className={`eyebrow ${s.cellLabel}`}>Average first solve</span>
              {d.avgMinutes === null ? (
                <>
                  <span className={s.time}>No timed solves yet</span>
                  <Meter value={null} height={5} />
                </>
              ) : (
                <>
                  <span className={s.time}>
                    <span className="num">{Math.round(d.avgMinutes)} min</span> · target <span className="num">{d.target}</span>
                  </span>
                  <Meter
                    value={d.avgMinutes / (d.target * 2)}
                    marker={0.5}
                    height={5}
                    label={`${DIFFICULTY_LABEL[d.difficulty]} first solves average ${Math.round(d.avgMinutes)} minutes against a target of ${d.target}`}
                  />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className={s.totals}>
        <div className={s.totalsHead}>
          <span className="eyebrow">All {counts.total}</span>
          <span className="eyebrow">One tick per {SCALE_STEP}</span>
        </div>
        <motion.div
          className={s.bar}
          variants={fade}
          initial="initial"
          animate="enter"
          role="img"
          aria-label={`${counts.mastered} mastered, ${rotation} in rotation, ${counts.todo} to do, of ${counts.total} problems`}
        >
          <span className={s.mastered} style={{ width: `${pct(counts.mastered)}%` }} />
          <span className={s.rotation} style={{ width: `${pct(rotation)}%` }} />
        </motion.div>
        <div className={s.scale} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className={s.tick} style={{ left: `${pct(t)}%` }} data-major={t % 50 === 0 || undefined} data-end={pct(t) > 95 || undefined}>
              {t % 50 === 0 ? <span className="num">{t}</span> : null}
            </span>
          ))}
        </div>
        <dl className={s.legend}>
          <div>
            <dt>
              <span className={`${s.swatch} ${s.mastered}`} />
              Mastered
            </dt>
            <dd className={`num ${s.n}`}>{counts.mastered}</dd>
            <dd className={s.note}>all five rungs cleared</dd>
          </div>
          <div>
            <dt>
              <span className={`${s.swatch} ${s.rotation}`} />
              In rotation
            </dt>
            <dd className={`num ${s.n}`}>{rotation}</dd>
            <dd className={s.note}>
              <span className="num">{counts.learning}</span> learning, <span className="num">{counts.due}</span> due
            </dd>
          </div>
          <div>
            <dt>
              <span className={`${s.swatch} ${s.todo}`} />
              To do
            </dt>
            <dd className={`num ${s.n}`}>{counts.todo}</dd>
            <dd className={s.note}>not yet attempted</dd>
          </div>
        </dl>
      </div>
    </InsightsSection>
  )
}
