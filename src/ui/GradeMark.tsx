import type { Difficulty } from '../data/types'
import { cx } from './cx'
import s from './GradeMark.module.css'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

interface GradeMarkProps {
  difficulty: Difficulty
  /** Show the word next to the mark. Without it the mark carries an accessible name. */
  label?: boolean
  /** Mark size in px. */
  size?: number
  className?: string
}

/**
 * Difficulty as a trail grade: green circle, blue square, black diamond.
 * Shape and colour together, so it never depends on colour alone.
 */
export function GradeMark({ difficulty, label, size = 10, className }: GradeMarkProps) {
  const name = DIFFICULTY_LABEL[difficulty]
  return (
    <span className={cx(s.grade, s[difficulty], className)} title={label ? undefined : name}>
      <svg width={size} height={size} viewBox="0 0 10 10" role={label ? 'presentation' : 'img'} aria-label={label ? undefined : name}>
        {difficulty === 'easy' ? <circle cx="5" cy="5" r="4.2" /> : null}
        {difficulty === 'medium' ? <rect x="1.1" y="1.1" width="7.8" height="7.8" rx="1.3" /> : null}
        {difficulty === 'hard' ? <path d="M5 0.3 9.7 5 5 9.7 0.3 5Z" /> : null}
      </svg>
      {label ? <span className={s.label}>{name}</span> : null}
    </span>
  )
}
