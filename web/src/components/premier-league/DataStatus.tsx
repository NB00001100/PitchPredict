import { useEffect, useState } from 'react'
import { formatUpdated } from '../../lib/relativeTime'
import { resultsThrough } from '../../lib/results'
import type { Fixture } from '../../lib/types'

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Re-renders every `ms` so relative times stay true. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}

/** Quiet provenance line: how far the results go and when the data was fetched. */
export function DataStatus({ fixtures, updatedAt }: { fixtures: readonly Fixture[]; updatedAt: number | null }) {
  const now = useNow(30_000)
  const through = resultsThrough(fixtures)
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-pitch shadow-[0_0_8px_var(--color-pitch)]" />
      <span>{through === null ? 'No results yet' : `Results through matchweek ${through}`}</span>
      {updatedAt !== null ? (
        <>
          <span aria-hidden="true" className="text-grey-500">
            ·
          </span>
          <time dateTime={new Date(updatedAt).toISOString()} title={absolute.format(updatedAt)}>
            updated {formatUpdated(updatedAt, now)}
          </time>
        </>
      ) : null}
    </p>
  )
}
