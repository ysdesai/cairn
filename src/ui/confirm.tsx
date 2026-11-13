import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useSyncExternalStore, type ReactNode } from 'react'
import { Button } from './Button'
import { useFocusReturn } from './focusReturn'
import { LAYER, useHotkeyLayer } from './hotkeys'
import sheet from './Sheet.module.css'
import s from './confirm.module.css'

export interface ConfirmOptions {
  title: string
  /** One or two sentences on what will happen. */
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger: the confirm button is styled as destructive. */
  tone?: 'default' | 'danger'
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

/**
 * Ask before doing something that cannot be taken back.
 *   if (await confirm({ title: 'Mark as unsolved?', body: '…', confirmLabel: 'Mark unsolved', tone: 'danger' })) { … }
 * Resolves false on Cancel or Escape. Requires <ConfirmHost /> to be mounted (it is, in App).
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...options, resolve }
    emit()
  })
}

function settle(ok: boolean) {
  const current = pending
  pending = null
  emit()
  current?.resolve(ok)
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => pending,
    () => null,
  )
  useHotkeyLayer(LAYER.confirm, !!current)
  const focus = useFocusReturn()
  return (
    <AlertDialog.Root open={!!current} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={sheet.scrim} />
        <AlertDialog.Content
          className={`${sheet.modal} ${s.confirm}`}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
        >
          <AlertDialog.Title className="title title-sm">{current?.title}</AlertDialog.Title>
          {current?.body ? (
            <AlertDialog.Description asChild>
              <div className={s.body}>{current.body}</div>
            </AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="sr-only">{current?.title}</AlertDialog.Description>
          )}
          <div className={s.actions}>
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">{current?.cancelLabel ?? 'Cancel'}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={current?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {current?.confirmLabel ?? 'Confirm'}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
