import * as Tooltip from '@radix-ui/react-tooltip'
import { useRef, type ReactElement, type ReactNode } from 'react'
import { Kbd } from './Kbd'
import s from './Tip.module.css'

export const TipProvider = Tooltip.Provider

interface TipProps {
  /** What the tooltip says. Falsy renders the child alone. */
  content: ReactNode
  /** A shortcut to show after the text, e.g. "g t". */
  kbd?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** The single element the tip belongs to. Must accept a ref and DOM props (a button, a link). */
  children: ReactElement
}

/**
 * Radix lets an open tooltip swallow Escape, which would cost a second press to close the sheet or
 * panel the person actually meant. So the tooltip closes as usual and, once it is gone, the same
 * key is passed on to whatever is open beneath it.
 */
function passEscapeOn(event: KeyboardEvent, tip: HTMLElement | null) {
  if (!event.isTrusted) return
  const target = document.activeElement ?? document.body
  const started = performance.now()
  const wait = () => {
    // The tooltip fades out before it unmounts and stops counting as the top layer.
    if (tip?.isConnected && performance.now() - started < 400) {
      requestAnimationFrame(wait)
      return
    }
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true, composed: true }))
  }
  requestAnimationFrame(wait)
}

/** A tooltip on hover and keyboard focus. */
export function Tip({ content, kbd, side = 'top', align = 'center', children }: TipProps) {
  const tip = useRef<HTMLDivElement>(null)
  if (!content) return children
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          ref={tip}
          className={s.tip}
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          onEscapeKeyDown={(event) => passEscapeOn(event, tip.current)}
        >
          <span>{content}</span>
          {kbd ? <Kbd keys={kbd} className={s.kbd} onSolid /> : null}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
