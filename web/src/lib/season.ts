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
  rate: HitRate
  /** Graded fixtures that ended in a draw (always a miss: the model never picks one). */
  drawnMisses: number
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
    rate: hitRate(fixtures),
    drawnMisses,
  }
}
