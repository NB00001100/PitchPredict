import * as m from 'motion/react-m'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { EASE_OUT_EXPO } from '../../lib/motion'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { PitchLines } from '../PitchLines'

interface PageHeroProps {
  /** Small wide-caps line above the title. */
  eyebrow?: ReactNode
  lede?: ReactNode
  /** Quiet status line under the tabs, e.g. "Results through matchweek 5 · updated 2 min ago". */
  status?: ReactNode
}

const DEFAULT_LEDE =
  'Every match gets a home, draw and away chance before kickoff. After full time, each pick is graded against what actually happened. The model doesn’t beat the bookmakers, and this page shows where it stands.'

/**
 * The Premier League pages' opening: eyebrow, title, lede, the switch
 * between the two views, and a pitch drawn faintly in floodlight behind.
 */
export function PageHero({ eyebrow = 'Forecasts · 2026/27 season', lede = DEFAULT_LEDE, status }: PageHeroProps) {
  const reduced = usePrefersReducedMotion()
  const rise = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, ease: EASE_OUT_EXPO, delay },
        }

  return (
    <header className="relative isolate pt-10 md:pt-16">
      {/* A landscape pitch schematic, tipped back under the floodlights, fading out towards the title. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-4 right-[-6rem] -z-10 hidden w-[44rem] [perspective:1200px] [mask-image:linear-gradient(90deg,transparent,#000_45%)] lg:block xl:right-[-3rem]"
      >
        <div className="relative aspect-[1090/720] [transform:rotateX(52deg)_rotateZ(-8deg)]">
          <div className="absolute top-1/2 left-1/2 w-[66.06%] -translate-x-1/2 -translate-y-1/2 rotate-90">
            <PitchLines
              stripes
              delay={0.25}
              strokeWidth={3}
              className="h-auto w-full text-pitch/45 [filter:drop-shadow(0_0_5px_rgb(60_240_140/0.55))]"
            />
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 -z-10 h-[28rem] w-[40rem] max-w-full rounded-full bg-[radial-gradient(closest-side,rgb(150_200_255/0.08),transparent)]"
      />

      <m.p {...rise(0)} className="type-eyebrow flex items-center gap-3 text-grey-200">
        <span aria-hidden="true" className="h-px w-10 bg-pitch" />
        {eyebrow}
      </m.p>
      <m.h1 {...rise(0.08)} className="type-display mt-6">
        Premier <span className="text-glow">League</span>
      </m.h1>
      <m.p {...rise(0.2)} className="type-lede mt-6 max-w-[40rem]">
        {lede}
      </m.p>
      <m.div {...rise(0.3)} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ViewTabs />
        {status ? <div className="w-full font-mono text-[0.7rem] tracking-[0.04em] text-grey-400 sm:w-auto">{status}</div> : null}
      </m.div>
    </header>
  )
}

const TABS = [
  { to: '/premier-league', label: 'Matchweeks', end: true },
  { to: '/premier-league/results', label: 'Results', end: true },
] as const

/** Two-way switch between the matchweek view and the results table. */
function ViewTabs() {
  return (
    <nav aria-label="Premier League views">
      <ul className="glass inline-flex rounded-full p-1">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `inline-flex h-10 items-center rounded-full px-5 font-wide text-[0.66rem] font-semibold tracking-[0.14em] uppercase transition-[background-color,color,box-shadow] duration-200 ${
                  isActive
                    ? 'bg-pitch text-black shadow-[0_0_0_1px_rgb(155_255_200/0.6),0_8px_28px_-8px_rgb(60_240_140/0.7)]'
                    : 'text-grey-200 hover:bg-glass-strong hover:text-white'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
