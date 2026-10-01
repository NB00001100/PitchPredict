import type { ComponentProps, ElementType, ReactNode } from 'react'

type PanelTag = 'div' | 'section' | 'article' | 'li' | 'aside' | 'figure'

/**
 * - `glass`: translucent, hairline border, top highlight (default).
 * - `solid`: opaque surface for dense data where blur would cost legibility.
 * - `accent`: glass with a pitch-green rim and glow, for the one thing to look at.
 */
export type PanelTone = 'glass' | 'solid' | 'accent'

const TONES: Record<PanelTone, string> = {
  glass: 'glass',
  solid: 'border border-hairline bg-grey-900 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)]',
  accent: 'glass border-pitch/35! shadow-glow',
}

type PanelProps<T extends PanelTag> = {
  as?: T
  tone?: PanelTone
  children?: ReactNode
} & Omit<ComponentProps<T>, 'as'>

/**
 * The card surface. It isolates a stacking context, so a PointerLight inside
 * paints behind the content:
 *
 *   <Panel as="article"><PointerLight />…</Panel>
 */
export function Panel<T extends PanelTag = 'div'>({ as, tone = 'glass', className = '', children, ...props }: PanelProps<T>) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag
      className={`relative isolate overflow-hidden rounded-2xl ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}
