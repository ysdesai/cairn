import { AnimatePresence, motion } from 'framer-motion'
import { Download, RotateCcw, Trash, Upload } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { formatDate } from '../../domain/dates'
import { useActions, useData, useToday } from '../../state/hooks'
import type { AppData } from '../../state/schema'
import { VOLATILE_STORAGE_MESSAGE, useStore } from '../../state/store'
import { downloadExport, readImportFile } from '../../state/transfer'
import { summarize, type DataSummary } from '../../state/validate'
import { Button, Frame, confirm, fade, toast } from '../../ui'
import { Section } from './Section'
import s from './Settings.module.css'

type ImportState =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; name: string; data: AppData; warnings: string[] }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The five counts that describe a document, as a row of numerals with a date range under them. */
function Figures({ summary, label }: { summary: DataSummary; label: string }) {
  const items: [number, string][] = [
    [summary.solved, 'Solved'],
    [summary.attempts, 'Attempts'],
    [summary.notes, 'Notes'],
    [summary.drills, 'Drill cards'],
    [summary.mocks, 'Mocks'],
  ]
  return (
    <div>
      <dl className={s.figures} aria-label={label}>
        {items.map(([n, name]) => (
          <div key={name} className={s.figure}>
            <dt className="eyebrow">{name}</dt>
            <dd className={`stat ${s.figureNum}`}>{n}</dd>
          </div>
        ))}
      </dl>
      <p className={`eyebrow ${s.range}`}>
        {summary.firstDate && summary.lastDate ? (
          <>
            <span className="num">{formatDate(summary.firstDate, 'medium')}</span> to <span className="num">{formatDate(summary.lastDate, 'medium')}</span>
          </>
        ) : (
          'No attempts yet'
        )}
      </p>
    </div>
  )
}

function Action({ name, text, children }: { name: string; text: ReactNode; children: ReactNode }) {
  return (
    <div className={s.action}>
      <div className={s.actionText}>
        <h3 className={s.actionName}>{name}</h3>
        <p className={s.actionBody}>{text}</p>
      </div>
      <div className={s.actionControl}>{children}</div>
    </div>
  )
}

export function DataSection() {
  const data = useData()
  const today = useToday()
  const actions = useActions()
  const summary = useMemo(() => summarize(data), [data])
  const [state, setState] = useState<ImportState>({ phase: 'idle' })
  const fileRef = useRef<HTMLInputElement>(null)

  const volatile = useStore((state) => state.storageError === VOLATILE_STORAGE_MESSAGE)
  const hasHistory = summary.attempts > 0 || summary.notes > 0 || summary.drills > 0 || summary.mocks > 0

  const exportNow = () => {
    downloadExport(data, today, Date.now())
    toast({ message: 'Backup downloaded', detail: `cairn-backup-${today}.json`, tone: 'success' })
  }

  // A backup taken inside the demo would hold generated history, and importing it later would make that history real.
  // The user's own data is parked, so leave the demo first, then back up what comes back.
  const exitDemoThenExport = async () => {
    try {
      await actions.clearDemo()
      downloadExport(useStore.getState().data, today, Date.now())
      toast({ message: 'Demo ended, backup downloaded', detail: `cairn-backup-${today}.json holds your own data`, tone: 'success' })
    } catch {
      toast({ message: 'That did not work', detail: 'Nothing was exported. Try again.' })
    }
  }

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    setState({ phase: 'reading' })
    const result = await readImportFile(file, today, Date.now())
    setState(result.ok ? { phase: 'ready', name: file.name, data: result.data, warnings: result.warnings } : { phase: 'error', message: result.error })
  }

  const replaceWithFile = async () => {
    if (state.phase !== 'ready') return
    const incoming = summarize(state.data)
    const ok = await confirm({
      title: incoming.solved === 0 && hasHistory ? 'This file holds no solved problems. Replace your data with it?' : 'Replace your data with this file?',
      body: (
        <div className={s.confirmBody}>
          <p>
            Cairn will keep <span className="num">{plural(incoming.solved, 'solved problem')}</span> and{' '}
            <span className="num">{plural(incoming.attempts, 'attempt')}</span> from the file. What is stored in this browser now is replaced
            {hasHistory ? ` (${plural(summary.attempts, 'attempt')} across ${plural(summary.solved, 'problem')})` : ', though nothing is logged yet'}.
          </p>
          {data.demo ? <p>The demo ends, and your own data that was set aside is replaced too.</p> : null}
        </div>
      ),
      confirmLabel: 'Replace my data',
      tone: 'danger',
    })
    if (!ok) return
    await actions.importData(state.data)
    setState({ phase: 'idle' })
    toast({ message: 'Backup restored', detail: `${plural(incoming.solved, 'solved problem')}, ${plural(incoming.attempts, 'attempt')}`, tone: 'success' })
  }

  const eraseAll = async () => {
    const ok = await confirm({
      title: 'Erase everything?',
      body: (
        <div className={s.confirmBody}>
          <p>
            This deletes {hasHistory ? <span className="num">{plural(summary.attempts, 'attempt')}</span> : 'the plan dates'}, every note, the drill history and the mocks from this
            browser. It cannot be undone.
          </p>
          {data.demo ? <p>The demo ends, and your own data that was set aside is erased too.</p> : null}
          <p>If you might want any of it back, export a backup first.</p>
        </div>
      ),
      confirmLabel: 'Erase everything',
      tone: 'danger',
    })
    if (!ok) return
    await actions.resetAll()
    setState({ phase: 'idle' })
    toast({ message: 'Everything erased', detail: 'A fresh plan starts today.' })
  }

  const incoming = state.phase === 'ready' ? summarize(state.data) : null

  return (
    <Section
      no="05"
      title="Your data"
      blurb={
        volatile
          ? 'This browser is not keeping anything: what you log is gone when the tab closes. Use Export to save a copy you can import later.'
          : 'Everything lives in this browser, in one file you can export. Clearing site data would erase it, so keep a copy somewhere safe.'
      }
    >
      {data.demo ? <p className={s.note}>The demo is loaded. The figures below describe the demo, not your own history.</p> : null}
      <Figures summary={summary} label={volatile ? 'Held for this tab only' : 'Stored in this browser'} />
      {!hasHistory ? <p className={s.footnote}>Solved problems, revisions and notes will be counted here as you log them.</p> : null}

      <div className={s.actions}>
        {data.demo ? (
          <Action
            name="Export"
            text="The demo is loaded, so a backup now would hold generated history, not yours. Your own data is set aside. This ends the demo, restores it and downloads that."
          >
            <Button icon={<RotateCcw />} onClick={() => void exitDemoThenExport()}>
              Exit demo, then export
            </Button>
          </Action>
        ) : (
          <Action name="Export" text="Download everything as a JSON backup. It restores on any device.">
            <Button icon={<Download />} onClick={exportNow}>
              Export backup
            </Button>
          </Action>
        )}

        <Action name="Import" text="Choose a backup made by Cairn. You will see what is inside before anything is replaced.">
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
              void chooseFile(file)
            }}
          />
          <Button icon={<Upload />} disabled={state.phase === 'reading'} onClick={() => fileRef.current?.click()}>
            {state.phase === 'reading' ? 'Reading file' : 'Choose a file'}
          </Button>
        </Action>

        <AnimatePresence initial={false} mode="wait">
          {state.phase === 'error' ? (
            <motion.div key="error" className={s.importPanel} variants={fade} initial="initial" animate="enter" exit="exit" role="alert">
              <Frame label="Could not read that file" pad="sm" ticks={false}>
                <p className={s.importMessage}>{state.message}</p>
              </Frame>
            </motion.div>
          ) : null}
          {state.phase === 'ready' && incoming ? (
            <motion.div key="ready" className={s.importPanel} variants={fade} initial="initial" animate="enter" exit="exit">
              <Frame label="In the file" aside={<span className="num">{state.name}</span>} pad="md">
                <div className={s.importBody}>
                  <Figures summary={incoming} label="In the backup file" />
                  {state.warnings.length > 0 ? (
                    <div className={s.group}>
                      <p className="eyebrow">Adjusted while reading</p>
                      <ul className={s.warnings}>
                        {state.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {incoming.solved === 0 && hasHistory ? (
                    <p className={s.importAlert} role="alert">
                      This file holds no solved problems, but what is stored here has history. Importing it would replace that history with an empty plan.
                    </p>
                  ) : null}
                  <p className={s.footnote}>
                    {hasHistory ? (
                      <>
                        Importing replaces what is stored here: <span className="num">{plural(summary.attempts, 'attempt')}</span> across{' '}
                        <span className="num">{plural(summary.solved, 'problem')}</span>, plus notes, drills and mocks.
                      </>
                    ) : (
                      'Nothing is logged here yet, so nothing is lost. The plan dates and timer targets come from the file.'
                    )}
                  </p>
                  <div className={s.buttonRow}>
                    <Button onClick={() => void replaceWithFile()}>Replace my data</Button>
                    <Button variant="ghost" onClick={() => setState({ phase: 'idle' })}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Frame>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Action name="Erase" text="Delete the plan, every attempt, note, drill and mock from this browser. Export first if you might want them back.">
          <Button variant="danger" icon={<Trash />} onClick={() => void eraseAll()}>
            Erase everything
          </Button>
        </Action>
      </div>
    </Section>
  )
}
