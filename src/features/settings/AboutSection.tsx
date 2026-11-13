import { ArrowUpRight, Keyboard } from 'lucide-react'
import { PROBLEMS, TOPICS } from '../../data'
import { openShortcuts } from '../../app/ui'
import { Button } from '../../ui'
import { Section } from './Section'
import s from './Settings.module.css'

function External({ href, children }: { href: string; children: string }) {
  return (
    <a className={s.link} href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight aria-hidden="true" />
    </a>
  )
}

export function AboutSection() {
  return (
    <Section no="07" title="About" blurb={`${PROBLEMS.length} problems, ${TOPICS.length} camps, one route.`}>
      <p className={s.prose}>
        Cairn is a field atlas for working through the NeetCode 150. It tracks what you have solved, brings revisions back on a schedule, and trains you to
        recognize the pattern behind a problem. Everything stays in this browser; nothing is sent anywhere.
      </p>
      <p className={s.prose}>
        The problem list is the <External href="https://neetcode.io/roadmap">NeetCode 150</External>, and the video walkthroughs are{' '}
        <External href="https://www.youtube.com/@NeetCode">NeetCode on YouTube</External>.
      </p>
      <div className={s.buttonRow}>
        <Button icon={<Keyboard />} kbd="?" onClick={openShortcuts}>
          Keyboard shortcuts
        </Button>
      </div>
    </Section>
  )
}
