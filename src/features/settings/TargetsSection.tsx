import type { ReactNode } from 'react'
import type { Difficulty } from '../../data/types'
import { SETTINGS_LIMITS } from '../../state/reducers'
import { useActions, useSettings } from '../../state/hooks'
import { GradeMark } from '../../ui'
import { Section } from './Section'
import { Stepper } from './Stepper'
import s from './Settings.module.css'

const DIFFICULTIES: readonly { id: Difficulty; name: string; hint: string }[] = [
  { id: 'easy', name: 'Easy', hint: 'Warm-ups and pattern basics' },
  { id: 'medium', name: 'Medium', hint: 'The bulk of the route' },
  { id: 'hard', name: 'Hard', hint: 'The long pitches' },
]

function Row({ name, hint, children }: { name: ReactNode; hint: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <div className={s.rowText}>
        <span className={s.rowName}>{name}</span>
        <span className={s.rowHint}>{hint}</span>
      </div>
      {children}
    </div>
  )
}

export function TargetsSection() {
  const { targets, mockMinutes } = useSettings()
  const actions = useActions()

  return (
    <Section
      no="03"
      title="Timer targets"
      blurb="The solve timer compares your time with the target for each grade. A mock interview counts down from its own length."
    >
      <div className={s.rows}>
        {DIFFICULTIES.map(({ id, name, hint }) => (
          <Row key={id} name={<GradeMark difficulty={id} label size={12} />} hint={hint}>
            <Stepper
              label={`${name} target`}
              unit="min"
              value={targets[id]}
              min={SETTINGS_LIMITS.target.min}
              max={SETTINGS_LIMITS.target.max}
              step={5}
              onChange={(v) => actions.updateSettings({ targets: { [id]: v } })}
            />
          </Row>
        ))}
        <Row name="Mock interview" hint="One round, start to finish">
          <Stepper
            label="Mock interview length"
            unit="min"
            value={mockMinutes}
            min={SETTINGS_LIMITS.mockMinutes.min}
            max={SETTINGS_LIMITS.mockMinutes.max}
            step={5}
            onChange={(v) => actions.updateSettings({ mockMinutes: v })}
          />
        </Row>
      </div>
    </Section>
  )
}
