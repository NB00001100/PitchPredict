import { FIRST_MATCHWEEK, LAST_MATCHWEEK, matchweekStatus, type MatchweekStatus } from './matchweek'
import { byMatchweek, currentMatchweek, hitRate, type HitRate } from './selectors'
import type { Fixture } from './types'

export interface WeekSummary {
  matchweek: number
  fixtures: Fixture[]
  status: MatchweekStatus
  /** Hits among this week's graded fixtures. */
  rate: HitRate
  /** How many fixtures carry a forecast. */
  forecasts: number
}

export interface SeasonSummary {
  /** Every matchweek 1–38, in order, even ones with no fixtures loaded. */
  weeks: WeekSummary[]
  current: number
  /** Every matchweek played (nothing left to play): the season is over. */
  complete: boolean
  rate: HitRate
  /** Graded misses that ended in a draw (the pick is almost never a draw, so most drawn matches are misses). */
  drawnMisses: number
}

/*
 * The view keeps every season's rows (old seasons are never deleted), but the
 * site shows one: the latest season present in the data. Season ids are
 * "YYYY-YYYY", so the latest is the one with the greatest starting year.
 */

/** Starting year of a "2026-2027" (or "2026/27") season id; NaN when malformed. */
function startYear(season: string): number {
  const m = /^\s*(\d{4})/.exec(season)
  return m ? Number(m[1]) : Number.NaN
}

/** The latest season id among `seasons`, or null with none. Malformed ids lose to well-formed ones. */
export function latestSeason(seasons: Iterable<string>): string | null {
  let best: string | null = null
  for (const s of seasons) {
    if (!s) continue
    if (best === null) {
      best = s
      continue
    }
    const a = startYear(s)
    const b = startYear(best)
    if ((Number.isNaN(b) && !Number.isNaN(a)) || a > b || (a === b && s > best)) best = s
  }
  return best
}

/** Only the fixtures of the latest season in the list (the same array when there is just one season). */
export function onlyLatestSeason<T extends Pick<Fixture, 'season'>>(fixtures: readonly T[]): readonly T[] {
  const latest = latestSeason(new Set(fixtures.map((f) => f.season)))
  if (latest === null || fixtures.every((f) => f.season === latest)) return fixtures
  return fixtures.filter((f) => f.season === latest)
}

/** "2026-2027" → "2026/27". Anything it can't read is returned as is. */
export function formatSeason(season: string): string {
  const m = /^\s*(\d{4})\s*[-/–]\s*(\d{2}|\d{4})\s*$/.exec(season)
  return m ? `${m[1]}/${m[2].slice(-2)}` : season
}

/** "2026/27 season" for the season the fixtures belong to, or null with none loaded. */
export function seasonLabel(fixtures: readonly Pick<Fixture, 'season'>[]): string | null {
  const latest = latestSeason(fixtures.map((f) => f.season))
  return latest ? `${formatSeason(latest)} season` : null
}

/** "Forecasts · 2026/27 season", with the season read from the data ("Forecasts" alone before it loads). */
export function withSeason(text: string, fixtures: readonly Pick<Fixture, 'season'>[]): string {
  const label = seasonLabel(fixtures)
  return label ? `${text} · ${label}` : text
}

/** Everything the page shows, derived once from the season's fixtures. */
export function summariseSeason(fixtures: readonly Fixture[]): SeasonSummary {
  const groups = new Map(byMatchweek(fixtures).map((g) => [g.matchweek, g.fixtures]))
  const weeks: WeekSummary[] = []
  for (let mw = FIRST_MATCHWEEK; mw <= LAST_MATCHWEEK; mw += 1) {
    const list = groups.get(mw) ?? []
    weeks.push({
      matchweek: mw,
      fixtures: list,
      status: matchweekStatus(list),
      rate: hitRate(list),
      forecasts: list.filter((f) => f.p_home !== null).length,
    })
  }
  let drawnMisses = 0
  for (const f of fixtures) if (f.hit === false && f.actual === 'D') drawnMisses += 1
  return {
    weeks,
    current: currentMatchweek(fixtures) ?? FIRST_MATCHWEEK,
    complete: fixtures.length > 0 && weeks.every((w) => w.fixtures.length === 0 || w.status === 'played'),
    rate: hitRate(fixtures),
    drawnMisses,
  }
}
