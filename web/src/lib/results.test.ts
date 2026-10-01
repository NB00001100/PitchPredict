import { describe, expect, it } from 'vitest'
import {
  callOf,
  filterRows,
  leanDraw,
  parseOutcomeFilter,
  parseScoreline,
  resultMatchweeks,
  resultRows,
  resultsThrough,
  rps,
  summariseResults,
} from './results'
import { formatUpdated } from './relativeTime'
import { toFixture, type Fixture } from './types'

let id = 0
function fx(overrides: Partial<Fixture>): Fixture {
  id += 1
  return {
    ...toFixture({ fixture_id: id, season: '2026-2027', home_team: 'Arsenal', away_team: 'Leeds United' }),
    status: 'FINISHED',
    matchweek: 1,
    kickoff: '2026-08-15T14:00:00+00:00',
    ...overrides,
  }
}

const p = (H: number, D: number, A: number) => ({ H, D, A })

describe('rps', () => {
  it('matches hand-checked values for p = (0.5, 0.3, 0.2)', () => {
    expect(rps(p(0.5, 0.3, 0.2), 'H')).toBeCloseTo(0.145, 10)
    expect(rps(p(0.5, 0.3, 0.2), 'D')).toBeCloseTo(0.145, 10)
    expect(rps(p(0.5, 0.3, 0.2), 'A')).toBeCloseTo(0.445, 10)
  })
  it('is 0 for a certain, correct forecast and 1 for the worst miss', () => {
    expect(rps(p(1, 0, 0), 'H')).toBe(0)
    expect(rps(p(1, 0, 0), 'A')).toBe(1)
  })
})

describe('callOf', () => {
  it('is the most likely outcome', () => {
    expect(callOf(p(0.2, 0.5, 0.3))).toBe('D')
    expect(callOf(p(0.2, 0.3, 0.5))).toBe('A')
  })
  it('breaks ties home, then away, then draw', () => {
    expect(callOf(p(0.4, 0.2, 0.4))).toBe('H')
    expect(callOf(p(0.2, 0.4, 0.4))).toBe('A')
    expect(callOf(p(0.4, 0.4, 0.2))).toBe('H')
  })
})

describe('leanDraw', () => {
  it('flags a draw within 0.05 of the top', () => {
    expect(leanDraw(p(0.32, 0.28, 0.4))).toBe(false) // 0.12 behind, under 0.30
    expect(leanDraw(p(0.37, 0.28, 0.35))).toBe(false) // 0.09 behind
    expect(leanDraw(p(0.42, 0.29, 0.29))).toBe(false)
    expect(leanDraw(p(0.34, 0.29, 0.37))).toBe(false) // 0.08 behind
    expect(leanDraw(p(0.35, 0.3, 0.35))).toBe(true) // exactly 0.05 behind
    expect(leanDraw(p(0.36, 0.33, 0.31))).toBe(true)
  })
  it('flags any draw above 0.30', () => {
    expect(leanDraw(p(0.55, 0.31, 0.14))).toBe(true)
  })
  it('is never set when the call itself is a draw', () => {
    expect(leanDraw(p(0.3, 0.4, 0.3))).toBe(false)
  })
})

describe('parseScoreline', () => {
  it('reads hyphen and en dash, rejects junk', () => {
    expect(parseScoreline('1-0')).toEqual([1, 0])
    expect(parseScoreline('2–2')).toEqual([2, 2])
    expect(parseScoreline('x')).toBeNull()
    expect(parseScoreline(null)).toBeNull()
  })
})

describe('resultRows', () => {
  const homeWin = fx({ matchweek: 1, p_home: 0.5, p_draw: 0.3, p_away: 0.2, home_goals: 1, away_goals: 0, modal_score: '1-0', kickoff: '2026-08-16T14:00:00Z' })
  const draw = fx({ matchweek: 2, p_home: 0.5, p_draw: 0.3, p_away: 0.2, home_goals: 1, away_goals: 1, modal_score: '1-0', actual: 'D' })
  const awayWin = fx({ matchweek: 1, p_home: 0.5, p_draw: 0.3, p_away: 0.2, home_goals: 0, away_goals: 2, kickoff: '2026-08-15T14:00:00Z' })
  const noForecast = fx({ matchweek: 2, home_goals: 3, away_goals: 0 })
  const upcoming = fx({ matchweek: 3, status: 'TIMED', p_home: 0.5, p_draw: 0.3, p_away: 0.2 })
  const rows = resultRows([homeWin, draw, awayWin, noForecast, upcoming])

  it('keeps finished fixtures with a forecast, newest matchweek first, kickoff order within', () => {
    expect(rows.map((r) => r.fixture.fixture_id)).toEqual([draw, awayWin, homeWin].map((f) => f.fixture_id))
  })

  it('grades the call against the actual result and the likeliest score against the real one', () => {
    const [d, a, h] = rows
    expect([h.call, h.actual, h.correct, h.exactScore]).toEqual(['H', 'H', true, true])
    expect([d.call, d.actual, d.correct, d.exactScore]).toEqual(['H', 'D', false, false])
    expect([a.actual, a.correct, a.modalScore]).toEqual(['A', false, null])
    expect(h.leanDraw).toBe(false)
  })

  it('summarises hits, splits by actual outcome, mean RPS and exact scores', () => {
    const s = summariseResults(rows)
    expect(s.hits).toBe(1)
    expect(s.n).toBe(3)
    expect(s.byActual.H).toEqual({ hits: 1, n: 1, pct: 100 })
    expect(s.byActual.D).toEqual({ hits: 0, n: 1, pct: 0 })
    expect(s.byActual.A).toEqual({ hits: 0, n: 1, pct: 0 })
    expect(s.meanRps).toBeCloseTo((0.145 + 0.145 + 0.445) / 3, 10)
    expect(s.exactScores).toBe(1)
    expect(summariseResults([])).toMatchObject({ n: 0, pct: null, meanRps: null })
  })

  it('filters by matchweek and outcome, and lists matchweeks newest first', () => {
    expect(filterRows(rows, { matchweek: 1, outcome: 'all' })).toHaveLength(2)
    expect(filterRows(rows, { matchweek: null, outcome: 'correct' }).map((r) => r.fixture.fixture_id)).toEqual([homeWin.fixture_id])
    expect(filterRows(rows, { matchweek: 1, outcome: 'incorrect' }).map((r) => r.fixture.fixture_id)).toEqual([awayWin.fixture_id])
    expect(resultMatchweeks(rows)).toEqual([2, 1])
  })

  it('reports the latest matchweek with a finished match', () => {
    expect(resultsThrough([homeWin, draw, upcoming])).toBe(2)
    expect(resultsThrough([upcoming])).toBeNull()
  })

  it('parses the outcome filter', () => {
    expect(parseOutcomeFilter('correct')).toBe('correct')
    expect(parseOutcomeFilter('incorrect')).toBe('incorrect')
    expect(parseOutcomeFilter('nope')).toBe('all')
    expect(parseOutcomeFilter(null)).toBe('all')
  })
})

describe('formatUpdated', () => {
  const now = Date.parse('2026-10-01T12:00:00Z')
  it('reads like a status line', () => {
    expect(formatUpdated(now - 10_000, now)).toBe('just now')
    expect(formatUpdated(now - 3 * 60_000, now)).toBe('3 min ago')
    expect(formatUpdated(now - 2 * 3600_000, now)).toBe('2 hr ago')
    expect(formatUpdated(now - 26 * 3600_000, now)).toBe('yesterday')
  })
})
