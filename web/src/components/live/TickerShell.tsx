/**
 * The ticker's loading state, with the same footprint as the real strip so
 * nothing shifts when forecasts arrive. Kept outside the lazy chunk so it can
 * also be the Suspense fallback while that chunk downloads.
 */
export function TickerSkeleton() {
  return (
    <div className="glass flex h-20 items-stretch overflow-hidden rounded-2xl">
      <output className="sr-only">Loading this week’s forecasts…</output>
      <div className="flex w-36 shrink-0 flex-col justify-center gap-2 border-r border-hairline bg-black/70 px-5">
        <span className="skeleton block h-2.5 w-24 rounded" />
        <span className="skeleton block h-2 w-16 rounded" />
      </div>
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex w-[15.5rem] shrink-0 flex-col justify-center gap-2.5 border-r border-hairline px-5">
            <span className="skeleton block h-3 w-24 rounded" />
            <span className="skeleton block h-1.5 w-full rounded-full" />
            <span className="skeleton block h-2 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Placeholder for the hero's featured forecast card. */
export function FeaturedSkeleton() {
  return (
    <div className="glass flex h-[30rem] flex-col gap-6 rounded-2xl p-6">
      <output className="sr-only">Loading the featured forecast…</output>
      <span className="skeleton block h-5 w-44 rounded-full" />
      <span className="flex flex-col gap-3">
        <span className="skeleton block h-11 w-3/4 rounded-full" />
        <span className="skeleton block h-11 w-2/3 rounded-full" />
      </span>
      <span className="skeleton block flex-1 rounded-xl" />
    </div>
  )
}
