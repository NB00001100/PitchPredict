import * as m from 'motion/react-m'
import { useScroll, useSpring } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { BarComparison, type BarRow } from '../components/BarComparison'
import { ButtonAnchor, ButtonLink } from '../components/Button'
import { ArrowRightIcon, ArrowUpRightIcon } from '../components/Icons'
import { Panel } from '../components/Panel'
import { PitchLines } from '../components/PitchLines'
import { PointerLight } from '../components/PointerLight'
import { ProbabilityBar } from '../components/ProbabilityBar'
import { Reveal, RevealItem } from '../components/Reveal'
import { Tag } from '../components/Tag'
import {
  BACKTEST_MATCHES,
  BASE_RATES_PCT,
  BASE_RATES_RPS,
  BOOKMAKERS_PCT,
  BOOKMAKERS_RPS,
  MODEL_BACKTEST_PCT,
  MODEL_BACKTEST_RPS,
} from '../lib/benchmarks'
import { EASE_OUT_EXPO } from '../lib/motion'
import { useLocation } from 'react-router'
import { AUTHOR, REPO_URL } from '../lib/site'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

/* Out-of-sample results on BACKTEST_MATCHES matches (lib/benchmarks.ts). Ordered best to worst. */
const ACCURACY: BarRow[] = [
  { name: 'Bookmakers', detail: 'closing odds', value: BOOKMAKERS_PCT },
  { name: 'PitchPredict', detail: 'this model', value: MODEL_BACKTEST_PCT, emphasis: true },
  { name: 'Base rates', detail: 'historical average', value: BASE_RATES_PCT },
]

const RPS: BarRow[] = [
  { name: 'Bookmakers', detail: 'closing odds', value: BOOKMAKERS_RPS },
  { name: 'PitchPredict', detail: 'this model', value: MODEL_BACKTEST_RPS, emphasis: true },
  { name: 'Base rates', detail: 'historical average', value: BASE_RATES_RPS },
]

const MATCHES = BACKTEST_MATCHES.toLocaleString('en-GB')
const rps4 = (n: number) => n.toFixed(4)

const CHAPTERS = [
  { id: 'model', title: 'The model' },
  { id: 'how-good', title: 'How good is it?' },
  { id: 'draws', title: 'Why it almost never picks a draw' },
  { id: 'backtested', title: 'What “backtested” means' },
  { id: 'who', title: 'Who built it' },
] as const

export default function About() {
  useScrollToHash()
  return (
    <>
      <title>How it works · PitchPredict</title>
      <ReadingProgress />
      <Intro />
      <div className="mt-20 grid gap-12 md:mt-28 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        <ChapterNav />
        <article className="flex min-w-0 flex-col gap-28 md:gap-36">
          <ModelChapter />
          <HowGoodChapter />
          <DrawsChapter />
          <BacktestedChapter />
          <WhoChapter />
        </article>
      </div>
    </>
  )
}

/* ---------- Chrome ---------- */

/**
 * Deep links such as /about#backtested: the page is lazy-loaded, so the
 * chapter didn't exist when the router tried to scroll to it. Scroll once it
 * has rendered.
 */
function useScrollToHash() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [hash])
}

/** A pitch-green hairline under the header that fills as you read. */
function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, mass: 0.3 })
  return (
    <m.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-pitch shadow-[0_0_12px_var(--color-pitch)]"
      style={{ scaleX }}
    />
  )
}

function Intro() {
  const reduced = usePrefersReducedMotion()
  const rise = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE_OUT_EXPO, delay },
        }
  return (
    <header className="bleed relative isolate -mt-[76px] overflow-hidden pt-[76px]">
      {/* A pitch seen from above, drawing itself in behind the title. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,#000_60%,transparent)]">
        <div className="absolute top-1/2 right-[-20%] w-[min(1100px,120vw)] -translate-y-1/2 rotate-90 opacity-70 sm:right-[-22%] [mask-image:radial-gradient(closest-side,#000_40%,transparent)]">
          <PitchLines stripes delay={0.2} strokeWidth={2} className="h-auto w-full text-pitch/35" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_50%,rgb(60_240_140/0.08),transparent)]" />
      </div>
      <div className="page-col flex min-h-[min(66svh,40rem)] flex-col justify-center py-20">
        <m.p {...rise(0)} className="type-eyebrow mb-6 flex items-center gap-3 text-pitch">
          <span aria-hidden="true" className="h-px w-10 bg-pitch" />
          The method, the numbers, the limits
        </m.p>
        <m.h1 {...rise(0.1)} className="type-mega">
          How it
          <br />
          <span className="text-glow">works</span>
        </m.h1>
        <m.p {...rise(0.3)} className="type-lede mt-8 max-w-[38rem]">
          Before every Premier League match, PitchPredict gives a chance of a home win, a draw and an away win. After
          the match, it keeps score of how those forecasts did, good weeks and bad.
        </m.p>
      </div>
    </header>
  )
}

/** Sticky chapter list (desktop) that marks the chapter in view. */
function ChapterNav() {
  const [active, setActive] = useState<string>(CHAPTERS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    for (const { id } of CHAPTERS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Chapters" className="hidden lg:block">
      <ol className="sticky top-28 flex flex-col gap-1 border-l border-hairline">
        {CHAPTERS.map((c, i) => {
          const on = active === c.id
          return (
            <li key={c.id} className="relative">
              {on ? (
                <m.span
                  layoutId="chapter-marker"
                  aria-hidden="true"
                  className="absolute inset-y-1 -left-px w-0.5 bg-pitch shadow-[0_0_10px_var(--color-pitch)]"
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                />
              ) : null}
              <a
                href={`#${c.id}`}
                aria-current={on ? 'location' : undefined}
                className={`flex gap-3 py-2 pl-5 text-sm transition-colors duration-200 ${on ? 'text-white' : 'text-grey-400 hover:text-white'}`}
              >
                <span className={`font-mono text-xs ${on ? 'text-pitch' : 'text-grey-500'}`}>0{i + 1}</span>
                {c.title}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ---------- Chapters ---------- */

function Chapter({ id, n, title, children }: { id: string; n: number; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
      <Reveal as="header" stagger className="mb-8 flex flex-col gap-4">
        <RevealItem as="p" className="type-label flex items-center gap-3 text-pitch">
          <span className="font-mono">0{n}</span>
          <span aria-hidden="true" className="h-px w-12 bg-gradient-to-r from-pitch/70 to-transparent" />
        </RevealItem>
        <RevealItem>
          <h2 id={`${id}-title`} className="type-headline">
            {title}
          </h2>
        </RevealItem>
      </Reveal>
      {children}
    </section>
  )
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <Reveal className="flex max-w-[42rem] flex-col gap-5 text-[1.0625rem] leading-relaxed text-grey-200 [&_strong]:font-semibold [&_strong]:text-white">
      {children}
    </Reveal>
  )
}

function Num({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[0.95em] whitespace-nowrap text-white tabular-nums">{children}</span>
}

const FLOW = [
  { k: 'Ratings', v: 'Attack and defence, per team' },
  { k: 'Expected goals', v: 'For each side, this match' },
  { k: 'Every scoreline', v: '0–0, 1–0, 1–1, …' },
  { k: 'Each result', v: 'Home · Draw · Away' },
]

function ModelChapter() {
  return (
    <Chapter id="model" n={1} title="The model">
      <Prose>
        <p>
          Each team gets two ratings: an <strong>attack</strong> rating for how many goals it tends to score, and a{' '}
          <strong>defence</strong> rating for how few it tends to let in. Put two teams’ ratings together and you get how
          many goals each side should expect, which gives the chance of every possible scoreline, and from those, the
          chance of each result.
        </p>
      </Prose>
      <Reveal as="ol" stagger className="my-10 grid gap-2 sm:grid-cols-4" amount={0.4}>
        {FLOW.map((step, i) => (
          <RevealItem as="li" key={step.k} className="relative">
            <Panel className="flex h-full flex-col gap-1.5 p-4">
              <PointerLight size={260} />
              <span className="font-mono text-[0.65rem] text-pitch">0{i + 1}</span>
              <span className="type-title text-lg">{step.k}</span>
              <span className="text-xs text-grey-400">{step.v}</span>
            </Panel>
            {i < FLOW.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-1/2 -right-2 z-10 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full border border-hairline-strong bg-black text-pitch sm:flex"
              >
                <ArrowRightIcon className="size-3" />
              </span>
            ) : null}
          </RevealItem>
        ))}
      </Reveal>
      <Prose>
        <p>
          The ratings are learned from past scorelines only, with recent matches counting more than old ones. The model
          never uses betting odds as an input. The method is a well-known one called the Dixon–Coles model.
        </p>
      </Prose>
    </Chapter>
  )
}

function HowGoodChapter() {
  return (
    <Chapter id="how-good" n={2} title="How good is it?">
      <Prose>
        <p>
          It was tested on <Num>{MATCHES}</Num> past matches it had not seen, and compared with two yardsticks: the bookmakers’
          closing odds, and simply guessing from historical base rates.
        </p>
      </Prose>
      <div className="mt-10 flex flex-col gap-6">
        <Reveal>
          <Panel tone="solid" className="p-5 sm:p-7">
            <BarComparison
              title="Top pick right"
              better="higher"
              rows={ACCURACY}
              max={60}
              ticks={[0, 20, 40, 60]}
              format={(n) => `${n.toFixed(1)}%`}
              tickFormat={(n) => `${n}%`}
              valueLabel="Top pick right"
              note={`Share of the ${MATCHES} unseen matches where the forecaster’s most likely outcome was what happened.`}
            />
          </Panel>
        </Reveal>
        <Reveal>
          <Panel tone="solid" className="p-5 sm:p-7">
            <BarComparison
              title="Ranked probability score (RPS)"
              better="lower"
              rows={RPS}
              max={0.25}
              ticks={[0, 0.05, 0.1, 0.15, 0.2, 0.25]}
              format={(n) => n.toFixed(4)}
              tickFormat={(n) => (n === 0 ? '0' : n.toFixed(2))}
              valueLabel="RPS (lower is better)"
              note={`Shorter bar, better forecast. Same ${MATCHES} matches.`}
            />
          </Panel>
        </Reveal>
      </div>
      <div className="mt-10">
        <Prose>
          <p>
            The main score is the RPS (ranked probability score), where <strong>lower is better</strong>. It judges the
            whole forecast, not only the top pick: a confident forecast that turns out wrong costs more than a cautious
            one. The model’s <Num>{rps4(MODEL_BACKTEST_RPS)}</Num> sits between the base rates (
            <Num>{rps4(BASE_RATES_RPS)}</Num>) and the bookmakers (<Num>{rps4(BOOKMAKERS_RPS)}</Num>).
          </p>
        </Prose>
      </div>
      <Reveal className="mt-12">
        <blockquote className="relative max-w-[46rem] border-l-2 border-pitch pl-6 md:pl-8">
          <p className="font-display text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.08] font-bold text-white [font-variation-settings:'wdth'_78]">
            It does not beat the bookmakers, and it was not expected to. The point is a forecast that is clearly better
            than guesswork, with its record shown in full.
          </p>
        </blockquote>
      </Reveal>
    </Chapter>
  )
}

function DrawsChapter() {
  return (
    <Chapter id="draws" n={3} title="Why it almost never picks a draw">
      <Reveal>
        <Panel tone="accent" className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
          <PointerLight />
          <div className="flex flex-col gap-5 text-[1.0625rem] leading-relaxed text-grey-200">
            <p className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.05] font-bold text-white [font-variation-settings:'wdth'_78]">
              About a quarter of matches end in a draw, yet a draw is almost never the single most likely outcome of any
              one match.
            </p>
            <p>
              So the model’s pick, its most likely outcome, is almost always a home or an away win: across the{' '}
              {MATCHES} backtest matches it never picked a draw. The chance of a draw is still in every forecast; it
              just rarely comes out on top.
            </p>
          </div>
          <figure className="flex flex-col gap-4 rounded-xl border border-hairline bg-black/40 p-5">
            <figcaption className="type-label text-[0.62rem] text-grey-400">
              Illustration, not a real fixture
            </figcaption>
            <ProbabilityBar forecast={{ H: 0.44, D: 0.27, A: 0.29 }} homeName="The home side" awayName="the away side" />
            <div aria-hidden="true" className="flex flex-wrap gap-2">
              <Tag tone="accent" icon={null}>
                Pick: home win
              </Tag>
              <Tag icon={null} className="whitespace-normal">
                Draw: in the forecast, not on top
              </Tag>
            </div>
          </figure>
        </Panel>
      </Reveal>
    </Chapter>
  )
}

function BacktestedChapter() {
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1)
  const live = 6
  return (
    <Chapter id="backtested" n={4} title="What “backtested” means">
      <Prose>
        <p>
          Matchweeks that were already played when PitchPredict went live have forecasts marked <em>backtested</em>.
          Those were generated afterwards, but using only data from before that matchweek, so the model could not peek
          at the results it is being scored on.
        </p>
      </Prose>
      <Reveal className="mt-10">
        <figure aria-hidden="true" className="flex flex-col gap-4">
          <div className="flex items-end gap-1">
            {weeks.map((w) => {
              const back = w < live
              return (
                <div key={w} className="flex flex-1 flex-col items-center gap-2">
                  {w === live ? (
                    <span className="type-label text-[0.58rem] whitespace-nowrap text-pitch">Went live</span>
                  ) : (
                    <span className="h-[0.9rem]" />
                  )}
                  <span
                    className={`h-12 w-full rounded-md border ${back ? 'border-hairline-strong bg-[repeating-linear-gradient(135deg,rgb(214_255_234/0.06)_0_4px,transparent_4px_8px)]' : 'border-pitch/40 bg-pitch-dim'} ${w === live ? 'shadow-[0_0_0_1px_var(--color-pitch),0_0_20px_-4px_var(--color-pitch)]' : ''}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-grey-400">
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-hairline-strong bg-[repeating-linear-gradient(135deg,rgb(214_255_234/0.2)_0_2px,transparent_2px_4px)]" />
              Backtested: made afterwards, from data before that matchweek
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm border border-pitch/40 bg-pitch-dim" />
              Forecast before kick-off
            </span>
          </div>
          <figcaption className="type-label flex justify-between text-[0.62rem] text-grey-500">
            <span>← Earlier matchweeks</span>
            <span>Illustration</span>
            <span>Later matchweeks →</span>
          </figcaption>
        </figure>
      </Reveal>
    </Chapter>
  )
}

function WhoChapter() {
  return (
    <Chapter id="who" n={5} title="Who built it">
      <Reveal>
        <Panel className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <PointerLight />
          <p className="text-[1.0625rem] leading-relaxed text-grey-200">
            Built by <strong className="font-semibold text-white">{AUTHOR}</strong>. The code is on GitHub.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonAnchor href={REPO_URL} icon={<ArrowUpRightIcon className="size-3.5" />}>
              Code on GitHub
            </ButtonAnchor>
            <ButtonLink to="/premier-league" variant="primary" icon={<ArrowRightIcon className="size-3.5" />}>
              See the forecasts
            </ButtonLink>
          </div>
        </Panel>
      </Reveal>
    </Chapter>
  )
}
