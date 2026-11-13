import { Loader } from '../ui'

/** Shown for the instant it takes to read the stored document: the name in the serif, over the stones settling. */
export function Splash() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', alignContent: 'center', minHeight: '100dvh', background: 'var(--paper)' }}>
      <p className="eyebrow" style={{ marginBottom: -24 }}>
        Cairn
      </p>
      <Loader label="Opening Cairn" />
    </div>
  )
}
