/** Fixture status as reported by football-data.org. */
export type FixtureStatus =
  | 'FINISHED'
  | 'TIMED'
  | 'SCHEDULED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED'

/** A match outcome from the home side's point of view. */
export type Outcome = 'H' | 'D' | 'A'

/**
 * One row of the `matchweek_predictions` view: a fixture, its result (if
 * played) and the model's forecast for it (if one exists). Field names match
 * the view's columns exactly.
 */
export interface Fixture {
  fixture_id: number
  season: string
  matchweek: number
  /** ISO 8601 timestamp, UTC. */
  kickoff: string
  status: FixtureStatus
  home_team: string
  away_team: string
  /** Three-letter team code, e.g. "ARS". */
  home_tla: string
  away_tla: string
  /** Null until the match is finished. */
  home_goals: number | null
  away_goals: number | null
  /** Outcome probabilities, 0–1. Null when there is no forecast yet. */
  p_home: number | null
  p_draw: number | null
  p_away: number | null
  exp_home_goals: number | null
  exp_away_goals: number | null
  /** Single most likely scoreline, e.g. "1-1". */
  modal_score: string | null
  model_version: string | null
  /** ISO 8601 timestamp of when the forecast was made. */
  predicted_at: string | null
  /**
   * True when the forecast was generated after the fact for an already-played
   * matchweek ("backtested"), using only data from before that matchweek.
   * Null when there is no forecast.
   */
  is_backfill: boolean | null
  /** The model's most likely outcome. */
  pick: Outcome | null
  /** What actually happened. */
  actual: Outcome | null
  /** Whether `pick` matched `actual`. Null until there is both a forecast and a result. */
  hit: boolean | null
}

/** Raw row as PostgREST returns it. Numeric columns may arrive as strings. */
export type FixtureRow = Record<string, unknown>

const STATUSES: ReadonlySet<string> = new Set<FixtureStatus>([
  'FINISHED',
  'TIMED',
  'SCHEDULED',
  'IN_PLAY',
  'PAUSED',
  'POSTPONED',
  'SUSPENDED',
  'CANCELLED',
])

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function outcome(value: unknown): Outcome | null {
  return value === 'H' || value === 'D' || value === 'A' ? value : null
}

/** Coerces a raw view row into a `Fixture`, tolerating strings for numbers. */
export function toFixture(row: FixtureRow): Fixture {
  const status = String(row.status ?? '')
  return {
    fixture_id: num(row.fixture_id) ?? 0,
    season: String(row.season ?? ''),
    matchweek: num(row.matchweek) ?? 0,
    kickoff: String(row.kickoff ?? ''),
    status: (STATUSES.has(status) ? status : 'SCHEDULED') as FixtureStatus,
    home_team: String(row.home_team ?? ''),
    away_team: String(row.away_team ?? ''),
    home_tla: String(row.home_tla ?? ''),
    away_tla: String(row.away_tla ?? ''),
    home_goals: num(row.home_goals),
    away_goals: num(row.away_goals),
    p_home: num(row.p_home),
    p_draw: num(row.p_draw),
    p_away: num(row.p_away),
    exp_home_goals: num(row.exp_home_goals),
    exp_away_goals: num(row.exp_away_goals),
    modal_score: str(row.modal_score),
    model_version: str(row.model_version),
    predicted_at: str(row.predicted_at),
    is_backfill: bool(row.is_backfill),
    pick: outcome(row.pick),
    actual: outcome(row.actual),
    hit: bool(row.hit),
  }
}
