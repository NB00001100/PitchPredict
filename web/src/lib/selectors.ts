import type { Fixture } from './types'

export interface MatchweekGroup {
  matchweek: number
  /** Fixtures of the matchweek, in kickoff order. */
  fixtures: Fixture[]
}

export interface HitRate {
  /** Graded fixtures where the pick matched the result. */
  hits: number
  /** Fixtures with both a forecast and a result (`hit` is not null). */
  total: number
  /** hits / total as a percentage, 0–100, unrounded. Null when total is 0. */
  pct: number | null
}

export interface MatchweekHitRate extends HitRate {
  matchweek: number
}

/** Statuses after which a fixture will not be played (again) this week. */
const DONE = new Set<Fixture['status']>(['FINISHED', 'CANCELLED'])

function byKickoff(a: Fixture, b: Fixture): number {
  return a.kickoff < b.kickoff ? -1 : a.kickoff > b.kickoff ? 1 : a.fixture_id - b.fixture_id
}

/** Groups fixtures into matchweeks, ascending; fixtures within each in kickoff order. */
export function byMatchweek(fixtures: readonly Fixture[]): MatchweekGroup[] {
  const groups = new Map<number, Fixture[]>()
  for (const fixture of fixtures) {
    const group = groups.get(fixture.matchweek)
    if (group) group.push(fixture)
    else groups.set(fixture.matchweek, [fixture])
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([matchweek, list]) => ({ matchweek, fixtures: list.sort(byKickoff) }))
}

/**
 * The matchweek being played or coming up next: the lowest matchweek with a
 * fixture that is neither finished nor cancelled. When every fixture is done,
 * the last matchweek. Null when there are no fixtures.
 */
export function currentMatchweek(fixtures: readonly Fixture[]): number | null {
  let open: number | null = null
  let last: number | null = null
  for (const { matchweek, status } of fixtures) {
    if (last === null || matchweek > last) last = matchweek
    if (!DONE.has(status) && (open === null || matchweek < open)) open = matchweek
  }
  return open ?? last
}

/** Share of graded fixtures (where `hit` is not null) the model called right. */
export function hitRate(fixtures: readonly Fixture[]): HitRate {
  let hits = 0
  let total = 0
  for (const { hit } of fixtures) {
    if (hit === null) continue
    total += 1
    if (hit) hits += 1
  }
  return { hits, total, pct: total ? (hits / total) * 100 : null }
}

/** `hitRate` per matchweek, ascending, only for matchweeks with at least one graded fixture. */
export function hitRateByMatchweek(fixtures: readonly Fixture[]): MatchweekHitRate[] {
  return byMatchweek(fixtures)
    .map(({ matchweek, fixtures: list }) => ({ matchweek, ...hitRate(list) }))
    .filter((rate) => rate.total > 0)
}
