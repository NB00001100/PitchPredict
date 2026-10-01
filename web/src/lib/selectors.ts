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

const DAY = 24 * 60 * 60 * 1000
/** A round's kickoffs fall within this span of its first one. */
const ROUND_SPAN = 7 * DAY
/** How far back a finished kickoff still marks its matchweek as in progress. */
const IN_PROGRESS_SPAN = 4 * DAY
/** A scheduled kickoff this far in the past without a result is stale data, not a live anchor. */
const STALE_AFTER = 3 * DAY

/**
 * Whether a fixture can anchor the current matchweek: not finished, not
 * cancelled, not postponed (a postponed fixture keeps its old date until the
 * feed gives it a new one, at which point its status changes back), and not
 * a scheduled kickoff left days in the past by a stale feed.
 */
function isPending(f: Fixture, now: number): boolean {
  if (DONE.has(f.status) || f.status === 'POSTPONED') return false
  if (f.status === 'IN_PLAY' || f.status === 'PAUSED') return true
  const t = Date.parse(f.kickoff)
  return Number.isNaN(t) || t >= now - STALE_AFTER
}

/**
 * The matchweek being played or coming up next, following the data rather
 * than the calendar's matchweek numbers, so a single leftover fixture can't
 * hold it back:
 *
 * 1. A matchweek in progress (a fixture finished within the last 4 days and
 *    another still pending within the next 4) wins; several: the one with most
 *    pending fixtures, ties to the lower number.
 * 2. Otherwise, take the soonest pending kickoff; the current matchweek is
 *    the one with the most pending fixtures kicking off within 7 days of it
 *    (ties to the lower number). A rescheduled game from an old matchweek
 *    played midweek therefore doesn't outvote the full round that follows.
 * 3. With nothing pending, the last matchweek. Null with no fixtures.
 *
 * `now` is a parameter for tests; it defaults to the current time.
 */
export function currentMatchweek(fixtures: readonly Fixture[], now: number = Date.now()): number | null {
  if (fixtures.length === 0) return null
  const pending = fixtures.filter((f) => isPending(f, now))
  if (pending.length === 0) return Math.max(...fixtures.map((f) => f.matchweek))

  const recentlyFinished = new Set(
    fixtures
      .filter((f) => f.status === 'FINISHED' && Date.parse(f.kickoff) >= now - IN_PROGRESS_SPAN && Date.parse(f.kickoff) <= now)
      .map((f) => f.matchweek),
  )
  // Only its own near-term fixtures keep a matchweek in progress, not one rescheduled weeks ahead.
  const inProgress = pending.filter(
    (f) => recentlyFinished.has(f.matchweek) && !(Date.parse(f.kickoff) > now + IN_PROGRESS_SPAN),
  )
  if (inProgress.length) return mostCommonMatchweek(inProgress)

  const soonest = Math.min(...pending.map((f) => Date.parse(f.kickoff)).filter((t) => !Number.isNaN(t)))
  const round = Number.isFinite(soonest)
    ? pending.filter((f) => {
        const t = Date.parse(f.kickoff)
        return t >= soonest && t < soonest + ROUND_SPAN
      })
    : pending
  return mostCommonMatchweek(round.length ? round : pending)
}

/** The matchweek with the most fixtures in the list; ties to the lower number. */
function mostCommonMatchweek(list: readonly Fixture[]): number {
  const counts = new Map<number, number>()
  for (const f of list) counts.set(f.matchweek, (counts.get(f.matchweek) ?? 0) + 1)
  let best = list[0].matchweek
  for (const [mw, n] of counts) {
    const bestN = counts.get(best) ?? 0
    if (n > bestN || (n === bestN && mw < best)) best = mw
  }
  return best
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
