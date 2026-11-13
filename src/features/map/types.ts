import type { TopicId } from '../../data/types'
import type { TopicView } from '../../domain/types'

/** A rectangle on screen, in pixels from the top left of the map's canvas. */
export interface ScreenRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** How a camp was chosen: the keyboard moves focus into the panel afterwards, the pointer does not. */
export type OpenedBy = 'key' | 'pointer'

/**
 * The contract between the Map screen (panel, controls, routing) and the drawing of the massif.
 * The canvas owns everything inside the map: terrain, light, trails, camps, panning, zooming and
 * moving between camps with the keyboard.
 */
export interface MapCanvasProps {
  /** All 18 topics with their progress, state and strength. */
  topics: Record<TopicId, TopicView>
  /** The camp whose panel is open, if any. Drawn as selected; the camera keeps it in view. */
  selected: TopicId | null
  /** Open a camp (or close the open one with null). */
  onSelect: (id: TopicId | null, by?: OpenedBy) => void
  /** Where the user is on the climb: gets the "you are here" beacon. */
  here: TopicId | null
  /** Pixels of the canvas covered by the topic panel (and the controls beside it), so the camera can centre in what is left. */
  inset: { right: number; bottom: number }
  /** Screen furniture lying over the drawing. Framing the whole map keeps every camp and trail out from under it. */
  furniture: ScreenRect[]
  /** Lets the screen's buttons drive the camera. */
  handle?: React.Ref<MapCanvasHandle>
}

export interface MapCanvasHandle {
  zoomIn(): void
  zoomOut(): void
  /** Fit the whole massif in view. */
  fit(): void
  /** Fly to a camp. */
  flyTo(id: TopicId): void
  /** Put keyboard focus on a camp, without moving the map unless it must. */
  focusCamp(id: TopicId): void
}
