import type { Fixture, Outcome } from './types'

export const OUTCOMES: readonly Outcome[] = ['H', 'D', 'A']

/** A fixture's three outcome probabilities (0–1), or null without a forecast. */
export type Forecast = Record<Outcome, number>

export function forecastOf(fixture: Fixture): Forecast | null {
  const { p_home, p_draw, p_away } = fixture
  if (p_home === null || p_draw === null || p_away === null) return null
  return { H: p_home, D: p_draw, A: p_away }
}

/**
 * Rounds shares to whole percentages that add up to exactly 100, using the
 * largest-remainder method: floor everything, then hand the leftover points to
 * the shares with the biggest fractional parts (ties go to the earlier share).
 * Inputs are 0–1 and are normalised first, so they need not sum to exactly 1.
 */
export function roundPercents(shares: readonly number[]): number[] {
  const total = shares.reduce((sum, s) => sum + Math.max(0, s), 0)
  if (total <= 0) return shares.map(() => 0)
  const exact = shares.map((s) => (Math.max(0, s) / total) * 100)
  const floored = exact.map(Math.floor)
  let leftover = 100 - floored.reduce((sum, n) => sum + n, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of order) {
    if (leftover <= 0) break
    floored[index] += 1
    leftover -= 1
  }
  return floored
}

/** A forecast as whole percentages per outcome, summing to 100. */
export function forecastPercents(forecast: Forecast): Record<Outcome, number> {
  const [H, D, A] = roundPercents(OUTCOMES.map((o) => forecast[o]))
  return { H, D, A }
}

/**
 * The whole-percent probability the model gave to what actually happened,
 * consistent with the rounded figures shown on the bar. Null without both a
 * forecast and a result.
 */
export function percentGivenToActual(fixture: Fixture): number | null {
  const forecast = forecastOf(fixture)
  if (!forecast || !fixture.actual) return null
  return forecastPercents(forecast)[fixture.actual]
}

/** "Arsenal to win" / "Draw" for an outcome of this fixture. */
export function outcomeLabel(fixture: Pick<Fixture, 'home_team' | 'away_team'>, outcome: Outcome): string {
  if (outcome === 'D') return 'Draw'
  return `${outcome === 'H' ? fixture.home_team : fixture.away_team} to win`
}

/** "Arsenal win" / "Draw": the past-tense-neutral name of a result. */
export function resultLabel(fixture: Pick<Fixture, 'home_team' | 'away_team'>, outcome: Outcome): string {
  if (outcome === 'D') return 'Draw'
  return `${outcome === 'H' ? fixture.home_team : fixture.away_team} win`
}

export interface BarSegment {
  outcome: Outcome
  /** Left edge and width, in % of the bar. */
  start: number
  width: number
}

/** Home, draw, away laid end to end as percentages of a bar's width. */
export function barSegments(shares: Forecast): BarSegment[] {
  const total = OUTCOMES.reduce((sum, o) => sum + shares[o], 0) || 1
  return OUTCOMES.map((outcome, i) => ({
    outcome,
    start: (OUTCOMES.slice(0, i).reduce((sum, o) => sum + shares[o], 0) / total) * 100,
    width: (shares[outcome] / total) * 100,
  }))
}
