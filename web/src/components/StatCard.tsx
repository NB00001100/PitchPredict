import type { ReactNode } from 'react'
import { Panel } from './Panel'
import { PointerLight } from './PointerLight'

interface StatCardProps {
  /** Mono label above the figure, e.g. "This season". */
  label: ReactNode
  /** The figure, usually a <CountUp />. */
  value: ReactNode
  /** One honest sentence saying what the figure is. */
  caption: ReactNode
  /** Optional small graphic under the caption (a meter, a dot plot). */
  children?: ReactNode
  className?: string
}

/**
 * A big figure on glass: label, value, caption, optional mini graphic.
 * Values use the display face at 80% width with proportional figures.
 */
export function StatCard({ label, value, caption, children, className = '' }: StatCardProps) {
  return (
    <Panel className={`flex h-full flex-col gap-5 p-6 md:p-7 ${className}`}>
      <PointerLight />
      <p className="type-label text-grey-400">{label}</p>
      <p className="type-stat text-white">{value}</p>
      <p className="text-sm leading-relaxed text-grey-200">{caption}</p>
      {children ? <div className="mt-auto pt-2">{children}</div> : null}
    </Panel>
  )
}

/** Placeholder with the same footprint, for while live data loads. */
export function StatCardSkeleton({ label }: { label: ReactNode }) {
  return (
    <Panel className="flex h-full flex-col gap-5 p-6 md:p-7">
      <p className="type-label text-grey-400">{label}</p>
      <span className="skeleton block h-[var(--text-stat)] w-32 rounded-lg" />
      <span className="flex flex-col gap-2">
        <span className="skeleton block h-3 w-full rounded" />
        <span className="skeleton block h-3 w-2/3 rounded" />
      </span>
      <output className="sr-only">Loading this season’s record…</output>
    </Panel>
  )
}
