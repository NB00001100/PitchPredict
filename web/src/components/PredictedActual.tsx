import type { ReactNode } from 'react'

/*
 * Forecast beside result, everywhere on the site, in one visual language:
 *
 *   <PredictedActual>
 *     <PredictedZone>Home win <span className="font-mono">54%</span></PredictedZone>
 *     <ActualZone>Home win <span className="font-mono">2–1</span></ActualZone>
 *     <VerdictZone tone="hit">…</VerdictZone>
 *   </PredictedActual>
 *
 * - PREDICTED speaks in the cool, dashed, projected voice (`zone-predicted`,
 *   `text-projected`, a mono label with a dashed ring). It was a probability.
 * - ACTUAL is a solid raised surface (`zone-actual`) with a bold wide label
 *   and a solid disc. It happened. Before kick-off pass `pending`.
 * - VERDICT connects the two: hit (green, check), miss (red, cross) or
 *   pending. Meaning never rests on colour: the caller puts a word and icon in it.
 *
 * Labels say only what is always true. In particular nothing here claims a
 * forecast was made "before kick-off": backtested forecasts were generated
 * afterwards (from data before their matchweek). Say so with an `aside`
 * (e.g. the Backtested tag) where it applies.
 */

export type Zone = 'predicted' | 'actual'

/**
 * The label that heads a Predicted or Actual zone. The two read apart even
 * before the words are read: Predicted is a mono instrument readout with a
 * dashed ring; Actual is the bold wide broadcast face with a solid disc.
 */
export function ZoneLabel({ zone, children, className = '' }: { zone: Zone; children?: ReactNode; className?: string }) {
  if (zone === 'predicted') {
    return (
      <span className={`text-projected inline-flex items-center gap-1.5 font-mono text-[0.68rem] leading-none font-medium tracking-[0.14em] uppercase ${className}`}>
        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5 shrink-0">
          <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.1 1.6" />
        </svg>
        {children ?? 'Predicted'}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-wide text-[0.64rem] leading-none font-bold tracking-[0.18em] text-white uppercase ${className}`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-white shadow-[0_0_8px_rgb(255_255_255/0.6)]" />
      {children ?? 'Actual'}
    </span>
  )
}

/** Lays zones out side by side from `sm` up (stacked on phones); a VerdictZone spans the row. */
export function PredictedActual({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-2 sm:grid-cols-2 [&>.verdict-zone]:sm:col-span-2 ${className}`}>{children}</div>
}

interface ZoneProps {
  children: ReactNode
  /** Replaces the default label ("Predicted" / "Actual"). */
  label?: ReactNode
  /** Sits at the end of the label row, e.g. a Backtested tag or a status. */
  aside?: ReactNode
  className?: string
}

function ZoneHead({ zone, label, aside }: { zone: Zone; label?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-2">
      <ZoneLabel zone={zone}>{label}</ZoneLabel>
      {aside}
    </div>
  )
}

export function PredictedZone({ children, label, aside, className = 'gap-3 p-3.5' }: ZoneProps) {
  return (
    <div className={`zone-predicted flex flex-col rounded-xl ${className}`}>
      <ZoneHead zone="predicted" label={label} aside={aside} />
      {children}
    </div>
  )
}

export function ActualZone({ children, label, aside, pending = false, className = 'gap-2.5 p-3.5' }: ZoneProps & { pending?: boolean }) {
  return (
    <div className={`zone-actual flex flex-col rounded-xl ${className}`} data-state={pending ? 'pending' : 'final'}>
      <ZoneHead zone="actual" label={label} aside={aside} />
      {children}
    </div>
  )
}

const VERDICT_TONE = {
  hit: 'border-pitch/45 bg-pitch-dim/80 shadow-[inset_0_1px_0_0_rgb(60_240_140/0.25)]',
  miss: 'border-miss/45 bg-miss-dim/80 shadow-[inset_0_1px_0_0_rgb(255_107_112/0.22)]',
  pending: 'border-hairline bg-black/20',
} as const

export type VerdictTone = keyof typeof VERDICT_TONE

/** The verdict strip: hit, miss or still to come. Put a word (and icon) inside; colour only backs it up. */
export function VerdictZone({ tone, children, className = '' }: { tone: VerdictTone; children: ReactNode; className?: string }) {
  return (
    <div
      className={`verdict-zone flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 ${VERDICT_TONE[tone]} ${className}`}
    >
      {children}
    </div>
  )
}
