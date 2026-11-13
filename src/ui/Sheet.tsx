import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { useFocusReturn } from "./focusReturn";
import { Tip } from "./Tip";
import { LAYER, useHotkeyLayer } from "./hotkeys";
import { isInToaster } from "./toast";
import s from "./Sheet.module.css";

/** Using a toast's action (Undo) while a sheet is open must not count as clicking away from it. */
function keepOpenForToasts(event: Event) {
  const original = (event as CustomEvent<{ originalEvent: Event }>).detail
    ?.originalEvent;
  if (isInToaster(original?.target ?? event.target)) event.preventDefault();
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read by screen readers as the dialog's name. */
  title: string;
  /** Desktop width in px. On phones a sheet is always full screen. */
  width?: number;
  className?: string;
  children: ReactNode;
  /** Called when focus first moves in; call event.preventDefault() to manage focus yourself. */
  onOpenAutoFocus?: (event: Event) => void;
}

/**
 * A panel that slides in from the right (from the bottom on phones) over a scrim.
 * Focus is trapped inside, Escape closes it, and focus returns to where it came from.
 * Compose the inside from SheetHeader, SheetBody and SheetFooter.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  width = 640,
  className,
  children,
  onOpenAutoFocus,
}: SheetProps) {
  useHotkeyLayer(LAYER.sheet, open);
  const focus = useFocusReturn({ onOpenAutoFocus });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={s.scrim} />
        <Dialog.Content
          className={cx(s.sheet, className)}
          style={{ "--sheet-w": `${width}px` } as CSSProperties}
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onInteractOutside={keepOpenForToasts}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The fixed strip at the top of a sheet: a slot on the left, actions and the close button on the right. */
export function SheetHeader({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={s.header}>
      <div className={s.headerMain}>{children}</div>
      <div className={s.headerActions}>
        {actions}
        <Tip content="Close" kbd="Escape">
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Close"
              icon={<X />}
            />
          </Dialog.Close>
        </Tip>
      </div>
    </header>
  );
}

/** The scrolling part of a sheet. */
export function SheetBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(s.body, className)}>{children}</div>;
}

/** A fixed strip at the bottom of a sheet, for the primary action. */
export function SheetFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <footer className={cx(s.footer, className)}>{children}</footer>;
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shown under the title. */
  description?: ReactNode;
  /** Max width in px. */
  width?: number;
  /** Hide the built-in heading (you render your own). The title is still announced. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}

/** A centred dialog for short, focused tasks. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  width = 480,
  bare,
  className,
  children,
}: ModalProps) {
  useHotkeyLayer(LAYER.modal, open);
  const focus = useFocusReturn();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={s.scrim} />
        <Dialog.Content
          className={cx(s.modal, className)}
          style={{ "--modal-w": `${width}px` } as CSSProperties}
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onInteractOutside={keepOpenForToasts}
        >
          {bare ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <div className={s.modalHead}>
              <div>
                <Dialog.Title className="title title-sm">{title}</Dialog.Title>
                {description ? (
                  <p className={s.modalDesc}>{description}</p>
                ) : null}
              </div>
              <Tip content="Close" kbd="Escape">
                <Dialog.Close asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Close"
                    icon={<X />}
                  />
                </Dialog.Close>
              </Tip>
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
