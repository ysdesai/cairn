import type { TopicId } from '../../data/types'
import { READY_THRESHOLD } from '../../domain/roadmap'
import type { TopicState, TopicView } from '../../domain/types'
import type { Tone } from '../../ui'
import { CampMark } from './canvas/Camp'

/** How a camp's state is worded and toned, in the panel and the legend alike. `note` is what the state means. */
export const CAMP_STATE: Record<TopicState, { label: string; tone: Tone; variant: 'outline' | 'soft'; note: string }> = {
  complete: { label: 'Complete', tone: 'moss', variant: 'soft', note: 'Every problem solved' },
  active: { label: 'In progress', tone: 'ember', variant: 'outline', note: 'Some solved' },
  ready: { label: 'Ready next', tone: 'ember', variant: 'soft', note: 'Next on the route' },
  ahead: { label: 'Further up', tone: 'neutral', variant: 'outline', note: 'Earlier camps first' },
}

/** The share of an earlier camp that must be solved before the next one is "ready", as a whole percent. */
export const READY_PERCENT = Math.round(READY_THRESHOLD * 100)

/** A small camp mark, for lists and chips. The same symbol the map draws, set heavier so it holds at 16px. */
export function CampGlyph({ state, size = 16 }: { state: TopicState; size?: number }) {
  return <CampMark state={state} size={size} weight={size <= 20 ? 2.9 : 1.6} />
}

const listNames = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

/**
 * Why a camp is in the state it is in, in one sentence with the exact figures. The map never
 * locks a camp, so this is the reason for the advice and nothing more.
 */
export function campReason(view: TopicView, topics: Record<TopicId, TopicView>): string | null {
  const { topic } = view
  const needs = `${READY_PERCENT}%`
  if (view.state === 'complete') {
    return view.mastered === view.total ? 'Every problem solved, every cairn at five stones.' : 'Every problem solved.'
  }
  if (view.state === 'active') return view.recommended ? 'Under way, and next on the route.' : null
  if (topic.deps.length === 0) return 'Base camp. The climb starts here.'
  const lead = view.recommended ? 'Ready next' : 'Ready'
  if (view.state === 'ready') {
    const names = topic.deps.map((id) => topics[id].topic.short)
    return `${lead}: ${listNames(names)} ${names.length === 1 ? 'is' : 'are'} past ${needs} solved.`
  }
  // Ahead: name the earlier camps that are still short of the bar, with where each stands.
  const short = topic.deps.map((id) => topics[id]).filter((dep) => dep.progress < READY_THRESHOLD)
  const names = short.map((dep) => dep.topic.short)
  const figures = short.map((dep) => `${dep.solved} of ${dep.total}`)
  return `Ready once ${listNames(names)} ${names.length === 1 ? 'is' : 'are'} ${needs} solved. Now ${listNames(figures)}.`
}
