import { fixturePhase } from './matchweek'
import { forecastOf } from './probability'
import type { Fixture, Outcome } from './types'

export type OutcomeCounts = Record<Outcome, number>

/**
 * What actually happened in a finished match, from the feed's `actual`
 * column or, failing that, the final score. Null unless the match is
 * finished with a known result. Independent of whether there was a forecast.
 */
export function actualOutcome(fixture: Fixture): Outcome | null {
  if (fixturePhase(fixture) !== 'finished') return null
  if (fixture.actual) return fixture.actual
  const { home_goals: h, away_goals: a } = fixture
  if (h === null || a === null) return null
  return h > a ? 'H' : h < a ? 'A' : 'D'
}

/** The model's pick for a fixture: the `pick` column, else its largest share. Null without a forecast. */
export function pickOf(fixture: Fixture): Outcome | null {
  const shares = forecastOf(fixture)
  if (!shares) return null
  return fixture.pick ?? (['H', 'D', 'A'] as const).reduce((a, b) => (shares[b] > shares[a] ? b : a))
}

export interface WeekBreakdownRow {
  fixtureId: number
  pick: Outcome | null
  actual: Outcome | null
  /** True or false once both a pick and a result exist; null before. */
  hit: boolean | null
}

export interface WeekBreakdown {
  /** What we predicted: picks by outcome, over fixtures with a forecast. */
  picks: OutcomeCounts
  /** What happened: results by outcome, over finished fixtures. */
  results: OutcomeCounts
  /** Fixtures carrying a forecast. */
  forecasts: number
  /** Finished fixtures with a known result. */
  finished: number
  /** One row per fixture, in kickoff order (ties by fixture id). */
  rows: WeekBreakdownRow[]
}

const zero = (): OutcomeCounts => ({ H: 0, D: 0, A: 0 })

/**
 * A matchweek split into its two halves, kept apart on purpose: what the
 * model predicted (its picks) and what actually happened (the results).
 * Rows line the two up fixture by fixture for a side-by-side strip.
 */
export function weekBreakdown(fixtures: readonly Fixture[]): WeekBreakdown {
  const picks = zero()
  const results = zero()
  let forecasts = 0
  let finished = 0
  const rows = fixtures
    .toSorted((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.fixture_id - b.fixture_id)
    .map((fixture): WeekBreakdownRow => {
      const pick = pickOf(fixture)
      const actual = actualOutcome(fixture)
      if (pick) {
        picks[pick] += 1
        forecasts += 1
      }
      if (actual) {
        results[actual] += 1
        finished += 1
      }
      const hit = pick && actual ? (fixture.hit ?? pick === actual) : null
      return { fixtureId: fixture.fixture_id, pick, actual, hit }
    })
  return { picks, results, forecasts, finished, rows }
}

/**
 * "6 home · 4 away" style phrases for a set of counts, skipping zeros
 * (except when everything is zero). `nouns` names each outcome.
 */
export function describeCounts(counts: OutcomeCounts, nouns: Record<Outcome, readonly [string, string]>): string {
  const parts = (['H', 'D', 'A'] as const)
    .filter((o) => counts[o] > 0)
    .map((o) => `${counts[o]} ${counts[o] === 1 ? nouns[o][0] : nouns[o][1]}`)
  return parts.length ? parts.join(', ') : 'none'
}
