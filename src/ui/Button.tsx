import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { Kbd } from './Kbd'
import s from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface Common {
  /** primary: the one next action. secondary: everything else. ghost: toolbars. danger: destructive. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Leading icon. */
  icon?: ReactNode
  /** A shortcut hint shown as keycaps, e.g. "Enter" or "mod+k". Does not bind the key. */
  kbd?: string
  /** Fill the width of the container. */
  block?: boolean
  /** Square, icon only. Give it an aria-label. */
  iconOnly?: boolean
}

function classes({ variant = 'secondary', size = 'md', block, iconOnly }: Common, extra?: string) {
  return cx(s.btn, s[variant], s[size], block && s.block, iconOnly && s.iconOnly, extra)
}

function Inner({ icon, kbd, variant, children }: Common & { children?: ReactNode }) {
  return (
    <>
      {icon ? <span className={s.icon}>{icon}</span> : null}
      {children != null && children !== false ? <span className={s.label}>{children}</span> : null}
      {kbd ? <Kbd keys={kbd} onSolid={variant === 'primary'} className={s.kbd} /> : null}
    </>
  )
}

export interface ButtonProps extends Common, ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant, size, icon, kbd, block, iconOnly, className, children, type, ...rest }: ButtonProps) {
  return (
    <button type={type ?? 'button'} className={classes({ variant, size, block, iconOnly }, className)} {...rest}>
      <Inner icon={icon} kbd={kbd} variant={variant}>
        {children}
      </Inner>
    </button>
  )
}

export interface ButtonLinkProps extends Common, AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Opens in a new tab with rel="noreferrer". */
  external?: boolean
  ref?: Ref<HTMLAnchorElement>
}

/** An anchor that looks like a button. For links that leave the app (LeetCode, the coach). */
export function ButtonLink({
  variant,
  size,
  icon,
  kbd,
  block,
  iconOnly,
  external,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const ext = external ? { target: '_blank', rel: 'noreferrer' } : {}
  return (
    <a className={classes({ variant, size, block, iconOnly }, className)} {...ext} {...rest}>
      <Inner icon={icon} kbd={kbd} variant={variant}>
        {children}
      </Inner>
    </a>
  )
}
