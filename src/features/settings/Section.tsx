import { motion } from 'framer-motion'
import { useId, type ReactNode } from 'react'
import { listItem } from '../../ui'
import s from './Settings.module.css'

interface SectionProps {
  /** Margin number, "01". */
  no: string
  title: string
  /** A sentence or two on what the section does. */
  blurb: ReactNode
  children: ReactNode
}

/** One row of the settings column: its name and explanation on the left, its controls on the right. */
export function Section({ no, title, blurb, children }: SectionProps) {
  const id = useId()
  return (
    <motion.section className={s.section} variants={listItem} aria-labelledby={id}>
      <div className={s.intro}>
        <p className="eyebrow">{no}</p>
        <h2 className="title title-sm" id={id}>
          {title}
        </h2>
        <p className={s.blurb}>{blurb}</p>
      </div>
      <div className={s.controls}>{children}</div>
    </motion.section>
  )
}
