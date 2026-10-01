import { fixturePhase, type FixturePhase } from './matchweek'
import { forecastOf, forecastPercents, outcomeLabel, resultLabel } from './probability'
import type { Fixture, Outcome } from './types'

export interface ForecastView {
  /** Exact probabilities, 0–1: use for bar widths. */
  shares: Record<Outcome, number>
  /** Whole percentages summing to 100: use for labels. */
  percents: Record<Outcome, number>
  pick: Outcome
  /** "Arsenal to win". */
  pickLabel: string
  /** "1–0" (en dash), or null. */
  likeliestScore: string | null
  /** Expected goals, one decimal: ["1.8", "0.7"], or null. */
  expectedGoals: [string, string] | null
  /** Generated after the match, from pre-matchweek data only. */
  backtested: boolean
}

export interface ResultView {
  outcome: Outcome
  /** "Arsenal win" / "Draw". */
  label: string
  /** Whole-percent chance the forecast gave this result (matches `percents`). */
  percentGiven: number
  hit: boolean
}

export interface FixtureView {
  fixture: Fixture
  phase: FixturePhase
  /**
   * Goals to show, or null. Only for finished matches and live ones where the
   * feed supplies goals; a live match without goals shows no score.
   */
  score: [number, number] | null
  forecast: ForecastView | null
  /** Present when the match is finished and had a forecast. */
  result: ResultView | null
}

const xg = (n: number) => n.toFixed(1)

/** Every derived value a fixture card renders. */
export function fixtureView(fixture: Fixture): FixtureView {
  const phase = fixturePhase(fixture)
  const goals: [number, number] | null =
    fixture.home_goals !== null && fixture.away_goals !== null ? [fixture.home_goals, fixture.away_goals] : null
  const score = phase === 'finished' || phase === 'live' || phase === 'suspended' ? goals : null

  const shares = forecastOf(fixture)
  let forecast: ForecastView | null = null
  if (shares) {
    const percents = forecastPercents(shares)
    // The pick is the most likely outcome; fall back to the largest share if the column is missing.
    const pick: Outcome = fixture.pick ?? (['H', 'D', 'A'] as const).reduce((a, b) => (shares[b] > shares[a] ? b : a))
    forecast = {
      shares,
      percents,
      pick,
      pickLabel: outcomeLabel(fixture, pick),
      likeliestScore: fixture.modal_score ? fixture.modal_score.replace('-', '–') : null,
      expectedGoals:
        fixture.exp_home_goals !== null && fixture.exp_away_goals !== null
          ? [xg(fixture.exp_home_goals), xg(fixture.exp_away_goals)]
          : null,
      backtested: fixture.is_backfill === true,
    }
  }

  const result: ResultView | null =
    forecast && phase === 'finished' && fixture.actual
      ? {
          outcome: fixture.actual,
          label: resultLabel(fixture, fixture.actual),
          percentGiven: forecast.percents[fixture.actual],
          hit: fixture.hit ?? forecast.pick === fixture.actual,
        }
      : null

  return { fixture, phase, score, forecast, result }
}
