import { Check } from 'lucide-react'
import { toISO } from '../../domain/dates'
import type { ProblemView } from '../../domain/types'
import { Field, Input, Textarea } from '../../ui'
import { EMPTY_NOTES } from '../../state/schema'
import { dayLabel } from './logic'
import { Section } from './Section'
import { useNotes, type NoteField } from './useNotes'
import s from './Notes.module.css'

export const INSIGHT_FIELD = 'problem-notes-insight'

function Saved() {
  return (
    <span className={s.saved}>
      <Check aria-hidden="true" /> Saved
    </span>
  )
}

/** The four note fields. They save by themselves, and can be filled in before the problem is solved. */
export function Notes({ view, today, open }: { view: ProblemView; today: string; open: boolean }) {
  const stored = view.record?.notes ?? EMPTY_NOTES
  const notes = useNotes(view.problem.slug, stored, open)
  const field = (name: NoteField) => ({
    value: notes.value(name),
    onChange: (event: { target: { value: string } }) => notes.edit(name, event.target.value),
    onBlur: notes.flush,
  })
  const aside = (name: NoteField) => (notes.isSaved(name) ? <Saved /> : undefined)
  const edited = stored.updatedAt ? `Edited ${dayLabel(toISO(new Date(stored.updatedAt)), today)}` : 'Optional'

  return (
    <Section label="Notes" aside={edited}>
      <div className={s.fields}>
        <Field label="Key insight" htmlFor={INSIGHT_FIELD} aside={aside('insight')}>
          <Textarea id={INSIGHT_FIELD} placeholder="What makes this click? One or two sentences." {...field('insight')} />
        </Field>
        <div className={s.pair}>
          <Field label="Time" htmlFor="problem-notes-time" aside={aside('time')}>
            <Input id="problem-notes-time" mono placeholder="O(n)" autoComplete="off" spellCheck={false} {...field('time')} />
          </Field>
          <Field label="Space" htmlFor="problem-notes-space" aside={aside('space')}>
            <Input id="problem-notes-space" mono placeholder="O(n)" autoComplete="off" spellCheck={false} {...field('space')} />
          </Field>
        </div>
        <Field label="Mistakes and watch-outs" htmlFor="problem-notes-pitfalls" aside={aside('pitfalls')}>
          <Textarea id="problem-notes-pitfalls" placeholder="Edge cases, off-by-ones, the line you got wrong last time." {...field('pitfalls')} />
        </Field>
      </div>
    </Section>
  )
}
