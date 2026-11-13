import { useEffect, useState } from 'react'
import type { Layout } from './layout'
import { buildTerrain, type Terrain } from './terrain'

const cache = new Map<string, Terrain>()

/**
 * The terrain for a composition. Building it takes a few hundred milliseconds, so it waits until
 * the camps and trails have been painted, then fades in; it is built once per composition.
 */
export function useTerrain(layout: Layout): Terrain | null {
  const [built, setBuilt] = useState<Terrain | null>(() => cache.get(layout.id) ?? null)

  useEffect(() => {
    const hit = cache.get(layout.id)
    if (hit) {
      setBuilt(hit)
      return
    }
    const timer = window.setTimeout(() => {
      const terrain = buildTerrain(layout)
      cache.set(layout.id, terrain)
      setBuilt(terrain)
    }, 40)
    return () => window.clearTimeout(timer)
  }, [layout])

  return built && built.id === layout.id ? built : null
}
