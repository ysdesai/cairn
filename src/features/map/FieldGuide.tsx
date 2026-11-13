import { CHEATSHEETS } from '../../data'
import type { TopicId } from '../../data/types'
import { CodeBlock, cx } from '../../ui'
import s from './FieldGuide.module.css'

/** The topic's cheat sheet, set out as a page of a field guide: signs, idea, template, pitfalls. */
export default function FieldGuide({ topic }: { topic: TopicId }) {
  const guide = CHEATSHEETS[topic]
  return (
    <div className={s.guide}>
      <section aria-labelledby="fg-signs">
        <h3 id="fg-signs" className={cx('eyebrow', s.head)}>
          Signs you are here
        </h3>
        <ul className={s.ticks}>
          {guide.clues.map((clue) => (
            <li key={clue}>{clue}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fg-idea">
        <h3 id="fg-idea" className={cx('eyebrow', s.head)}>
          The idea
        </h3>
        <p className={s.idea}>{guide.idea}</p>
      </section>

      <section aria-labelledby="fg-template">
        <h3 id="fg-template" className={cx('eyebrow', s.head)}>
          Template
        </h3>
        <CodeBlock code={guide.template} />
        <p className={s.note}>{guide.templateNote}</p>
      </section>

      <section aria-labelledby="fg-slip">
        <h3 id="fg-slip" className={cx('eyebrow', s.head)}>
          Where people slip
        </h3>
        <ul className={cx(s.ticks, s.slips)}>
          {guide.mistakes.map((mistake) => (
            <li key={mistake}>{mistake}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
