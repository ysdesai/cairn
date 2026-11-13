import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { ROADMAP_ORDER } from '../../data'
import type { Derived } from '../../domain/types'
import InsightsSection from './InsightsSection'
import RangeChart from './RangeChart'
import s from './BlankState.module.css'

/** Small hand-drawn marks, one per section: thin strokes, no numbers, so nothing reads as data. */
const GLYPH: Record<string, ReactNode> = {
  route: (
    <>
      <path className={s.g} d="M2 34 C14 34 18 20 30 22 S50 30 62 12" />
      <path className={s.ge} d="M62 12 L62 3 L70 6.5 L62 10" />
      <circle className={s.dot} cx="2" cy="34" r="2" />
    </>
  ),
  strength: (
    <path className={s.g} d="M2 36 L10 22 L16 30 L26 10 L34 28 L42 18 L50 32 L58 14 L66 30 L70 36" />
  ),
  plan: (
    <>
      <line className={s.gd} x1="2" y1="36" x2="70" y2="6" />
      <path className={s.ge} d="M2 36 C16 35 24 31 36 26 S50 20 52 19" />
    </>
  ),
  activity: (
    <>
      {Array.from({ length: 35 }, (_, i) => {
        const col = Math.floor(i / 5)
        const row = i % 5
        const lit = (col * 3 + row * 2) % 7
        return <rect key={i} className={lit < 2 ? s.cellLit : lit < 3 ? s.cellMid : s.cellOff} x={2 + col * 10} y={3 + row * 7.4} width="7" height="6" rx="1.5" />
      })}
    </>
  ),
  revisions: (
    <>
      <line className={s.g} x1="2" y1="36" x2="70" y2="36" />
      {[30, 24, 17, 9, 12, 6, 10].map((h, i) => (
        <rect key={i} className={i < 3 ? s.barLit : s.barOff} x={4 + i * 9.6} y={36 - h} width="6" height={h} />
      ))}
    </>
  ),
  mistakes: (
    <>
      {Array.from({ length: 24 }, (_, i) => {
        const col = i % 8
        const row = Math.floor(i / 8)
        const lit = (col * 5 + row * 3) % 9
        return <rect key={i} className={lit < 2 ? s.cellLit : lit < 4 ? s.cellMid : s.cellOff} x={2 + col * 8.6} y={4 + row * 11} width="7" height="9" rx="1.5" />
      })}
    </>
  ),
  difficulty: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line className={s.g} x1="2" y1={9 + i * 12} x2="70" y2={9 + i * 12} />
          <line className={s.ge} x1="2" y1={9 + i * 12} x2={[26, 38, 14][i]} y2={9 + i * 12} />
          <line className={s.g} x1="36" y1={5 + i * 12} x2="36" y2={13 + i * 12} />
        </g>
      ))}
    </>
  ),
}

const SECTIONS: readonly { key: keyof typeof GLYPH; title: string; body: string; after: string }[] = [
  { key: 'route', title: 'Work on this next', body: 'One suggestion with its reasoning, taken from your weakest topic or the revisions waiting.', after: 'your first solve' },
  { key: 'strength', title: 'Strength by topic', body: 'A range of eighteen peaks, one per topic, scored from ratings, solve times, revisions and drill. The weakest is picked out.', after: 'a few attempts in two topics' },
  { key: 'plan', title: 'Plan versus actual', body: 'Problems solved against the straight line to your target date, with the pace you keep and the finish it points to.', after: 'your first solve' },
  { key: 'activity', title: 'Your climbing days', body: 'A calendar of the days you solved or revised, your streak, and how long each day took.', after: 'your first solve' },
  { key: 'revisions', title: 'The revision ladder', body: 'What is due over the next two weeks, and how many problems stand on each rung.', after: 'your first solve' },
  { key: 'mistakes', title: 'What goes wrong, and where', body: 'Which mistake tags you log most, and the topics where they cluster.', after: 'your first tagged mistake' },
  { key: 'difficulty', title: 'Where the grades stand', body: 'Easy, medium and hard against their target times, then all 150 problems as one bar.', after: 'your first solve' },
]

/** What a first-time user sees: the range uncharted, and what each section will hold. */
export default function BlankState({ derived }: { derived: Derived }) {
  const views = ROADMAP_ORDER.map((id) => derived.topics[id])
  return (
    <>
      <InsightsSection
        id="range"
        eyebrow="Strength"
        title="The range, uncharted"
        lede="Each topic rises to its strength once you have solved in it. Eighteen peaks, all at one nominal height, none charted."
      >
        <RangeChart views={views} ghost />
      </InsightsSection>

      <InsightsSection
        id="sheet"
        eyebrow="On this sheet"
        title="What each section will show"
        aside={
          <>
            <span className="num">{SECTIONS.length}</span> sections
          </>
        }
      >
        <ol className={s.list}>
          {SECTIONS.map((section, i) => (
            <li key={section.key} className={s.item}>
              <span className={`num ${s.no}`}>{String(i + 1).padStart(2, '0')}</span>
              <svg className={s.glyph} width="72" height="40" viewBox="0 0 72 40" aria-hidden="true">
                {GLYPH[section.key]}
              </svg>
              <div className={s.text}>
                <h3 className="title title-sm">{section.title}</h3>
                <p className={s.body}>{section.body}</p>
              </div>
              <p className={`eyebrow ${s.after}`}>
                Fills in after
                <span className={s.afterWhen}>{section.after}</span>
              </p>
            </li>
          ))}
        </ol>
        <p className={s.foot}>
          <ArrowRight aria-hidden="true" size={14} />
          <span>Solve one problem and log it. This sheet starts measuring from the first attempt.</span>
        </p>
      </InsightsSection>
    </>
  )
}
