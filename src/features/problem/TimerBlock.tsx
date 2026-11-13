import { Pause, Play, RotateCcw } from 'lucide-react'
import type { CSSProperties } from 'react'
import { getProblem } from '../../data'
import { formatClock } from '../../domain/dates'
import type { ProblemView } from '../../domain/types'
import { useActions, useSettings, useTimer } from '../../state/hooks'
import { Button, cx } from '../../ui'
import { Section } from './Section'
import s from './TimerBlock.module.css'

/** Tick spacing on the scale: every 5 minutes for short targets, wider for long ones. */
function tickStep(targetMinutes: number): number {
  return targetMinutes <= 30 ? 5 : targetMinutes <= 60 ? 10 : 15
}

interface TimerBlockProps {
  view: ProblemView
  /** Start on this problem, asking first if another problem's timer would be thrown away. */
  onSwitch: () => void
}

/** The solve timer: big mono digits, a ruled scale toward the target, and gold (not red) once past it. */
export function TimerBlock({ view, onSwitch }: TimerBlockProps) {
  const { problem } = view
  const actions = useActions()
  const settings = useSettings()
  const { timer, elapsedMs, running } = useTimer()

  const onThis = timer?.slug === problem.slug
  const elapsed = onThis ? elapsedMs : 0
  const targetMinutes = settings.targets[problem.difficulty]
  const targetMs = targetMinutes * 60_000
  const over = Math.max(0, elapsed - targetMs)
  const elsewhere = timer && !onThis ? getProblem(timer.slug) : undefined
  const ticks = Math.max(1, Math.round(targetMinutes / tickStep(targetMinutes)))

  return (
    <Section label="Timer" aside={<>target <span className="num">{formatClock(targetMs)}</span></>}>
      <div className={cx(s.timer, over > 0 && s.over)}>
        <div className={s.readout}>
          <p className={s.clock} role="timer" aria-label={`Elapsed ${formatClock(elapsed)}`}>
            {formatClock(elapsed)}
          </p>
          {over > 0 ? <p className={cx('num', s.overBy)}>+{formatClock(over)} over</p> : null}
          {running && onThis ? (
            <span className={s.live}>
              <span className={s.pulse} aria-hidden="true" />
              Running
            </span>
          ) : null}
        </div>

        <div className={s.controls}>
          {elsewhere ? (
            <Button icon={<Play />} onClick={onSwitch} kbd="t">
              Switch to this problem
            </Button>
          ) : running ? (
            <Button icon={<Pause />} onClick={() => actions.pauseTimer()} kbd="t">
              Pause
            </Button>
          ) : (
            <Button icon={<Play />} onClick={() => actions.startTimer(problem.slug)} kbd="t">
              Start
            </Button>
          )}
          {elsewhere ? null : (
            <Button variant="ghost" icon={<RotateCcw />} onClick={() => actions.resetTimer()} disabled={!onThis || (elapsed === 0 && !running)}>
              Reset
            </Button>
          )}
        </div>
      </div>

      <div
        className={cx(s.scale, over > 0 && s.over)}
        style={{ '--n': ticks, '--v': Math.min(1, elapsed / targetMs) } as CSSProperties}
        role="meter"
        aria-label="Time against target"
        aria-valuemin={0}
        aria-valuemax={targetMinutes}
        aria-valuenow={Math.min(targetMinutes, Math.round(elapsed / 60_000))}
        aria-valuetext={`${formatClock(elapsed)} of ${formatClock(targetMs)}`}
      >
        <span className={s.ticks} />
        <span className={s.baseline} />
        <span className={s.goal} />
        <span className={s.fill} />
      </div>

      {elsewhere ? (
        <p className={s.note}>
          The timer is {timer?.runningSince !== null ? 'running' : 'paused'} on <span className="place">{elsewhere.title}</span>.
        </p>
      ) : null}
    </Section>
  )
}
