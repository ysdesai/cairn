import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Play } from 'lucide-react'
import { TOPICS, TOTAL_PROBLEMS } from '../../data'
import type { TopicId } from '../../data/types'
import { mockPoolSize, pickMockProblems } from '../../domain/mock'
import { mulberry32 } from '../../domain/rng'
import { MOCK_MIX_META } from '../../state/schema'
import type { MockConfig, MockMix, MockPool } from '../../state/schema'
import { useActions, useData, useDerived, useSettings } from '../../state/hooks'
import { Button, fade, Frame, Meter, PageHeader, Segmented, ToggleChip, useHotkeys } from '../../ui'
import type { ReactNode } from 'react'
import { History } from './History'
import { numberWord } from './format'
import { mixShortfall } from './mixCheck'
import s from './Setup.module.css'

const MIX_OPTIONS = (Object.keys(MOCK_MIX_META) as MockMix[]).map((value) => ({
  value,
  label: MOCK_MIX_META[value].label,
}))

const POOL_OPTIONS: { value: MockPool; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'solved', label: 'Solved only' },
  { value: 'unsolved', label: 'Unsolved only' },
]

const LENGTHS = [30, 45, 60]
const ALL_TOPICS = TOPICS.map((t) => t.id)

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.row}>
      <div className={s.rowHead}>
        <p className="eyebrow">{label}</p>
        {hint ? <p className={s.hint}>{hint}</p> : null}
      </div>
      <div className={s.rowBody}>{children}</div>
    </div>
  )
}

export function Setup() {
  const derived = useDerived()
  const settings = useSettings()
  const data = useData()
  const actions = useActions()

  const [mix, setMix] = useState<MockMix>('medium-medium')
  const [pool, setPool] = useState<MockPool>('any')
  const [selected, setSelected] = useState<TopicId[]>(ALL_TOPICS)
  // Every topic is the default, so the chips stay folded until the user wants to narrow them.
  const [choosing, setChoosing] = useState(false)
  const chipsId = useId()

  const minutes = settings.mockMinutes
  const lengths = LENGTHS.includes(minutes) ? LENGTHS : [...LENGTHS, minutes].sort((a, b) => a - b)

  const allSelected = selected.length === ALL_TOPICS.length
  // An empty topics list means "every topic" to the engine, so nothing selected is handled here.
  const config: MockConfig = { mix, pool, topics: allSelected ? [] : selected, minutes }
  const poolSize = selected.length === 0 ? 0 : mockPoolSize(config, derived.list)
  const ready = poolSize >= 2
  const shortfall = ready ? mixShortfall(config, derived.list) : null

  const started = derived.topicList.filter((t) => t.solved > 0).map((t) => t.topic.id)
  const onlyStarted = started.length > 0 && selected.length === started.length && started.every((id) => selected.includes(id))

  const summary = allSelected
    ? `All ${ALL_TOPICS.length} topics`
    : selected.length === 0
      ? 'No topics selected'
      : selected.length <= 3
        ? ALL_TOPICS.filter((id) => selected.includes(id))
            .map((id) => TOPICS.find((t) => t.id === id)?.short ?? id)
            .join(', ')
        : `${selected.length} of ${ALL_TOPICS.length} topics`

  const done = data.mocks.filter((m) => m.status === 'done')

  function start() {
    if (!ready) return
    const picked = pickMockProblems(config, derived.list, mulberry32(Date.now()))
    if (picked.length < 2) return
    actions.startMock(config, picked.map((p) => p.slug))
  }

  // Enter starts the mock, but not while a button or link has focus: there it keeps its own
  // meaning (toggle the chip, press Start). The binding is read when the key is pressed.
  useHotkeys({
    get Enter() {
      const el = document.activeElement
      const onControl = el instanceof HTMLElement && el !== document.body && !!el.closest('button, a, input, select, textarea, [role="radio"]')
      return ready && !onControl ? start : false
    },
  })

  function toggle(id: TopicId, on: boolean) {
    setSelected((current) => (on ? [...current, id] : current.filter((t) => t !== id)))
  }

  return (
    <>
      <PageHeader
        sheet="05"
        name="Mock"
        terrain={5}
        meta={`${done.length} ${done.length === 1 ? 'mock' : 'mocks'} taken`}
        title={
          <>
            Two problems. <em className={s.nowrap}>{numberWord(minutes)}</em> minutes. No hints.
          </>
        }
        lede="The topic and pattern tags stay hidden until you rate. When time is up you say how each problem went, and the results count in your history like any other attempt."
      />

      <Frame label="Setup" aside={`${minutes} min`} pad="none">
        <div className={s.rows}>
          <Row label="Difficulty" hint={MOCK_MIX_META[mix].hint}>
            <Segmented label="Difficulty mix" value={mix} onChange={setMix} options={MIX_OPTIONS} className={s.mix} />
          </Row>

          <Row label="Pool" hint="Which problems can be drawn">
            <Segmented label="Pool" value={pool} onChange={setPool} options={POOL_OPTIONS} className={s.fit} />
          </Row>

          <Row label="Topics" hint="Where they can come from">
            <div className={s.topicLine}>
              <p className={s.topicSummary} aria-live="polite">
                {summary}
              </p>
              <Button
                size="sm"
                variant="ghost"
                icon={<ChevronDown className={choosing ? s.open : undefined} />}
                aria-expanded={choosing}
                aria-controls={chipsId}
                onClick={() => setChoosing((v) => !v)}
              >
                {choosing ? 'Done' : allSelected ? 'Choose topics' : 'Edit'}
              </Button>
            </div>
            {choosing ? (
              <motion.div id={chipsId} className={s.chooser} variants={fade} initial="initial" animate="enter">
                <div className={s.shortcuts}>
                  <Button size="sm" variant={allSelected ? 'secondary' : 'ghost'} aria-pressed={allSelected} onClick={() => setSelected(ALL_TOPICS)}>
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={onlyStarted ? 'secondary' : 'ghost'}
                    aria-pressed={onlyStarted}
                    disabled={started.length === 0}
                    title={started.length === 0 ? 'Solve a problem first and this fills in' : undefined}
                    onClick={() => setSelected(started)}
                  >
                    Only topics I have started
                  </Button>
                </div>
                <div className={s.chips} role="group" aria-label="Topics">
                  {TOPICS.map((topic) => {
                    const count = mockPoolSize({ ...config, topics: [topic.id] }, derived.list)
                    const on = selected.includes(topic.id)
                    return (
                      <ToggleChip
                        key={topic.id}
                        pressed={on}
                        onPressedChange={(on) => toggle(topic.id, on)}
                        tone="neutral"
                        className={s.chip}
                        title={`${topic.name}: ${count} in the pool`}
                      >
                        {topic.short}
                        <span className={`num ${s.count}`}>{count}</span>
                      </ToggleChip>
                    )
                  })}
                </div>
              </motion.div>
            ) : null}
          </Row>

          <Row label="Length" hint="Remembered for next time">
            <Segmented
              label="Length"
              value={minutes}
              onChange={(value) => actions.updateSettings({ mockMinutes: value })}
              options={lengths.map((value) => ({ value, label: `${value} minutes` }))}
              className={s.fit}
            />
          </Row>
        </div>

        <div className={s.foot}>
          <p className={s.poolLine} aria-live="polite">
            <span className="stat">{poolSize}</span>
            <span className={s.poolText}>{poolSize === 1 ? 'problem matches' : 'problems match'}</span>
          </p>
          <div className={s.meter}>
            <Meter value={poolSize / TOTAL_PROBLEMS} tone="ink" height={3} label={`${poolSize} of ${TOTAL_PROBLEMS} problems match`} />
          </div>
          <p className={s.note} role="status" data-kind={ready ? (shortfall ? 'mix' : undefined) : 'short'}>
            {!ready
              ? 'A mock needs two. Widen the pool or select more topics.'
              : shortfall ?? ''}
          </p>
          <div className={s.action}>
            <Button variant="primary" size="lg" icon={<Play />} kbd="Enter" disabled={!ready} onClick={start}>
              Start mock
            </Button>
          </div>
        </div>
      </Frame>

      <History mocks={done} />
    </>
  )
}
