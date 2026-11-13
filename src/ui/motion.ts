/** Shared motion vocabulary, so everything in the app moves like the same object. */
import type { Transition, Variants } from 'framer-motion'

export const spring = {
  /** Controls: thumbs, indicators, small things that follow a click. */
  snappy: { type: 'spring', stiffness: 560, damping: 40, mass: 0.7 },
  /** Panels and larger surfaces. */
  soft: { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 },
  /** Something landing: a stone on the cairn, a flag on a summit. */
  bouncy: { type: 'spring', stiffness: 460, damping: 20, mass: 0.8 },
  /** Camera moves on the map. */
  glide: { type: 'spring', stiffness: 120, damping: 22, mass: 1 },
} as const satisfies Record<string, Transition>

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const

/** A screen arriving. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.38, ease: ease.out } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: ease.inOut } },
}

/** A list whose rows arrive one after another. Put `listItem` on each child. */
export const listContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.028, delayChildren: 0.04 } },
}

export const listItem: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.34, ease: ease.out } },
}

export const fade: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.24, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
}
