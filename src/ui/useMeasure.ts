import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export interface Size {
  width: number
  height: number
}

/**
 * Measure an element and keep the measurement current.
 *   const [ref, { width }] = useMeasure<HTMLDivElement>()
 * Charts use it to draw at their real pixel width, so strokes and labels stay crisp at any size.
 * Width and height are 0 until the first layout.
 */
export function useMeasure<T extends Element>(): [(node: T | null) => void, Size] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const observer = useRef<ResizeObserver | null>(null)
  const element = useRef<T | null>(null)

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect()
    element.current = node
    if (!node) return
    const update = () => {
      const rect = node.getBoundingClientRect()
      setSize((prev) => {
        const next = { width: Math.round(rect.width), height: Math.round(rect.height) }
        return prev.width === next.width && prev.height === next.height ? prev : next
      })
    }
    update()
    observer.current = new ResizeObserver(update)
    observer.current.observe(node)
  }, [])

  useLayoutEffect(() => () => observer.current?.disconnect(), [])

  return [ref, size]
}
