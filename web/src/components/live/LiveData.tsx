/*
 * Everything on the landing page that needs live data. This module pulls in
 * supabase-js, so Home lazy-loads it: first paint never waits for it.
 */
import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { fixtureView, type FixtureView, type ForecastView } from '../../lib/fixtureView'
import { fixturePhase } from '../../lib/matchweek'
import { forecastOf } from '../../lib/probability'
import { currentMatchweek, hitRate } from '../../lib/selectors'
import type { Fixture } from '../../lib/types'
import { useFixtures } from '../../lib/useFixtures'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { CountUp } from '../CountUp'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'
import { PredictedZone } from '../PredictedActual'
import { ProbabilityBar } from '../ProbabilityBar'
import { Tag } from '../Tag'
import { TeamMonogram } from '../TeamMonogram'
import { StatCard, StatCardSkeleton } from '../StatCard'
import { FeaturedSkeleton, TickerSkeleton } from './TickerShell'

/** "Sat 11:30" in the viewer's locale and time zone, like the fixture pages. */
const KICKOFF = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** Nothing left to play: every fixture finished or cancelled. */
function seasonOver(fixtures: readonly Fixture[]): boolean {
  return fixtures.length > 0 && fixtures.every((f) => f.status === 'FINISHED' || f.status === 'CANCELLED')
}

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
  // On error, or with nothing forecast yet, the strip keeps its place and says why.
  if (status === 'error') return <TickerNotice>This week’s forecasts couldn’t be loaded just now.</TickerNotice>
  if (!week) return <TickerNotice>Forecasts for the next matchweek aren’t out yet.</TickerNotice>
  return <Ticker matchweek={week.matchweek} fixtures={week.fixtures} />
}

/** The ticker's footprint with a one-line message and the way to the forecasts page. */
function TickerNotice({ children }: { children: string }) {
  return (
    <section aria-labelledby="ticker-title" className="glass relative flex h-20 items-stretch overflow-hidden rounded-2xl">
      <div className="relative z-10 flex shrink-0 flex-col justify-center border-r border-hairline bg-black/70 px-3 py-3 sm:px-5">
        <h2 id="ticker-title" className="type-eyebrow text-grey-200">
          This week
        </h2>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <p className="min-w-0 text-[0.82rem] leading-snug text-grey-200 sm:text-sm">{children}</p>
        <Link
          to="/premier-league"
          className="inline-flex shrink-0 items-center gap-1.5 font-wide text-[0.62rem] font-semibold tracking-[0.14em] whitespace-nowrap text-white uppercase underline-offset-4 hover:text-pitch hover:underline"
        >
          Open the forecasts <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}

function Ticker({ matchweek, fixtures }: { matchweek: number; fixtures: Fixture[] }) {
  const to = `/premier-league?mw=${matchweek}`
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
            <TickerItem key={f.fixture_id} fixture={f} to={to} />
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
                <TickerItem key={f.fixture_id} fixture={f} to={to} />
              ))}
            </ul>
            {/* A second copy makes the loop seamless; it is hidden from assistive tech and the tab order. */}
            <ul className="flex" aria-hidden="true" inert>
              {fixtures.map((f) => (
                <TickerItem key={f.fixture_id} fixture={f} to={to} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

/** What the ticker says about when or how a match stands: kick-off, live, full time or why it isn't on. */
function tickerWhen(fixture: Fixture): string {
  const phase = fixturePhase(fixture)
  if (phase === 'finished') return fixture.home_goals !== null && fixture.away_goals !== null ? `FT ${fixture.home_goals}–${fixture.away_goals}` : 'FT'
  if (phase === 'live') return 'Live'
  if (phase === 'postponed') return 'Postponed'
  if (phase === 'suspended') return 'Suspended'
  if (phase === 'cancelled') return 'Cancelled'
  return fixture.kickoff ? KICKOFF.format(new Date(fixture.kickoff)) : ''
}

function TickerItem({ fixture, to }: { fixture: Fixture; to: string }) {
  const forecast = forecastOf(fixture)
  if (!forecast) return null
  const kickoff = tickerWhen(fixture)
  return (
    <li className="shrink-0 snap-start border-r border-hairline">
      <Link
        to={to}
        className="group/item flex h-full w-[15.5rem] flex-col justify-center gap-2 px-5 py-3 transition-colors duration-200 hover:bg-glass-strong focus-visible:-outline-offset-2"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span translate="no" className="font-wide text-sm font-bold tracking-[0.06em]">
            {fixture.home_tla}
            <span className="px-1.5 font-sans text-xs font-normal text-grey-500">v</span>
            {fixture.away_tla}
          </span>
          <span className="type-label text-[0.65rem] whitespace-nowrap text-grey-400">{kickoff}</span>
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
  const backtested = useMemo(() => fixtures.filter((f) => f.hit !== null && f.is_backfill === true).length, [fixtures])

  if (status === 'loading') return <StatCardSkeleton label={SEASON_LABEL} />
  if (status === 'error') {
    return (
      <StatCard
        label={SEASON_LABEL}
        value="—"
        caption="The live record couldn’t be loaded just now. The Premier League page shows every graded pick."
      />
    )
  }
  if (rate.pct === null) {
    return (
      <StatCard
        label={SEASON_LABEL}
        value="—"
        caption="No picks graded yet. The record starts counting with the first match played."
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
          {rate.total} graded so far
          {backtested > 0 ? (
            <>
              {' '}
              ({backtested === rate.total ? 'all' : backtested}{' '}
              <Link to="/about#backtested" className="underline decoration-grey-500 underline-offset-[0.2em] hover:text-pitch">
                backtested
              </Link>
              )
            </>
          ) : null}
          .
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
    if (seasonOver(fixtures)) return `Season complete · ${rate.hits} of ${rate.total} right`
    const parts = [`Matchweek ${mw}`, `${forecasts} forecast${forecasts === 1 ? '' : 's'}`]
    if (rate.total) parts.push(`${rate.hits} of ${rate.total} right this season`)
    return parts.join(' · ')
  }, [fixtures])

  if (status === 'loading') return <span className="skeleton inline-block h-3 w-56 rounded align-middle" />
  return <>{status === 'ready' && line ? line : 'Forecasts and results, matchweek by matchweek'}</>
}

/* ---------- Hero: the week's most confident forecast ---------- */

/** The hero card's fixed height: skeleton, card and fallback all take it, so the hero never jumps. */
const FEATURED_HEIGHT = 'h-[31rem]'

/**
 * The fixture still to be played this matchweek where the model's pick is
 * most confident: a product glimpse in the hero. It is a forecast, not a tip,
 * and the card says so in numbers: the pick's chance, and what's left for the
 * other two results. Shows only the forecast (it is before or during the
 * match). With nothing to feature, or on a failed load, a card of the same
 * size explains and links to the forecasts.
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
  if (status === 'error') return <FeaturedFallback title="Forecasts unavailable" body="This week’s forecasts couldn’t be loaded just now. The forecasts page will try again." />
  if (!featured?.forecast && seasonOver(fixtures)) {
    return (
      <FeaturedFallback
        title="Season complete"
        body="Every match of the season has been played and graded. The model’s most confident forecast returns with the next season’s first matchweek."
      />
    )
  }
  if (!featured?.forecast) {
    return (
      <FeaturedFallback
        title="No forecast to feature yet"
        body="The model’s most confident forecast of the week appears here once forecasts for the next matchweek are published, a few days before kick-off."
      />
    )
  }
  return <FeaturedCard key={featured.fixture.fixture_id} view={featured} forecast={featured.forecast} />
}

function FeaturedCard({ view, forecast }: { view: FixtureView; forecast: ForecastView }) {
  const { fixture, phase } = view
  const pickPct = forecast.percents[forecast.pick]
  const rest = 100 - pickPct
  return (
    <Panel as="article" aria-labelledby="featured-title" className={`flex ${FEATURED_HEIGHT} flex-col gap-5 p-6`}>
      <PointerLight />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Tag tone="accent" icon={null}>
          Matchweek {fixture.matchweek} · Most confident
        </Tag>
        {phase === 'live' ? (
          <Tag tone="live">Live</Tag>
        ) : (
          <time dateTime={fixture.kickoff} className="type-label shrink-0 text-[0.68rem] whitespace-nowrap text-grey-400">
            {fixture.kickoff ? KICKOFF.format(new Date(fixture.kickoff)) : ''}
          </time>
        )}
      </div>
      <h2 id="featured-title" className="flex flex-col gap-3">
        {[
          [fixture.home_tla, fixture.home_team, 'Home'],
          [fixture.away_tla, fixture.away_team, 'Away'],
        ].map(([tla, name, side], i) => (
          <span key={side} className="flex min-w-0 items-center gap-3">
            <TeamMonogram tla={tla} />
            <span className="type-title min-w-0 truncate">{name}</span>
            {i === 0 ? <span className="sr-only"> versus </span> : null}
            <span aria-hidden="true" className="type-label ml-auto text-[0.62rem] text-grey-500">
              {side}
            </span>
          </span>
        ))}
      </h2>
      <PredictedZone aside={forecast.backtested ? <Tag icon={null}>Backtested</Tag> : null}>
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium text-white">{forecast.pickLabel}</span>
          <span className="type-stat text-[2.75rem] text-pitch">{pickPct}%</span>
        </p>
        <ProbabilityBar forecast={forecast.shares} homeName={fixture.home_team} awayName={fixture.away_team} />
        {forecast.likeliestScore ? (
          <p className="flex justify-between border-t border-hairline pt-3 text-sm text-grey-400">
            Likeliest score
            <span className="font-mono text-white">{forecast.likeliestScore}</span>
          </p>
        ) : null}
      </PredictedZone>
      <p className="text-[0.8rem] leading-snug text-grey-400">
        The model’s most confident forecast this matchweek, not a tip: it still gives the other results{' '}
        <span className="font-mono text-grey-200">{rest}%</span>.
      </p>
      <Link
        to={`/premier-league?mw=${fixture.matchweek}`}
        className="group/f mt-auto inline-flex items-center gap-2 self-start font-wide text-[0.66rem] font-semibold tracking-[0.14em] text-grey-200 uppercase hover:text-pitch"
      >
        All matchweek {fixture.matchweek} forecasts
        <span aria-hidden="true" className="transition-transform duration-300 group-hover/f:translate-x-1">
          →
        </span>
      </Link>
    </Panel>
  )
}

function FeaturedFallback({ title, body }: { title: string; body: string }) {
  return (
    <Panel as="article" aria-labelledby="featured-title" className={`flex ${FEATURED_HEIGHT} flex-col gap-5 p-6`}>
      <Tag icon={null} className="self-start">This week</Tag>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <h2 id="featured-title" className="type-title">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-grey-200">{body}</p>
      </div>
      <Link
        to="/premier-league"
        className="group/f inline-flex items-center gap-2 self-start font-wide text-[0.66rem] font-semibold tracking-[0.14em] text-grey-200 uppercase hover:text-pitch"
      >
        Open the forecasts
        <span aria-hidden="true" className="transition-transform duration-300 group-hover/f:translate-x-1">
          →
        </span>
      </Link>
    </Panel>
  )
}
