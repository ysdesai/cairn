import type { StrengthParts, TopicView } from '../../domain/types'

export const PARTS: readonly { key: keyof StrengthParts; label: string }[] = [
  { key: 'ratings', label: 'Ratings' },
  { key: 'pace', label: 'Pace' },
  { key: 'retention', label: 'Retention' },
  { key: 'drill', label: 'Drill' },
]

export const CONFIDENCE_LABEL: Record<TopicView['confidence'], string> = {
  none: 'No evidence',
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
}

/** An ingredient under this is the one strength.ts names as the weakness. */
export const PART_WEAK = 0.6

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const TIE_ORDER: readonly (keyof StrengthParts)[] = ['ratings', 'retention', 'drill', 'pace']

/** The ingredient that is lowest and under PART_WEAK, or null. Same tie order as strength.ts. */
export function weakestPart(parts: StrengthParts): keyof StrengthParts | null {
  let found: keyof StrengthParts | null = null
  for (const key of TIE_ORDER) {
    const value = parts[key]
    if (value === null || value >= PART_WEAK) continue
    if (found === null || value < (parts[found] as number)) found = key
  }
  return found
}

export const pct = (value: number | null): string => (value === null ? '—' : String(Math.round(value * 100)))

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * How far a topic's number can be trusted.
 *   uncharted  nothing solved yet, so there is no strength at all
 *   early      a strength exists but rests on a handful of attempts: shown as "too early", never ranked
 *   ranked     enough evidence to compare against the other topics
 * Only ranked topics can be named the weakest or the strongest.
 */
export type TopicState = 'uncharted' | 'early' | 'ranked'

export function topicState(view: TopicView): TopicState {
  if (view.strength === null) return 'uncharted'
  return view.confidence === 'none' || view.confidence === 'low' ? 'early' : 'ranked'
}

/** The ranked topics, weakest first. */
export function rankTopics(views: readonly TopicView[]): TopicView[] {
  return views.filter((v) => topicState(v) === 'ranked').sort((a, b) => (a.strength as number) - (b.strength as number))
}
