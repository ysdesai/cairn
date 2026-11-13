import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeChoice } from '../../state/schema'
import { useTheme } from '../../state/prefs'
import { Cairn, Frame, GradeMark, Meter, Segmented, Terrain } from '../../ui'
import { Section } from './Section'
import s from './Settings.module.css'

const OPTIONS = [
  { value: 'system', label: <><Monitor size={14} /> System</> },
  { value: 'light', label: <><Sun size={14} /> Light</> },
  { value: 'dark', label: <><Moon size={14} /> Dark</> },
] as const

const SWATCHES = ['--paper-raised', '--ink', '--ember', '--moss', '--gold', '--dusk', '--lake'] as const

export function AppearanceSection() {
  const { choice, resolved, setChoice } = useTheme()

  return (
    <Section
      no="04"
      title="Appearance"
      blurb="Day is ink and contour lines on warm paper. Night is a dark massif with ember light on the route. This choice stays on this device."
    >
      <Segmented<ThemeChoice> label="Theme" value={choice} onChange={setChoice} options={OPTIONS} />

      <Frame label="Preview" aside={resolved === 'dark' ? 'Night' : 'Day'} className={s.preview}>
        <div className={s.previewTerrain}>
          <Terrain seed={21} width={640} height={240} levels={10} scale={120} fade="left" />
        </div>
        <div className={s.previewBody}>
          <Cairn step={3} size={52} tone="ember" label="Three of five stones" />
          <div className={s.previewText}>
            <p className="place" style={{ fontSize: 'var(--text-lg)' }}>
              Two Pointers
            </p>
            <p className={s.previewMeta}>
              <GradeMark difficulty="medium" label />
              <span className="num muted">3 of 5 stones</span>
            </p>
            <Meter value={0.6} height={3} />
          </div>
        </div>
        <ul className={s.swatches} aria-hidden="true">
          {SWATCHES.map((token) => (
            <li key={token} style={{ background: `var(${token})` }} />
          ))}
        </ul>
      </Frame>
    </Section>
  )
}
