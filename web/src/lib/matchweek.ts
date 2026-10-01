import type { Fixture, FixtureStatus } from './types'

export const FIRST_MATCHWEEK = 1
export const LAST_MATCHWEEK = 38

/** Where a single fixture stands, collapsed from the feed's statuses. */
export type FixturePhase = 'scheduled' | 'live' | 'finished' | 'postponed' | 'suspended' | 'cancelled'

const PHASE: Record<FixtureStatus, FixturePhase> = {
  TIMED: 'scheduled',
  SCHEDULED: 'scheduled',
  IN_PLAY: 'live',
  PAUSED: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
}

export function fixturePhase(fixture: Pick<Fixture, 'status'>): FixturePhase {
  return PHASE[fixture.status]
}

/**
 * Where a matchweek stands:
 * - `upcoming`: nothing has kicked off yet.
 * - `in-progress`: something has finished or is live, and something is still to come.
 * - `played`: nothing left to play this week (postponed matches are played
 *   another week, so they do not hold the matchweek open), and at least one
 *   match finished.
 */
export type MatchweekStatus = 'upcoming' | 'in-progress' | 'played'

export function matchweekStatus(fixtures: readonly Pick<Fixture, 'status'>[]): MatchweekStatus {
  let started = false
  let pending = false
  for (const fixture of fixtures) {
    const phase = fixturePhase(fixture)
    if (phase === 'finished' || phase === 'live' || phase === 'suspended') started = true
    if (phase === 'scheduled' || phase === 'live' || phase === 'suspended') pending = true
  }
  if (!started) return 'upcoming'
  return pending ? 'in-progress' : 'played'
}

/**
 * Reads the `?mw=` search parameter. Accepts only a whole number within the
 * season (leading/trailing spaces allowed); anything else, including a
 * missing parameter, gives `fallback`.
 */
export function parseMatchweekParam(raw: string | null, fallback: number): number {
  if (raw === null) return fallback
  const text = raw.trim()
  if (!/^\d{1,2}$/.test(text)) return fallback
  const n = Number(text)
  return n >= FIRST_MATCHWEEK && n <= LAST_MATCHWEEK ? n : fallback
}

/** Clamps a matchweek number into the season. */
export function clampMatchweek(n: number): number {
  return Math.min(LAST_MATCHWEEK, Math.max(FIRST_MATCHWEEK, n))
}
