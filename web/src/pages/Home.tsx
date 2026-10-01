import * as m from 'motion/react-m'
import { lazy, Suspense } from 'react'
import championsLogo from '../assets/champions-league-logo-white.svg'
import premierLeagueLogo from '../assets/premier-league-logo-white.png'
import { ButtonLink } from '../components/Button'
import { CountUp } from '../components/CountUp'
import { HeroBackdrop } from '../components/home/HeroBackdrop'
import { HeroHeadline } from '../components/home/HeroHeadline'
import { BenchmarkDots } from '../components/home/BenchmarkDots'
import { Steps } from '../components/home/Steps'
import { ArrowRightIcon } from '../components/Icons'
import { CompetitionTile } from '../components/CompetitionTile'
import { FeaturedSkeleton, TickerSkeleton } from '../components/live/TickerShell'
import { Reveal, RevealItem } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { StatCard, StatCardSkeleton } from '../components/StatCard'
import { Tag } from '../components/Tag'
import { BACKTEST_MATCHES, BASE_RATES_PCT, BOOKMAKERS_PCT, MODEL_BACKTEST_PCT } from '../lib/benchmarks'
import { EASE_OUT_EXPO } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

// Live data pulls in supabase-js; load it after first paint, in its own chunk.
const live = () => import('../components/live/LiveData')
const ForecastTicker = lazy(() => live().then((mod) => ({ default: mod.ForecastTicker })))
const SeasonRecord = lazy(() => live().then((mod) => ({ default: mod.SeasonRecord })))
const FeaturedForecast = lazy(() => live().then((mod) => ({ default: mod.FeaturedForecast })))
const PremierLeagueDetail = lazy(() => live().then((mod) => ({ default: mod.PremierLeagueDetail })))

const one = (n: number) => n.toFixed(1)

export default function Home() {
  return (
    <>
      <title>PitchPredict · Premier League forecasts, graded in public</title>
      <Hero />
      <Proof />
      <Competitions />
      <HowItWorks />
    </>
  )
}

/* ---------- Hero ---------- */

function Hero() {
  const reduced = usePrefersReducedMotion()
  const rise = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE_OUT_EXPO, delay },
        }

  return (
    <section
      aria-labelledby="hero-title"
      className="bleed relative isolate -mt-[76px] flex min-h-[100svh] flex-col overflow-hidden pt-[76px]"
    >
      <HeroBackdrop />
      <div className="page-col relative grid flex-1 items-center gap-12 pt-8 pb-32 md:pb-36 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div>
        <m.p {...rise(0)} className="type-eyebrow mb-6 flex items-center gap-3 text-grey-200">
          <span aria-hidden="true" className="h-px w-10 bg-pitch" />
          Premier League<span className="hidden sm:inline"> · Dixon–Coles model</span>
        </m.p>
        <HeroHeadline
          id="hero-title"
          className="type-mega"
          lines={[{ text: 'Called before kick-off.' }, { text: 'Graded after full time.', className: 'text-glow' }]}
        />
        <m.p {...rise(0.75)} className="type-lede mt-7 max-w-[34rem]">
          A from-scratch statistical model gives every Premier League match a home, draw and away chance, then keeps a
          public record of how it did. It doesn’t beat the bookmakers, and it says so.
        </m.p>
        <m.div {...rise(0.9)} className="mt-9 flex flex-wrap items-center gap-3">
          <ButtonLink to="/premier-league" variant="primary" size="lg" icon={<ArrowRightIcon className="size-4" />}>
            This week’s forecasts
          </ButtonLink>
          <ButtonLink to="/about" size="lg">
            How it works
          </ButtonLink>
        </m.div>
        </div>
        <m.div
          {...rise(1.05)}
          className="hidden lg:block [perspective:1400px]"
        >
          <div className="[transform:rotateY(-8deg)_rotateX(3deg)] transition-transform duration-700 ease-out-expo hover:[transform:rotateY(0deg)_rotateX(0deg)]">
            <Suspense fallback={<FeaturedSkeleton />}>
              <FeaturedForecast />
            </Suspense>
          </div>
        </m.div>
      </div>
      <m.div {...rise(1.15)} className="page-col absolute inset-x-0 bottom-6 md:bottom-8">
        <Suspense fallback={<TickerSkeleton />}>
          <ForecastTicker />
        </Suspense>
      </m.div>
    </section>
  )
}

/* ---------- Proof row ---------- */

function Proof() {
  return (
    <section aria-labelledby="proof-title" className="pt-28 md:pt-40">
      <SectionHeading
        id="proof-title"
        eyebrow="The record"
        title={
          <>
            Every pick goes <span className="text-glow">on the record</span>
          </>
        }
        lede="Forecasts go up before kick-off and are graded after the final whistle, good weeks and bad. These are the numbers it stands on."
      />
      <Reveal as="ul" stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem as="li">
          <Suspense fallback={<StatCardSkeleton label="This season" />}>
            <SeasonRecord />
          </Suspense>
        </RevealItem>
        <RevealItem as="li">
          <StatCard
            label="Backtest"
            value={<CountUp value={BACKTEST_MATCHES} />}
            caption="past matches it was tested on, none of which it had seen while learning."
          />
        </RevealItem>
        <RevealItem as="li">
          <StatCard
            label="Top pick right"
            value={<CountUp value={Number(one(MODEL_BACKTEST_PCT))} decimals={1} suffix="%" />}
            caption={`on those matches. Bookmakers’ closing odds: ${one(BOOKMAKERS_PCT)}%. Guessing from base rates: ${one(BASE_RATES_PCT)}%.`}
          >
            <BenchmarkDots />
          </StatCard>
        </RevealItem>
        <RevealItem as="li">
          <StatCard
            label="Model input"
            value={<CountUp value={0} />}
            caption="betting odds used as input. It learns from past scorelines only."
          />
        </RevealItem>
      </Reveal>
    </section>
  )
}

/* ---------- League cards ---------- */

function Competitions() {
  return (
    <section aria-labelledby="competitions-title" className="relative pt-28 md:pt-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[70%] w-[110%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(60_240_140/0.08),transparent)]"
      />
      <SectionHeading
        id="competitions-title"
        eyebrow="Competitions"
        title="Pick a competition"
        lede="One league is live. The other is on the way."
        align="center"
      />
      <Reveal as="ul" stagger className="mx-auto mt-14 grid max-w-[64rem] grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
        <RevealItem as="li">
          <CompetitionTile
            to="/premier-league"
            name="Premier League"
            tone="active"
            status={<Tag tone="live">Forecasts live</Tag>}
            action="See the forecasts"
            logo={<img src={premierLeagueLogo} alt="" width={840} height={302} decoding="async" loading="lazy" />}
            detail={
              <Suspense fallback={<span className="skeleton inline-block h-3 w-56 rounded align-middle" />}>
                <PremierLeagueDetail />
              </Suspense>
            }
          />
        </RevealItem>
        <RevealItem as="li">
          <CompetitionTile
            to="/champions-league"
            name="Champions League"
            tone="upcoming"
            status={<Tag>Coming soon</Tag>}
            action="What’s planned"
            logo={<img src={championsLogo} alt="" width={128} height={58} decoding="async" loading="lazy" />}
            detail="No model or data yet"
          />
        </RevealItem>
      </Reveal>
    </section>
  )
}

/* ---------- How it works teaser ---------- */

function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="pt-28 md:pt-40">
      <SectionHeading
        id="how-title"
        eyebrow="How it works"
        title="Scorelines in, probabilities out"
        aside={
          <ButtonLink to="/about" icon={<ArrowRightIcon className="size-3.5" />}>
            The full story
          </ButtonLink>
        }
      />
      <Steps />
    </section>
  )
}
