/**
 * The specimen sheet: every shared component on one page, in both themes.
 * Development only (see App.tsx); a place to check the kit as a whole.
 */
import { ArrowUpRight, Play, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { CHEATSHEETS } from '../data'
import { useDerived } from '../state/hooks'
import {
  Button,
  ButtonLink,
  Cairn,
  Chip,
  CodeBlock,
  confirm,
  Empty,
  Field,
  Frame,
  GradeMark,
  Input,
  Kbd,
  Meter,
  PageHeader,
  ProblemRow,
  Ring,
  Segmented,
  Select,
  Textarea,
  Ticker,
  toast,
  ToggleChip,
} from '../ui'

const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 } as const
const stack = { display: 'flex', flexDirection: 'column', gap: 28 } as const

export default function Kit() {
  const derived = useDerived()
  const [seg, setSeg] = useState<'40' | '60' | '90'>('60')
  const [on, setOn] = useState(true)
  const [n, setN] = useState(62)

  return (
    <div className="page">
      <PageHeader
        sheet="00"
        name="Specimen"
        meta="Day 43 of 84"
        terrain={3}
        title={
          <>
            Three revisions, then on to <em>Binary Search</em>.
          </>
        }
        lede="The interface kit. Names and headlines in Fraunces, the interface in Geist, measurements in Geist Mono."
        actions={
          <>
            <Button variant="primary" size="lg" icon={<Play />} kbd="Enter">
              Start session
            </Button>
            <Button size="lg">Rebuild</Button>
          </>
        }
      />

      <div style={stack}>
        <div style={{ ...row, alignItems: 'flex-end', gap: 40 }}>
          <div>
            <p className="eyebrow">Solved</p>
            <p className="stat" style={{ fontSize: 'var(--text-5xl)' }}>
              <Ticker value={n} />
              <span className="num muted" style={{ fontSize: 'var(--text-md)', marginLeft: 8 }}>
                / 150
              </span>
            </p>
          </div>
          <div>
            <p className="title">Section title</p>
            <p className="place" style={{ fontSize: 'var(--text-lg)' }}>
              Sliding Window
            </p>
            <p className="muted">
              Body text in Geist, <span className="num">1,240 m</span> in mono.
            </p>
          </div>
          <Button onClick={() => setN((v) => v + 7)}>Count up</Button>
        </div>

        <div style={row}>
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button size="sm" kbd="mod+k">
            With keys
          </Button>
          <ButtonLink href="https://leetcode.com" external icon={<ArrowUpRight />}>
            LeetCode
          </ButtonLink>
          <Button disabled>Disabled</Button>
          <Kbd keys="g t" />
        </div>

        <div style={row}>
          <Chip>Neutral</Chip>
          <Chip tone="ember" variant="soft">
            Revise today
          </Chip>
          <Chip tone="lake" variant="soft">
            Waiting 3d
          </Chip>
          <Chip tone="gold" variant="soft">
            Mastered
          </Chip>
          <Chip tone="moss" variant="soft" dot>
            Easy
          </Chip>
          <Chip tone="dusk" variant="soft" dot>
            Needed help
          </Chip>
          <Chip face="sans">monotonic stack</Chip>
          <ToggleChip pressed={on} onPressedChange={setOn}>
            Off-by-one
          </ToggleChip>
          <ToggleChip pressed={!on} onPressedChange={(v) => setOn(!v)} count={4}>
            Wrong pattern
          </ToggleChip>
          <GradeMark difficulty="easy" label />
          <GradeMark difficulty="medium" label />
          <GradeMark difficulty="hard" label />
        </div>

        <div style={{ ...row, gap: 24 }}>
          {[0, 1, 2, 3, 4].map((step) => (
            <Cairn key={step} step={step} size={40} tone={step === 2 ? 'ember' : 'ink'} />
          ))}
          <Cairn step={5} mastered size={40} />
          <Cairn step={3} size={22} />
          <Ring value={0.56} size={64} stroke={4} label="56%">
            <span className="num">5/9</span>
          </Ring>
          <Ring value={1} size={64} stroke={4} tone="glow" />
          <Ring value={0.3} size={28} stroke={3} tone="moss" />
          <div style={{ width: 180 }}>
            <Meter value={0.62} marker={0.8} />
          </div>
          <div style={{ width: 180 }}>
            <Meter value={null} />
          </div>
        </div>

        <div style={row}>
          <Segmented
            label="Time budget"
            value={seg}
            onChange={setSeg}
            options={[
              { value: '40', label: '40 min' },
              { value: '60', label: '60 min' },
              { value: '90', label: '90 min' },
            ]}
          />
          <Button onClick={() => toast({ message: 'Logged Two Sum', detail: 'Back in 3 days', tone: 'success', action: { label: 'Undo', onClick: () => undefined } })}>
            Toast
          </Button>
          <Button onClick={() => void confirm({ title: 'Mark as unsolved?', body: 'This removes its history. Notes are kept.', confirmLabel: 'Mark unsolved', tone: 'danger' })}>
            Confirm
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <Frame label="Legend" aside="3 of 5">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Key insight" htmlFor="kit-insight" aside="Saved">
                <Textarea id="kit-insight" defaultValue="Sorted input: compare the two ends and drop one." />
              </Field>
              <Field label="Time" htmlFor="kit-time">
                <Input id="kit-time" mono defaultValue="O(n)" />
              </Field>
              <Field label="Topic">
                <Select defaultValue="trees">
                  <option value="trees">Trees</option>
                  <option value="graphs">Graphs</option>
                </Select>
              </Field>
            </div>
          </Frame>
          <Frame tone="raised" label="Raised" pad="none">
            <div style={{ padding: 8 }}>
              {derived.list.slice(0, 4).map((view, i) => (
                <ProblemRow key={view.problem.slug} view={view} onOpen={() => undefined} active={i === 1} />
              ))}
            </div>
          </Frame>
        </div>

        <CodeBlock code={CHEATSHEETS['two-pointers'].template || 'def two_sum(nums, target):\n    seen = {}  # value -> index\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []'} />

        <Frame pad="none">
          <Empty
            icon={<Sparkles />}
            title="Nothing logged yet"
            body="Solve your first problem and the mountain starts to fill in."
            action={<Button variant="primary">Start at base camp</Button>}
          />
        </Frame>
      </div>
    </div>
  )
}
