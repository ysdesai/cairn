import { LoaderCircle, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useActions, useData } from '../../state/hooks'
import { Button, Chip, toast } from '../../ui'
import { Section } from './Section'
import s from './Settings.module.css'

export function DemoSection() {
  const { demo } = useData()
  const actions = useActions()
  const [busy, setBusy] = useState(false)

  const run = async (task: () => Promise<void>, done: { message: string; detail: string }) => {
    setBusy(true)
    try {
      await task()
      toast({ ...done, tone: 'success' })
    } catch {
      toast({ message: 'That did not work', detail: 'Nothing was changed. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      no="06"
      title="Demo data"
      blurb="Loads about ten weeks of generated history so every screen can be seen full. Your own data is set aside while it runs, and comes back when you exit."
    >
      {demo ? (
        <>
          <p className={s.demoState}>
            <Chip tone="ember" variant="soft" dot>
              Demo active
            </Chip>
            <span className={s.demoText}>Every screen is showing generated history. Your own data is waiting to be restored.</span>
          </p>
          <div className={s.buttonRow}>
            <Button
              icon={busy ? <LoaderCircle className={s.spin} /> : <RotateCcw />}
              disabled={busy}
              aria-busy={busy}
              onClick={() => void run(() => actions.clearDemo(), { message: 'Your data is back', detail: 'The demo has ended.' })}
            >
              {busy ? 'Restoring' : 'Exit demo and restore my data'}
            </Button>
          </div>
        </>
      ) : (
        <div className={s.buttonRow}>
          <Button
            icon={busy ? <LoaderCircle className={s.spin} /> : <Play />}
            disabled={busy}
            aria-busy={busy}
            onClick={() => void run(() => actions.loadDemo(), { message: 'Demo data loaded', detail: 'Your own data is set aside.' })}
          >
            {busy ? 'Generating history' : 'Load demo data'}
          </Button>
        </div>
      )}
    </Section>
  )
}
