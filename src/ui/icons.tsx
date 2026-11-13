import type { SVGProps } from 'react'

/** The mark: three stones, the top one lit. */
export function CairnMark({ size = 24, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <ellipse cx="12" cy="18.6" rx="8.6" ry="3.4" fill="currentColor" />
      <ellipse cx="11.4" cy="12.4" rx="6.1" ry="2.9" fill="currentColor" transform="rotate(-4 11.4 12.4)" />
      <ellipse cx="12.5" cy="6.9" rx="3.7" ry="2.4" fill="var(--ember)" transform="rotate(5 12.5 6.9)" />
    </svg>
  )
}

/** A summit flag. */
export function FlagGlyph({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...rest}>
      <path d="M4 14.5V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 2.2 12.6 4.6 4 7.6Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

/** A compass needle, for the map's corner and the "off the map" page. */
export function CompassGlyph({ size = 40, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" {...rest}>
      <circle cx="20" cy="20" r="18.5" stroke="var(--line-3)" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12
        const long = i % 6 === 0
        const r1 = long ? 14.5 : 16.5
        return (
          <line
            key={i}
            x1={20 + Math.sin(a) * r1}
            y1={20 - Math.cos(a) * r1}
            x2={20 + Math.sin(a) * 18.5}
            y2={20 - Math.cos(a) * 18.5}
            stroke={long ? 'var(--ink-3)' : 'var(--line-3)'}
          />
        )
      })}
      <path d="M20 5.5 23 20 20 21.5 17 20Z" fill="var(--ember)" />
      <path d="M20 34.5 17 20 20 18.5 23 20Z" fill="var(--ink-4)" />
    </svg>
  )
}
