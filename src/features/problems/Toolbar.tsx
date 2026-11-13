import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { TOPICS } from '../../data'
import type { Difficulty } from '../../data/types'
import { Button, GradeMark, Input, Kbd, Select, ToggleChip, cx, spring } from '../../ui'
import { DIFFICULTIES, SORT_OPTIONS, STATUS_OPTIONS, type Filters, type SortKey, type StatusFilter } from './filters'
import s from './Toolbar.module.css'

interface ToolbarProps {
  text: string
  onText: (value: string) => void
  onSearchKey: (event: KeyboardEvent<HTMLInputElement>) => void
  inputRef: RefObject<HTMLInputElement | null>
  filters: Filters
  counts: Record<StatusFilter, number>
  filtered: boolean
  onChange: (patch: Partial<Filters>) => void
  onClear: () => void
}

/**
 * Search, status, difficulty, topic and sort. Sticks under the top bar with a paper veil behind
 * it. On phones only the search stays in view; the rest opens from a "Filters" button.
 */
export function Toolbar({ text, onText, onSearchKey, inputRef, filters, counts, filtered, onChange, onClear }: ToolbarProps) {
  const [open, setOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const bar = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const active = (filters.status !== 'all' ? 1 : 0) + (filters.d.length ? 1 : 0) + (filters.topic !== 'all' ? 1 : 0)

  // Paper and rules appear only once the bar is pinned; at rest it sits on the header's terrain.
  useEffect(() => {
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 56
    const check = () => setStuck((bar.current?.getBoundingClientRect().top ?? 1) <= top + 0.5)
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  const toggleGrade = (grade: Difficulty, on: boolean) =>
    onChange({ d: DIFFICULTIES.filter((g) => (g === grade ? on : filters.d.includes(g))) })

  return (
    <div ref={bar} className={s.toolbar} role="search" data-clear={filtered || undefined} data-stuck={stuck || undefined}>
      <div className={s.search}>
        <Search className={s.searchIcon} aria-hidden="true" />
        <Input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search problems by title, number, topic, tag or note"
          placeholder="Search problems"
          value={text}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={onSearchKey}
        />
        {text ? (
          <button
            type="button"
            className={s.clearText}
            aria-label="Clear search"
            onClick={() => {
              onText('')
              inputRef.current?.focus()
            }}
          >
            <X aria-hidden="true" />
          </button>
        ) : (
          <Kbd keys="/" className={s.slash} />
        )}
      </div>

      <button
        type="button"
        className={cx(s.disclose, open && s.discloseOpen)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal aria-hidden="true" />
        <span>Filters</span>
        {active ? <span className={cx('num', s.badge)}>{active}</span> : null}
      </button>

      <div id={panelId} className={s.panel} data-open={open || undefined}>
        <div className={s.tabs} role="group" aria-label="Status">
          {STATUS_OPTIONS.map((o) => {
            const on = filters.status === o.value
            return (
              <button key={o.value} type="button" className={s.tab} aria-pressed={on} onClick={() => onChange({ status: o.value })}>
                <span>{o.label}</span>
                <span className={cx('num', s.tabCount)}>{counts[o.value]}</span>
                {on ? <motion.span layoutId="problems-status" className={s.underline} transition={spring.snappy} /> : null}
              </button>
            )
          })}
        </div>

        <div className={s.grades} role="group" aria-label="Difficulty">
          {DIFFICULTIES.map((g) => (
            <ToggleChip key={g} tone="neutral" pressed={filters.d.includes(g)} onPressedChange={(on) => toggleGrade(g, on)}>
              <GradeMark difficulty={g} label />
            </ToggleChip>
          ))}
        </div>

        <label className={cx(s.labelled, s.topic)}>
          <span className={cx('eyebrow', s.tag)}>Camp</span>
          <Select aria-label="Topic" value={filters.topic} onChange={(event) => onChange({ topic: event.target.value as Filters['topic'] })}>
            <option value="all">All topics</option>
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>

        <label className={cx(s.labelled, s.sort)}>
          <span className={cx('eyebrow', s.tag)}>Sort</span>
          <Select aria-label="Sort by" value={filters.sort} onChange={(event) => onChange({ sort: event.target.value as SortKey })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>

        {filtered ? (
          <Button variant="ghost" icon={<X />} className={s.clear} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
