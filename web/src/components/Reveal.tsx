import * as m from 'motion/react-m'
import { type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { DURATION, EASE_OUT_EXPO, STAGGER } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

type RevealTag = 'div' | 'section' | 'li' | 'ul' | 'ol' | 'p' | 'span' | 'header' | 'figure' | 'dl'

const COMPONENTS = {
  div: m.div,
  section: m.section,
  li: m.li,
  ul: m.ul,
  ol: m.ol,
  p: m.p,
  span: m.span,
  header: m.header,
  figure: m.figure,
  dl: m.dl,
} as const

const item: Variants = {
  hidden: { opacity: 0, y: 28 },
  shown: { opacity: 1, y: 0, transition: { duration: DURATION.base + 0.2, ease: EASE_OUT_EXPO } },
}

interface RevealProps {
  children: ReactNode
  as?: RevealTag
  className?: string
  id?: string
  /** Seconds before this block starts, after it enters the viewport. */
  delay?: number
  /**
   * When true, the block itself doesn't move; its RevealItem children
   * stagger in one after another instead.
   */
  stagger?: boolean
  /** How much of the block must be visible to start, 0–1. */
  amount?: number
}

/**
 * Fades and lifts its content into place the first time it scrolls into
 * view. Under reduced motion it renders in its final state immediately.
 *
 *   <Reveal>…</Reveal>
 *   <Reveal as="ul" stagger><RevealItem as="li">…</RevealItem>…</Reveal>
 */
export function Reveal({ children, as = 'div', className, id, delay = 0, stagger = false, amount = 0.25 }: RevealProps) {
  const reduced = usePrefersReducedMotion()
  const Component = COMPONENTS[as]
  const variants: Variants = stagger
    ? { hidden: {}, shown: { transition: { staggerChildren: STAGGER * 1.4, delayChildren: delay } } }
    : {
        hidden: item.hidden,
        shown: { ...item.shown, transition: { duration: DURATION.base + 0.2, ease: EASE_OUT_EXPO, delay } },
      }
  return (
    <Component
      id={id}
      className={className}
      variants={variants}
      initial={reduced ? false : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, amount }}
    >
      {children}
    </Component>
  )
}

/** A child of `<Reveal stagger>` that takes its turn in the sequence. */
export function RevealItem({ children, as = 'div', className }: { children: ReactNode; as?: RevealTag; className?: string }) {
  const Component = COMPONENTS[as]
  return (
    <Component className={className} variants={item}>
      {children}
    </Component>
  )
}
