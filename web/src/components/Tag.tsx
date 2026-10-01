import type { ReactNode } from 'react'
import { CheckIcon, CrossIcon } from './Icons'

/**
 * - `neutral`: glass pill (default), e.g. "Coming soon", "Backtested".
 * - `accent`: pitch-green outline, for something live or highlighted.
 * - `live`: accent with a pulsing dot, e.g. "This week".
 * - `hit` / `miss`: graded results. They carry a check or cross icon, so the
 *   meaning never rests on colour alone.
 */
export type TagTone = 'neutral' | 'accent' | 'live' | 'hit' | 'miss'

const TONES: Record<TagTone, string> = {
  neutral: 'border-hairline-strong bg-black/60 text-white',
  accent: 'border-pitch/50 bg-pitch-dim/80 text-pitch',
  live: 'border-pitch/50 bg-pitch-dim/80 text-pitch',
  hit: 'border-pitch/45 bg-pitch-dim text-pitch',
  miss: 'border-miss/45 bg-miss-dim text-miss',
}

function DefaultIcon({ tone }: { tone: TagTone }) {
  if (tone === 'hit') return <CheckIcon className="size-3" strokeWidth={2.2} />
  if (tone === 'miss') return <CrossIcon className="size-3" strokeWidth={2.2} />
  if (tone === 'live')
    return (
      <span aria-hidden="true" className="relative inline-flex size-1.5">
        <span className="absolute inset-0 rounded-full bg-pitch motion-safe:animate-[pp-pulse-dot_1.6s_ease-out_infinite]" />
        <span className="relative size-1.5 rounded-full bg-pitch" />
      </span>
    )
  return null
}

interface TagProps {
  children: ReactNode
  className?: string
  tone?: TagTone
  /** Replaces the tone's default icon. Pass `null` for none. */
  icon?: ReactNode
}

/** Small pill label in the wide broadcast face. */
export function Tag({ children, className = '', tone = 'neutral', icon }: TagProps) {
  const glyph = icon === undefined ? <DefaultIcon tone={tone} /> : icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-wide text-[0.62rem] leading-none font-semibold tracking-[0.16em] whitespace-nowrap uppercase backdrop-blur-md ${TONES[tone]} ${className}`}
    >
      {glyph}
      {children}
    </span>
  )
}
