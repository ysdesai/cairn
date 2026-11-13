import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { spring } from './motion'
import { usePauseTimer } from './usePauseTimer'
import s from './toast.module.css'

export interface ToastInput {
  message: string
  /** A quieter second line. */
  detail?: string
  /** success shows a check. */
  tone?: 'default' | 'success'
  /** Replaces the default icon. */
  icon?: ReactNode
  /** One inline action, typically Undo. The toast closes when it is used. */
  action?: { label: string; onClick: () => void }
  /** ms. Default 4200, or 6500 with an action. */
  duration?: number
  /** Reuse an id to replace a toast that is still showing. */
  id?: string
}

interface ToastItem extends ToastInput {
  id: string
}

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

/**
 * Show a brief, non-blocking message above the dock.
 *   toast('Notes saved')
 *   toast({ message: 'Logged Two Sum', detail: 'Back in 3 days', tone: 'success', action: { label: 'Undo', onClick: undo } })
 */
export function toast(input: ToastInput | string): string {
  const base = typeof input === 'string' ? { message: input } : input
  const id = base.id ?? `toast-${++seq}`
  const item: ToastItem = { ...base, id }
  items = [...items.filter((t) => t.id !== id), item].slice(-3)
  emit()
  return id
}

export function dismissToast(id: string): void {
  items = items.filter((t) => t.id !== id)
  emit()
}

function ToastView({ item }: { item: ToastItem }) {
  const duration = item.duration ?? (item.action ? 6500 : 4200)
  // Pointing at a toast or focusing inside it holds it; it gets a fresh timer on leaving.
  const hold = usePauseTimer(() => dismissToast(item.id), duration, item)

  return (
    <motion.li
      layout
      {...hold}
      className={s.toast}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.16 } }}
      transition={spring.snappy}
    >
      <span className={s.icon} data-tone={item.tone ?? 'default'}>
        {item.icon ?? (item.tone === 'success' ? <Check /> : <Info />)}
      </span>
      <span className={s.text}>
        <span className={s.message}>{item.message}</span>
        {item.detail ? <span className={s.detail}>{item.detail}</span> : null}
      </span>
      {item.action ? (
        <button
          type="button"
          className={s.action}
          onClick={() => {
            item.action?.onClick()
            dismissToast(item.id)
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </motion.li>
  )
}

/** Mounted once in App. */
export function Toaster() {
  const current = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => items,
    () => items,
  )
  // Portalled to <body> so toasts sit above sheets and dialogs (which are portalled there too)
  // and their actions stay reachable. Sheet and Modal ignore presses that land in here.
  return createPortal(
    <ol className={s.viewport} data-toaster="" role="status" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {current.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </ol>,
    document.body,
  )
}

/** True when an event came from inside a toast. Overlays use it to avoid treating that as "outside". */
export function isInToaster(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-toaster]') !== null
}
