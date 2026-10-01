import { motion } from 'motion/react'
import { formatDayHeading, groupByKickoffDay } from '../../lib/dates'
import { EASE_OUT_EXPO } from '../../lib/motion'
import type { Fixture } from '../../lib/types'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { FixtureCard } from './FixtureCard'

/** Seconds between cards in the entrance; the whole week lands in well under a second. */
const STEP = 0.04
const MAX_DELAY = 0.45

/**
 * A matchweek's fixtures, grouped under headings by kickoff day in the
 * viewer's time zone. Cards rise in quickly, in kickoff order, on first load
 * and again whenever the matchweek changes (the list remounts per week).
 */
export function FixtureList({ fixtures }: { fixtures: readonly Fixture[] }) {
  const reduced = usePrefersReducedMotion()
  const days = groupByKickoffDay(fixtures)
  if (days.length === 0) {
    return <p className="type-label py-10 text-center text-grey-400">No fixtures for this matchweek yet.</p>
  }
  let index = 0
  return (
    <div className="flex flex-col gap-10">
      {days.map((day) => (
        <section key={day.key} aria-labelledby={`day-${day.key}`}>
          <h3 id={`day-${day.key}`} className="flex items-center gap-4">
            <span className="type-eyebrow text-white">{formatDayHeading(day.date)}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-hairline-strong to-transparent" />
            <span className="type-label text-[0.68rem] text-grey-400">
              {day.fixtures.length} {day.fixtures.length === 1 ? 'match' : 'matches'}
            </span>
          </h3>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            {day.fixtures.map((f) => {
              const delay = Math.min(index++ * STEP, MAX_DELAY)
              return (
                <motion.li
                  key={f.fixture_id}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay }}
                >
                  <FixtureCard fixture={f} delay={Math.round(delay * 1000) + 120} />
                </motion.li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
