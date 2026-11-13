import { LoaderCircle, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { PROBLEMS } from '../../data'
import { addDays, formatDate } from '../../domain/dates'
import { useActions, useData, useStatus, useToday } from '../../state/hooks'
import { readImportFile } from '../../state/transfer'
import { summarize } from '../../state/validate'
import { Button, CairnMark, Frame, Modal, Segmented, Terrain, confirm, toast } from '../../ui'
import s from './Welcome.module.css'

const WEEKS = [8, 12, 16, 24] as const
type Weeks = (typeof WEEKS)[number]

// Focus the primary action so Enter starts, without scrolling a short phone screen to the bottom.
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const focusQuietly = (el: HTMLButtonElement | null) => el?.focus({ preventScroll: true })

/** The title page of the atlas, shown once to someone who has not started and is not in the demo. */
export default function Welcome() {
  const status = useStatus()
  const { onboarded, demo } = useData()
  const today = useToday()
  const actions = useActions()
  const [weeks, setWeeks] = useState<Weeks>(12)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Radix reads the confirm dialog stacked above this one as an outside click; hold the welcome open meanwhile.
  const restoring = useRef(false)

  // The document is read asynchronously; until it is, "not onboarded" is only the default.
  const open = status === 'ready' && !onboarded && !demo

  const days = weeks * 7
  const perDay = PROBLEMS.length / days
  const summit = addDays(today, days - 1)

  const start = () => {
    actions.updateSettings({ startDate: today, targetDate: summit })
    actions.setOnboarded(true)
  }

  const lookAround = async () => {
    setBusy(true)
    try {
      await actions.loadDemo()
    } catch {
      toast({ message: 'Demo data did not load', detail: 'Nothing was changed. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  const restoreFrom = async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    setReading(true)
    restoring.current = true
    try {
      const result = await readImportFile(file, today, Date.now())
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      const incoming = summarize(result.data)
      const ok = await confirm({
        title: 'Start from this backup?',
        body: (
          <>
            <p>
              <span className="num">{file.name}</span> holds <span className="num">{plural(incoming.solved, 'solved problem')}</span> and{' '}
              <span className="num">{plural(incoming.attempts, 'attempt')}</span>, with its notes, drills and plan dates. Nothing is stored in this browser yet, so nothing is replaced.
            </p>
            {result.warnings.length > 0 ? (
              <>
                <p>Adjusted while reading:</p>
                <ul>
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ),
        confirmLabel: 'Restore backup',
      })
      if (!ok) return
      await actions.importData({ ...result.data, onboarded: true })
      toast({ message: 'Backup restored', detail: `${plural(incoming.solved, 'solved problem')}, ${plural(incoming.attempts, 'attempt')}`, tone: 'success' })
    } catch {
      setFileError('The backup could not be saved in this browser. Nothing was changed. Try again.')
    } finally {
      restoring.current = false
      setReading(false)
    }
  }

  return (
    <Modal
      bare
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy && !restoring.current) actions.setOnboarded(true)
      }}
      title="Welcome to Cairn"
      width={560}
      className={s.modal}
    >
      <Frame className={s.page} pad="none">
        <div className={s.terrain}>
          <Terrain seed={5} width={640} height={300} levels={12} scale={150} fade="down" />
        </div>

        <div className={s.title}>
          <CairnMark size={44} />
          <p className="eyebrow">A field atlas for the NeetCode 150</p>
          <p className={`display display-1 ${s.name}`} aria-hidden="true">
            Cairn
          </p>
        </div>

        <div className={s.body}>
          <p className={s.lede}>
            Work through <span className="num">{PROBLEMS.length}</span> problems, one waypoint at a time. Each one comes back for revision on a schedule, so nothing fades. Short drills
            train you to recognize the pattern before you start to code.
          </p>

          <div className={s.plan}>
            <p className="eyebrow" id="welcome-plan">
              How long is the route, in weeks
            </p>
            <Segmented<Weeks>
              label="Plan length in weeks"
              block
              value={weeks}
              onChange={setWeeks}
              options={WEEKS.map((w) => ({ value: w, label: String(w) }))}
            />
            <p className={s.consequence} aria-live="polite">
              That is about <span className="num">{perDay.toFixed(1)}</span> problems a day, finishing <span className="num">{formatDate(summit, 'medium')}</span>.
            </p>
          </div>

          <div className={s.actions}>
            <Button variant="primary" size="lg" ref={focusQuietly} disabled={busy || reading} onClick={start}>
              Start at base camp
            </Button>
            <Button size="lg" disabled={busy || reading} aria-busy={busy} icon={busy ? <LoaderCircle className={s.spin} /> : undefined} onClick={() => void lookAround()}>
              {busy ? 'Generating history' : 'Look around with demo data'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Backup file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void restoreFrom(file)
              }}
            />
            <Button variant="ghost" className={s.backup} icon={reading ? <LoaderCircle className={s.spin} /> : <Upload />} disabled={busy || reading} aria-busy={reading} onClick={() => fileRef.current?.click()}>
              {reading ? 'Reading file' : 'I have a backup'}
            </Button>
            {fileError ? (
              <p className={s.fileError} role="alert">
                {fileError}
              </p>
            ) : null}
          </div>
        </div>
      </Frame>
    </Modal>
  )
}
