import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Panel } from '../components/Panel'
import { DataStatus } from '../components/premier-league/DataStatus'
import { LoadError } from '../components/premier-league/LoadError'
import { PageHero } from '../components/premier-league/PageHero'
import { ResultsFilters } from '../components/premier-league/ResultsFilters'
import { ResultsList } from '../components/premier-league/ResultsList'
import { ResultsSummary } from '../components/premier-league/ResultsSummary'
import '../components/premier-league/premierLeague.css'
import { filterRows, parseOutcomeFilter, resultMatchweeks, resultRows, summariseResults, type OutcomeFilter } from '../lib/results'
import type { Fixture } from '../lib/types'
import { useFixtures } from '../lib/useFixtures'

const TITLE = 'Results · Premier League · PitchPredict'

export default function PremierLeagueResults() {
  const { status, fixtures, error, retry, updatedAt } = useFixtures()
  return (
    <>
      <title>{TITLE}</title>
      <PageHero
        eyebrow="Results · 2026/27 season"
        lede="Every finished match the model forecast, newest first: what it predicted beside what actually happened, and how both the calls and the probabilities scored."
        status={status === 'ready' ? <DataStatus fixtures={fixtures} updatedAt={updatedAt} /> : <p>{status === 'loading' ? 'Loading…' : 'Data unavailable'}</p>}
      />
      {status === 'loading' ? (
        <ResultsSkeleton />
      ) : status === 'error' ? (
        <LoadError message={error.message} onRetry={retry} />
      ) : (
        <Results fixtures={fixtures} />
      )}
    </>
  )
}

function Results({ fixtures }: { fixtures: readonly Fixture[] }) {
  const rows = useMemo(() => resultRows(fixtures), [fixtures])
  const matchweeks = useMemo(() => resultMatchweeks(rows), [rows])
  const [params, setParams] = useSearchParams()

  const rawMw = Number(params.get('mw'))
  const matchweek = Number.isInteger(rawMw) && matchweeks.includes(rawMw) ? rawMw : null
  const outcome = parseOutcomeFilter(params.get('show'))

  const update = useCallback(
    (key: 'mw' | 'show', value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === null) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  )

  const shown = useMemo(() => filterRows(rows, { matchweek, outcome }), [rows, matchweek, outcome])
  const summary = useMemo(() => summariseResults(shown), [shown])
  const scope = `${matchweek === null ? 'All matchweeks' : `Matchweek ${matchweek}`} · ${OUTCOME_SCOPE[outcome]} · ${shown.length} ${shown.length === 1 ? 'match' : 'matches'}`

  if (rows.length === 0) {
    return (
      <Panel className="mt-12 p-8 md:mt-16">
        <p className="type-title uppercase">No results yet</p>
        <p className="mt-3 max-w-prose text-grey-200">Results appear here once the first forecast match has been played.</p>
      </Panel>
    )
  }

  return (
    <>
      <ResultsSummary summary={summary} scope={scope} />
      <section aria-labelledby="results-list-heading" className="mt-16 md:mt-24">
        <h2 id="results-list-heading" className="type-headline">
          Match by match
        </h2>
        <div className="mt-8">
          <ResultsFilters
            matchweeks={matchweeks}
            matchweek={matchweek}
            outcome={outcome}
            onMatchweek={(mw) => update('mw', mw === null ? null : String(mw))}
            onOutcome={(o: OutcomeFilter) => update('show', o === 'all' ? null : o)}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {`Showing ${scope}`}
        </p>
        <div className="mt-6">
          {shown.length ? (
            <ResultsList key={`${matchweek}-${outcome}`} rows={shown} />
          ) : (
            <Panel className="flex flex-col items-start gap-4 p-8">
              <p className="text-grey-200">No matches fit these filters.</p>
              <button
                type="button"
                onClick={() => setParams({}, { replace: true, preventScrollReset: true })}
                className="glass inline-flex h-10 items-center rounded-full px-4 font-wide text-[0.64rem] font-semibold tracking-[0.14em] uppercase hover:text-pitch"
              >
                Clear filters
              </button>
            </Panel>
          )}
        </div>
      </section>
    </>
  )
}

const OUTCOME_SCOPE: Record<OutcomeFilter, string> = { all: 'all calls', correct: 'correct calls', incorrect: 'incorrect calls' }

function ResultsSkeleton() {
  return (
    <div aria-busy="true">
      <output className="sr-only">Loading results…</output>
      <div aria-hidden="true">
        <Panel className="mt-12 h-[38rem] p-5 sm:p-7 md:mt-16 lg:h-[27rem] lg:p-10">
          <span className="skeleton block h-3 w-32 rounded" />
          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
            <span className="skeleton block h-32 rounded-xl" />
            <span className="skeleton block h-32 rounded-xl" />
            <span className="skeleton block h-32 rounded-xl" />
          </div>
        </Panel>
        <div className="mt-16 md:mt-24">
          <span className="skeleton block h-[var(--text-headline)] w-80 max-w-full rounded-lg" />
          <span className="skeleton mt-8 block h-11 w-full max-w-xl rounded-full" />
          <div className="mt-6 flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="skeleton block h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
