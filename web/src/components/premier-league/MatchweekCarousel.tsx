import { useEffect, useEffectEvent, useRef, ViewTransition, type ReactNode } from 'react'
import { FIRST_MATCHWEEK, LAST_MATCHWEEK } from '../../lib/matchweek'
import { MW_BACK, MW_FORWARD, useMatchweekNav } from '../../lib/matchweekNav'
import type { WeekSummary } from '../../lib/season'
import { useSwipe } from '../../lib/useSwipe'
import { HEADER_HEIGHT } from '../Header'
import { FixtureList } from './FixtureList'
import { ChevronLeftIcon, ChevronRightIcon, ReturnIcon } from './icons'
import { MatchweekTitle, WeekBreakdownPanel } from './MatchweekHeader'
import { MatchweekPicker } from './MatchweekPicker'
import './premierLeague.css'

/**
 * The selected matchweek: a control bar that sticks under the site header
 * while you read the fixtures (previous / strip of 1–38 / next), the week's
 * title and its predicted-versus-actual breakdown, then the fixtures. Left
 * and right arrow keys work anywhere inside the region; touch swipes work
 * over the fixtures.
 */
export function MatchweekCarousel({ weeks }: { weeks: readonly WeekSummary[] }) {
  const { selected, current, step } = useMatchweekNav()
  const week = weeks[selected - FIRST_MATCHWEEK]
  const swipe = useSwipe((direction) => step(direction === 'left' ? 1 : -1))

  const region = useRef<HTMLElement>(null)
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    step(event.key === 'ArrowRight' ? 1 : -1)
  })
  // Arrow keys work wherever focus is inside the region (a native listener: the section itself is not interactive).
  useEffect(() => {
    const el = region.current
    if (!el) return
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <section
      id="matchweek"
      aria-labelledby="matchweek-heading"
      aria-roledescription="carousel"
      ref={region}
      className="mt-20 md:mt-28"
      style={{ scrollMarginTop: HEADER_HEIGHT + 8 }}
    >
      <ControlBar weeks={weeks} />

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,46rem)] lg:items-end lg:gap-10">
        <div className="relative min-w-0">
          <Slide matchweek={selected}>
            <div className="min-w-0">
              <MatchweekTitle week={week} isCurrent={selected === current} />
            </div>
          </Slide>
          {/* Floats at the end of the eyebrow row (which is short whenever this shows), so it never moves the layout. */}
          <div className="absolute top-[-0.55rem] right-0">
            <BackToThisWeek />
          </div>
        </div>
        <Slide matchweek={selected}>
          <div className="min-w-0">
            <WeekBreakdownPanel week={week} />
          </div>
        </Slide>
      </div>

      <div {...swipe} className="mt-12 touch-pan-y">
        <Slide matchweek={selected}>
          <div>
            <FixtureList fixtures={week.fixtures} />
          </div>
        </Slide>
      </div>
      <p className="sr-only" aria-live="polite">
        {`Showing matchweek ${selected}${selected === current ? ', this week' : ''}`}
      </p>
    </section>
  )
}

/** Re-enters its content whenever the matchweek changes, sliding in the direction of travel. */
function Slide({ matchweek, children }: { matchweek: number; children: ReactNode }) {
  return (
    <ViewTransition
      key={matchweek}
      default="none"
      enter={{ [MW_FORWARD]: 'mw-from-right', [MW_BACK]: 'mw-from-left', default: 'none' }}
      exit={{ [MW_FORWARD]: 'mw-to-left', [MW_BACK]: 'mw-to-right', default: 'none' }}
    >
      {children}
    </ViewTransition>
  )
}

/** Previous / strip / next, on glass, stuck just under the site header. */
function ControlBar({ weeks }: { weeks: readonly WeekSummary[] }) {
  const { selected, step } = useMatchweekNav()
  return (
    <div className="sticky z-30 -mx-1 sm:-mx-2" style={{ top: HEADER_HEIGHT }}>
      <nav
        aria-label="Matchweeks"
        className="glass flex items-center gap-1 rounded-2xl bg-black/70! p-1.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9),inset_0_1px_0_0_rgb(255_255_255/0.07)]!"
      >
        <ArrowButton label="Previous matchweek" disabled={selected <= FIRST_MATCHWEEK} onClick={() => step(-1)}>
          <ChevronLeftIcon className="size-4" strokeWidth={2} />
        </ArrowButton>
        <MatchweekPicker weeks={weeks} />
        <ArrowButton label="Next matchweek" disabled={selected >= LAST_MATCHWEEK} onClick={() => step(1)}>
          <ChevronRightIcon className="size-4" strokeWidth={2} />
        </ArrowButton>
      </nav>
    </div>
  )
}

function BackToThisWeek() {
  const { selected, current, go } = useMatchweekNav()
  const away = selected !== current
  return (
    <button
      type="button"
      onClick={() => go(current)}
      // Kept in the layout when hidden so nothing shifts.
      aria-hidden={away ? undefined : true}
      tabIndex={away ? undefined : -1}
      className={`glass inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 font-wide text-[0.62rem] font-semibold tracking-[0.14em] whitespace-nowrap uppercase transition-[opacity,scale,border-color,color] duration-300 ease-out-expo hover:border-pitch/50 hover:text-pitch active:scale-95 ${away ? 'opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
    >
      <ReturnIcon className="size-3.5" />
      Back to this week
    </button>
  )
}

interface ArrowButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function ArrowButton({ label, disabled, onClick, children }: ArrowButtonProps) {
  // aria-disabled rather than disabled: a focused button that hits the end of
  // the season keeps focus, so arrow keys keep working inside the carousel.
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-hairline-strong bg-glass text-white transition-[background-color,border-color,color,scale,opacity] duration-200 ${
        disabled ? 'cursor-default opacity-30' : 'hover:border-pitch/60 hover:bg-pitch-dim hover:text-pitch active:scale-90'
      }`}
    >
      {children}
    </button>
  )
}
