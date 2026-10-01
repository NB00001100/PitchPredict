import { Panel } from '../Panel'

/**
 * Placeholder in the shape of the loaded page (season panel, control bar,
 * matchweek header, fixture rows), so nothing jumps when data arrives.
 */
export function PageSkeleton() {
  return (
    <div aria-busy="true">
      <output className="sr-only">Loading forecasts…</output>
      <div aria-hidden="true">
        <div className="mt-12 md:mt-16">
          <Panel className="p-5 sm:p-7 lg:p-10">
            <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-16">
              <div className="flex flex-col gap-4">
                <span className="skeleton block h-3 w-40 rounded" />
                <span className="skeleton block h-[clamp(4.4rem,9.6vw,7.2rem)] w-48 rounded-xl" />
                <span className="skeleton block h-5 w-44 rounded" />
                <span className="skeleton block h-8 w-64 max-w-full rounded-full" />
              </div>
              <div className="flex flex-col gap-4">
                <div className="relative h-[13.25rem]">
                  <span className="skeleton absolute inset-x-0 top-[46px] block h-2 rounded-full" />
                </div>
                <span className="skeleton block h-3 w-full rounded" />
                <span className="skeleton block h-3 w-2/3 rounded" />
              </div>
            </div>
            <div className="my-9 h-px bg-hairline" />
            <span className="skeleton block h-3 w-52 rounded" />
            <div className="mt-5 grid grid-cols-19 items-end gap-x-1 gap-y-5 sm:grid-cols-38">
              {Array.from({ length: 38 }, (_, i) => (
                <span key={i} className="flex flex-col items-center gap-1.5">
                  <span className="block h-16 w-full border-b border-grey-700 sm:h-20" />
                  <span className="block h-2.5 w-3 rounded-sm bg-grey-800" />
                </span>
              ))}
            </div>
            <span className="skeleton mt-9 block h-3 w-full max-w-[46rem] rounded" />
            <span className="skeleton mt-2 block h-3 w-1/2 rounded" />
          </Panel>
        </div>

        <div className="mt-20 md:mt-28">
          <div className="glass -mx-1 flex h-[3.875rem] items-center gap-1 rounded-2xl p-1.5 sm:-mx-2">
            <span className="size-11 shrink-0 rounded-xl border border-hairline" />
            <span className="flex flex-1 gap-1 overflow-hidden px-5">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="skeleton block h-12 w-12 shrink-0 rounded-xl" />
              ))}
            </span>
            <span className="size-11 shrink-0 rounded-xl border border-hairline" />
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,46rem)] lg:items-end lg:gap-10">
            <div className="flex flex-col gap-3">
              <span className="skeleton block h-3 w-32 rounded" />
              <span className="skeleton block h-[var(--text-headline)] w-72 max-w-full rounded-lg" />
              <span className="skeleton block h-3 w-48 rounded" />
            </div>
            <span className="skeleton block h-[13rem] rounded-2xl md:h-[11.5rem]" />
          </div>
          <div className="mt-12">
            <span className="skeleton block h-3 w-56 rounded" />
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
              {[0, 1, 2, 3].map((i) => (
                <Panel key={i} className="grid gap-2 p-2 sm:p-2.5 lg:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)_minmax(0,13rem)_minmax(0,10.5rem)] lg:gap-2.5">
                  <span className="flex flex-col gap-2 p-2">
                    <span className="skeleton block h-8 w-40 rounded-full" />
                    <span className="skeleton block h-8 w-36 rounded-full" />
                  </span>
                  <span className="pl-projected block h-[9.5rem] rounded-xl" />
                  <span className="pl-actual block h-[7.5rem] rounded-xl lg:h-auto" data-state="pending" />
                  <span className="block h-12 rounded-xl border border-hairline lg:h-auto" />
                </Panel>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
