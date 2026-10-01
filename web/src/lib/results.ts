import { fixturePhase } from './matchweek'
import { forecastOf, forecastPercents, type Forecast } from './probability'
import type { Fixture, Outcome } from './types'
import { actualOutcome } from './weekBreakdown'

/*
 * Everything the Results view derives: one row per finished fixture that
 * had a forecast, plus filters and a summary computed from whatever rows are
 * on screen.
 */

/** The call, labelled from the home side's point of view. */
export const CALL_WORD: Record<Outcome, string> = { H: 'Home', D: 'Draw', A: 'Away' }
/** What happened, in words. */
export const RESULT_WORD: Record<Outcome, string> = { H: 'Home win', D: 'Draw', A: 'Away win' }

/**
 * The model's call: the most likely outcome. Ties go home, then away, then
 * draw, matching the `pick` column the database computes.
 */
export function callOf(p: Forecast): Outcome {
  let best: Outcome = 'H'
  for (const o of ['A', 'D'] as const) if (p[o] > p[best]) best = o
  return best
}

/** How close to the top a draw has to be to count as a lean, in probability. */
export const LEAN_DRAW_MARGIN = 0.05
/** A draw this likely is a lean whatever the top outcome. */
export const LEAN_DRAW_FLOOR = 0.3

/**
 * True when the call isn't a draw but a draw was close: P(draw) within 0.05
 * of the top probability, or above 0.30. Makes near-draws visible even though
 * the single call almost never lands on one.
 */
export function leanDraw(p: Forecast): boolean {
  if (callOf(p) === 'D') return false
  const top = Math.max(p.H, p.D, p.A)
  return top - p.D <= LEAN_DRAW_MARGIN + 1e-12 || p.D > LEAN_DRAW_FLOOR
}

/**
 * Ranked probability score of one forecast, outcomes ordered home, draw,
 * away: half the sum of squared differences between the cumulative forecast
 * and the cumulative one-hot result over the first two categories. 0 is a
 * perfect forecast; lower is better.
 */
export function rps(p: Forecast, actual: Outcome): number {
  const o = { H: actual === 'H' ? 1 : 0, D: actual === 'D' ? 1 : 0 }
  const c1 = p.H - o.H
  const c2 = p.H + p.D - (o.H + o.D)
  return 0.5 * (c1 * c1 + c2 * c2)
}

/** "1-0" or "1–0" → [1, 0]; null when missing or malformed. */
export function parseScoreline(text: string | null): [number, number] | null {
  if (!text) return null
  const m = /^\s*(\d+)\s*[-–]\s*(\d+)\s*$/.exec(text)
  return m ? [Number(m[1]), Number(m[2])] : null
}

export interface ResultRow {
  fixture: Fixture
  matchweek: number
  /** Exact probabilities (bar widths). */
  shares: Forecast
  /** Whole percentages summing to 100 (labels). */
  percents: Record<Outcome, number>
  call: Outcome
  leanDraw: boolean
  actual: Outcome
  correct: boolean
  /** The model's likeliest scoreline, or null. */
  modalScore: [number, number] | null
  score: [number, number]
  exactScore: boolean
  rps: number
}

/**
 * Rows for every finished fixture that had a forecast and a final score,
 * newest matchweek first, kickoff order within a matchweek.
 */
export function resultRows(fixtures: readonly Fixture[]): ResultRow[] {
  const rows: ResultRow[] = []
  for (const fixture of fixtures) {
    if (fixturePhase(fixture) !== 'finished') continue
    const shares = forecastOf(fixture)
    const actual = actualOutcome(fixture)
    if (!shares || !actual || fixture.home_goals === null || fixture.away_goals === null) continue
    const call = callOf(shares)
    const score: [number, number] = [fixture.home_goals, fixture.away_goals]
    const modalScore = parseScoreline(fixture.modal_score)
    rows.push({
      fixture,
      matchweek: fixture.matchweek,
      shares,
      percents: forecastPercents(shares),
      call,
      leanDraw: leanDraw(shares),
      actual,
      correct: call === actual,
      modalScore,
      score,
      exactScore: modalScore !== null && modalScore[0] === score[0] && modalScore[1] === score[1],
      rps: rps(shares, actual),
    })
  }
  return rows.sort(
    (a, b) =>
      b.matchweek - a.matchweek ||
      Date.parse(a.fixture.kickoff) - Date.parse(b.fixture.kickoff) ||
      a.fixture.fixture_id - b.fixture.fixture_id,
  )
}

export type OutcomeFilter = 'all' | 'correct' | 'incorrect'

export interface ResultsFilter {
  /** Null for every matchweek. */
  matchweek: number | null
  outcome: OutcomeFilter
}

export function filterRows(rows: readonly ResultRow[], { matchweek, outcome }: ResultsFilter): ResultRow[] {
  return rows.filter(
    (r) =>
      (matchweek === null || r.matchweek === matchweek) &&
      (outcome === 'all' || (outcome === 'correct' ? r.correct : !r.correct)),
  )
}

/** Matchweeks that have result rows, newest first. */
export function resultMatchweeks(rows: readonly ResultRow[]): number[] {
  return [...new Set(rows.map((r) => r.matchweek))].sort((a, b) => b - a)
}

export interface Tally {
  hits: number
  n: number
  /** 0–100, or null when n is 0. */
  pct: number | null
}

export interface ResultsSummary extends Tally {
  /** Hit rate split by what actually happened. */
  byActual: Record<Outcome, Tally>
  /** Mean RPS over the rows, or null with none. */
  meanRps: number | null
  exactScores: number
}

const tally = (hits: number, n: number): Tally => ({ hits, n, pct: n ? (hits / n) * 100 : null })

export function summariseResults(rows: readonly ResultRow[]): ResultsSummary {
  const counts = { H: [0, 0], D: [0, 0], A: [0, 0] } as Record<Outcome, [number, number]>
  let hits = 0
  let rpsSum = 0
  let exactScores = 0
  for (const r of rows) {
    counts[r.actual][1] += 1
    if (r.correct) {
      hits += 1
      counts[r.actual][0] += 1
    }
    rpsSum += r.rps
    if (r.exactScore) exactScores += 1
  }
  return {
    ...tally(hits, rows.length),
    byActual: { H: tally(...counts.H), D: tally(...counts.D), A: tally(...counts.A) },
    meanRps: rows.length ? rpsSum / rows.length : null,
    exactScores,
  }
}

/** Below this many matches, the summary says its figures are noisy. */
export const SMALL_SAMPLE = 100

/** The latest matchweek with a finished match, or null before any. */
export function resultsThrough(fixtures: readonly Fixture[]): number | null {
  let latest: number | null = null
  for (const f of fixtures) if (fixturePhase(f) === 'finished' && (latest === null || f.matchweek > latest)) latest = f.matchweek
  return latest
}

/** Reads `?show=`: anything but "correct" or "incorrect" is "all". */
export function parseOutcomeFilter(raw: string | null): OutcomeFilter {
  return raw === 'correct' || raw === 'incorrect' ? raw : 'all'
}
