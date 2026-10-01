import type { ReactNode } from 'react'

export type Zone = 'predicted' | 'actual'

/**
 * The label that heads a Predicted or Actual zone. The two speak in
 * different voices so they read apart even before the words are read:
 * Predicted is a mono instrument readout with a dashed ring (projected);
 * Actual is the bold wide broadcast face with a solid disc (on the record).
 */
export function ZoneLabel({ zone, children, className = '' }: { zone: Zone; children?: ReactNode; className?: string }) {
  if (zone === 'predicted') {
    return (
      <span className={`pl-cool-text inline-flex items-center gap-1.5 font-mono text-[0.68rem] leading-none font-medium tracking-[0.14em] uppercase ${className}`}>
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
