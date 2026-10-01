/*
 * Everything on the landing page that needs live data. This module pulls in
 * supabase-js, so Home lazy-loads it: first paint never waits for it.
 */
import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { fixtureView } from '../../lib/fixtureView'
import { forecastOf } from '../../lib/probability'
import { currentMatchweek, hitRate } from '../../lib/selectors'
import type { Fixture } from '../../lib/types'
import { useFixtures } from '../../lib/useFixtures'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { CountUp } from '../CountUp'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'
import { ProbabilityBar } from '../ProbabilityBar'
import { Tag } from '../Tag'
import { TeamMonogram } from '../TeamMonogram'
import { StatCard, StatCardSkeleton } from '../StatCard'
import { FeaturedSkeleton, TickerSkeleton } from './TickerShell'

const KICKOFF = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/* ---------- This week's forecasts ticker ---------- */

export function ForecastTicker() {
  const { status, fixtures } = useFixtures()
  const week = useMemo(() => {
    const mw = currentMatchweek(fixtures)
    if (mw === null) return null
    const list = fixtures.filter((f) => f.matchweek === mw && forecastOf(f) !== null)
    return list.length ? { matchweek: mw, fixtures: list } : null
  }, [fixtures])

  if (status === 'loading') return <TickerSkeleton />
  // On error, or with nothing forecast yet, the strip simply isn't shown.
  if (status === 'error' || !week) return null
  return <Ticker matchweek={week.matchweek} fixtures={week.fixtures} />
}

function Ticker({ matchweek, fixtures }: { matchweek: number; fixtures: Fixture[] }) {
  const reduced = usePrefersReducedMotion()
  // ~5s per fixture keeps reading speed comfortable whatever the count.
  const duration = `${Math.max(30, fixtures.length * 5)}s`

  return (
    <section aria-labelledby="ticker-title" className="glass relative flex h-20 items-stretch overflow-hidden rounded-2xl">
      <div className="relative z-10 flex shrink-0 flex-col justify-center gap-1 border-r border-hairline bg-black/70 px-3 py-3 sm:px-5">
        <h2 id="ticker-title" className="type-eyebrow flex items-center gap-2 text-pitch">
          <span aria-hidden="true" className="relative inline-flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-pitch motion-safe:animate-[pp-pulse-dot_1.6s_ease-out_infinite]" />
            <span className="relative size-1.5 rounded-full bg-pitch" />
          </span>
          <span>
            <span className="sr-only sm:not-sr-only">Matchweek </span>
            <span aria-hidden="true" className="sm:hidden">MW </span>
            {matchweek}
            <span className="sr-only"> forecasts</span>
          </span>
        </h2>
        <p aria-hidden="true" className="type-label hidden text-[0.65rem] text-grey-400 sm:block">
          Home · Draw · Away
        </p>
      </div>
      {reduced ? (
        <ul className="flex min-w-0 snap-x overflow-x-auto [scrollbar-width:none]">
          {fixtures.map((f) => (
            <TickerItem key={f.fixture_id} fixture={f} />
          ))}
        </ul>
      ) : (
        <div className="group/ticker relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_92%,transparent)]">
          <div
            className="flex w-max animate-[pp-marquee_var(--ticker-duration)_linear_infinite] group-focus-within/ticker:[animation-play-state:paused] group-hover/ticker:[animation-play-state:paused]"
            style={{ '--ticker-duration': duration } as CSSProperties}
          >
            <ul className="flex">
              {fixtures.map((f) => (
                <TickerItem key={f.fixture_id} fixture={f} />
              ))}
            </ul>
            {/* A second copy makes the loop seamless; it is hidden from assistive tech and the tab order. */}
            <ul className="flex" aria-hidden="true" inert>
              {fixtures.map((f) => (
                <TickerItem key={f.fixture_id} fixture={f} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function TickerItem({ fixture }: { fixture: Fixture }) {
  const forecast = forecastOf(fixture)
  if (!forecast) return null
  const kickoff = fixture.kickoff ? KICKOFF.format(new Date(fixture.kickoff)) : ''
  return (
    <li className="shrink-0 snap-start border-r border-hairline">
      <Link
        to="/premier-league"
        className="group/item flex h-full w-[15.5rem] flex-col justify-center gap-2 px-5 py-3 transition-colors duration-200 hover:bg-glass-strong focus-visible:-outline-offset-2"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span translate="no" className="font-wide text-sm font-bold tracking-[0.06em]">
            {fixture.home_tla}
            <span className="px-1.5 font-sans text-xs font-normal text-grey-500">v</span>
            {fixture.away_tla}
          </span>
          <span className="type-label text-[0.65rem] text-grey-400">{kickoff}</span>
        </span>
        <ProbabilityBar
          forecast={forecast}
          homeName={fixture.home_team}
          awayName={fixture.away_team}
          size="sm"
        />
        <span className="sr-only">{`, ${fixture.home_team} v ${fixture.away_team}. See all forecasts.`}</span>
      </Link>
    </li>
  )
}

/* ---------- This season's record (proof row) ---------- */

const SEASON_LABEL = 'This season'

export function SeasonRecord() {
  const { status, fixtures } = useFixtures()
  const graded = useMemo(() => fixtures.filter((f) => f.hit !== null).map((f) => f.hit === true), [fixtures])
  const rate = useMemo(() => hitRate(fixtures), [fixtures])

  if (status === 'loading') return <StatCardSkeleton label={SEASON_LABEL} />
  if (status === 'error' || rate.pct === null) {
    return (
      <StatCard
        label={SEASON_LABEL}
        value="—"
        caption="The live record couldn’t be loaded just now. The Premier League page shows every graded pick."
      />
    )
  }
  return (
    <StatCard
      label={SEASON_LABEL}
      value={<CountUp value={Math.round(rate.pct)} suffix="%" />}
      caption={
        <>
          of this season’s picks were right: <strong className="font-semibold text-white">{rate.hits}</strong> of{' '}
          {rate.total} graded so far.
        </>
      }
    >
      <PickStrip picks={graded} />
    </StatCard>
  )
}

/**
 * Every graded pick in order, as a row of ticks: a filled green square for a
 * hit, a hollow outline for a miss (shape, not just colour).
 */
function PickStrip({ picks }: { picks: boolean[] }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-[3px]">
        {picks.map((hit, i) => (
          <span
            key={i}
            className={`size-[7px] rounded-[2px] ${hit ? 'bg-pitch shadow-[0_0_6px_rgb(60_240_140/0.6)]' : 'border border-grey-500'}`}
          />
        ))}
      </div>
      <p className="type-label flex gap-4 text-[0.62rem] text-grey-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-[7px] rounded-[2px] bg-pitch" /> Right
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-[7px] rounded-[2px] border border-grey-500" /> Wrong
        </span>
      </p>
    </div>
  )
}

/* ---------- Premier League tile detail ---------- */

/** "Matchweek 6 · 10 forecasts · 24 of 50 right": one line for the competition tile. */
export function PremierLeagueDetail() {
  const { status, fixtures } = useFixtures()
  const line = useMemo(() => {
    const mw = currentMatchweek(fixtures)
    if (mw === null) return null
    const forecasts = fixtures.filter((f) => f.matchweek === mw && forecastOf(f) !== null).length
    const rate = hitRate(fixtures)
    const parts = [`Matchweek ${mw}`, `${forecasts} forecast${forecasts === 1 ? '' : 's'}`]
    if (rate.total) parts.push(`${rate.hits} of ${rate.total} right this season`)
    return parts.join(' · ')
  }, [fixtures])

  if (status === 'loading') return <span className="skeleton inline-block h-3 w-56 rounded align-middle" />
  return <>{status === 'ready' && line ? line : 'Forecasts and results, matchweek by matchweek'}</>
}

/* ---------- Hero: the week's most confident call ---------- */

/**
 * The upcoming fixture this week where the model's pick is most confident:
 * a product glimpse in the hero. Shows only the forecast (it is before
 * kick-off), labelled as a prediction.
 */
export function FeaturedForecast() {
  const { status, fixtures } = useFixtures()
  const featured = useMemo(() => {
    const mw = currentMatchweek(fixtures)
    let best: Fixture | null = null
    let bestP = -1
    for (const f of fixtures) {
      if (f.matchweek !== mw || f.status === 'FINISHED' || f.status === 'CANCELLED') continue
      const fc = forecastOf(f)
      if (!fc) continue
      const p = Math.max(fc.H, fc.A)
      if (p > bestP) {
        best = f
        bestP = p
      }
    }
    return best ? fixtureView(best) : null
  }, [fixtures])

  if (status === 'loading') return <FeaturedSkeleton />
  if (status === 'error' || !featured?.forecast) return null
  const { fixture, forecast } = featured
  const pickPct = forecast.percents[forecast.pick]
  return (
    <Panel as="article" aria-labelledby="featured-title" className="flex flex-col gap-6 p-6">
      <PointerLight />
      <div className="flex items-center justify-between gap-3">
        <Tag tone="live">Matchweek {fixture.matchweek} · Top call</Tag>
        <span className="type-label text-[0.68rem] text-grey-400">
          {fixture.kickoff ? KICKOFF.format(new Date(fixture.kickoff)) : ''}
        </span>
      </div>
      <h2 id="featured-title" className="flex flex-col gap-3">
        {[
          [fixture.home_tla, fixture.home_team, 'Home'],
          [fixture.away_tla, fixture.away_team, 'Away'],
        ].map(([tla, name, side]) => (
          <span key={side} className="flex items-center gap-3">
            <TeamMonogram tla={tla} />
            <span className="type-title">{name}</span>
            <span className="type-label ml-auto text-[0.62rem] text-grey-500">{side}</span>
          </span>
        ))}
      </h2>
      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-glass p-4">
        <p className="type-label text-[0.65rem] text-grey-400">
          Predicted <span className="text-grey-500">· Before kick-off</span>
        </p>
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium">{forecast.pickLabel}</span>
          <span className="type-stat text-[2.75rem] text-pitch">{pickPct}%</span>
        </p>
        <ProbabilityBar forecast={forecast.shares} homeName={fixture.home_team} awayName={fixture.away_team} />
        {forecast.likeliestScore ? (
          <p className="flex justify-between border-t border-hairline pt-3 text-sm text-grey-400">
            Likeliest score
            <span className="font-mono text-white">{forecast.likeliestScore}</span>
          </p>
        ) : null}
      </div>
      <Link to="/premier-league" className="group/f inline-flex items-center gap-2 self-start font-wide text-[0.66rem] font-semibold tracking-[0.14em] text-grey-200 uppercase hover:text-pitch">
        All {fixture.matchweek ? `matchweek ${fixture.matchweek}` : ''} forecasts
        <span aria-hidden="true" className="transition-transform duration-300 group-hover/f:translate-x-1">→</span>
      </Link>
    </Panel>
  )
}
