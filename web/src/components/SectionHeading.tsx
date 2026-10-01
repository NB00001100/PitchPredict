import type { ReactNode } from 'react'
import { Reveal, RevealItem } from './Reveal'

interface SectionHeadingProps {
  /** Small wide-caps line above the title, e.g. "The record". */
  eyebrow?: ReactNode
  title: ReactNode
  /** Supporting paragraph under the title. */
  lede?: ReactNode
  /** Heading level. Pages own their single h1; sections use h2 (default). */
  as?: 'h1' | 'h2' | 'h3'
  /** `headline` for sections (default), `display` for page titles. */
  size?: 'headline' | 'display'
  align?: 'start' | 'center'
  /** Optional id for the heading, for aria-labelledby on the section. */
  id?: string
  className?: string
  /** Trailing content in the heading row (desktop), e.g. a link. */
  aside?: ReactNode
}

/**
 * Eyebrow + condensed uppercase title + lede, revealed in sequence.
 *
 *   <section aria-labelledby="proof">
 *     <SectionHeading id="proof" eyebrow="The record" title="…" lede="…" />
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  as: Heading = 'h2',
  size = 'headline',
  align = 'start',
  id,
  className = '',
  aside,
}: SectionHeadingProps) {
  const centered = align === 'center'
  return (
    <Reveal
      as="header"
      stagger
      className={`flex flex-col gap-6 ${centered ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between'} ${className}`}
    >
      <div className={`flex max-w-3xl flex-col gap-4 ${centered ? 'items-center' : ''}`}>
        {eyebrow ? (
          <RevealItem as="p" className="type-eyebrow flex items-center gap-3 text-pitch">
            <span aria-hidden="true" className="h-px w-8 bg-pitch/70" />
            {eyebrow}
          </RevealItem>
        ) : null}
        <RevealItem>
          <Heading id={id} className={size === 'display' ? 'type-display' : 'type-headline'}>
            {title}
          </Heading>
        </RevealItem>
        {lede ? (
          <RevealItem as="p" className="type-lede max-w-2xl">
            {lede}
          </RevealItem>
        ) : null}
      </div>
      {aside ? <RevealItem className="shrink-0">{aside}</RevealItem> : null}
    </Reveal>
  )
}
