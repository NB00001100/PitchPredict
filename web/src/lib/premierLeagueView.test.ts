import { describe, expect, it } from 'vitest'
import { expectedRange } from './benchmarks'
import { meterDomain, meterPosition, meterTicks, niceDomain } from './meterScale'
import { toFixture, type Fixture } from './types'
import { actualOutcome, describeCounts, pickOf, weekBreakdown } from './weekBreakdown'

let id = 0
function fx(overrides: Partial<Fixture>): Fixture {
  id += 1
  return {
    ...toFixture({ fixture_id: id, season: '2026-2027', home_team: 'Arsenal', away_team: 'Leeds United' }),
    status: 'TIMED',
    matchweek: 1,
    kickoff: '2026-08-15T14:00:00+00:00',
    ...overrides,
  }
}

const forecast = { p_home: 0.5, p_draw: 0.3, p_away: 0.2 }

describe('actualOutcome', () => {
  it('uses the actual column for finished matches', () => {
    expect(actualOutcome(fx({ status: 'FINISHED', actual: 'A', home_goals: 3, away_goals: 0 }))).toBe('A')
  })
  it('falls back to the score, with or without a forecast', () => {
    expect(actualOutcome(fx({ status: 'FINISHED', home_goals: 2, away_goals: 1 }))).toBe('H')
    expect(actualOutcome(fx({ status: 'FINISHED', home_goals: 1, away_goals: 1 }))).toBe('D')
    expect(actualOutcome(fx({ status: 'FINISHED', home_goals: 0, away_goals: 2 }))).toBe('A')
  })
  it('is null unless the match is finished with a score', () => {
    expect(actualOutcome(fx({ status: 'IN_PLAY', home_goals: 1, away_goals: 0 }))).toBeNull()
    expect(actualOutcome(fx({ status: 'POSTPONED' }))).toBeNull()
    expect(actualOutcome(fx({ status: 'FINISHED' }))).toBeNull()
  })
})

describe('pickOf', () => {
  it('prefers the pick column, else the largest share, else null', () => {
    expect(pickOf(fx({ ...forecast, pick: 'A' }))).toBe('A')
    expect(pickOf(fx({ p_home: 0.2, p_draw: 0.3, p_away: 0.5 }))).toBe('A')
    expect(pickOf(fx({}))).toBeNull()
  })
})

describe('weekBreakdown', () => {
  it('keeps predicted and actual counts apart and lines rows up in kickoff order', () => {
    const late = fx({ ...forecast, pick: 'H', status: 'FINISHED', home_goals: 1, away_goals: 1, actual: 'D', hit: false, kickoff: '2026-08-16T14:00:00Z' })
    const early = fx({ ...forecast, pick: 'H', status: 'FINISHED', home_goals: 2, away_goals: 0, actual: 'H', hit: true, kickoff: '2026-08-15T11:30:00Z' })
    const upcoming = fx({ p_home: 0.2, p_draw: 0.3, p_away: 0.5, pick: 'A', kickoff: '2026-08-17T19:00:00Z' })
    const noForecast = fx({ status: 'FINISHED', home_goals: 0, away_goals: 1, kickoff: '2026-08-15T14:00:00Z' })
    const b = weekBreakdown([late, early, upcoming, noForecast])
    expect(b.picks).toEqual({ H: 2, D: 0, A: 1 })
    expect(b.results).toEqual({ H: 1, D: 1, A: 1 })
    expect(b.forecasts).toBe(3)
    expect(b.finished).toBe(3)
    expect(b.rows.map((r) => r.fixtureId)).toEqual([early, noForecast, late, upcoming].map((f) => f.fixture_id))
    expect(b.rows.map((r) => r.hit)).toEqual([true, null, false, null])
  })

  it('handles an empty week', () => {
    expect(weekBreakdown([])).toEqual({ picks: { H: 0, D: 0, A: 0 }, results: { H: 0, D: 0, A: 0 }, forecasts: 0, finished: 0, rows: [] })
  })
})

describe('describeCounts', () => {
  const nouns = { H: ['home win', 'home wins'], D: ['draw', 'draws'], A: ['away win', 'away wins'] } as const
  it('names non-zero counts with singular and plural', () => {
    expect(describeCounts({ H: 4, D: 1, A: 0 }, nouns)).toBe('4 home wins, 1 draw')
    expect(describeCounts({ H: 0, D: 0, A: 0 }, nouns)).toBe('none')
  })
})

describe('meterDomain', () => {
  it('covers 30–70 at minimum', () => {
    expect(meterDomain(48, expectedRange(400))).toEqual([30, 70])
    expect(meterDomain(null, null)).toEqual([30, 70])
  })
  it('widens in tens for the season figure and a wide early-season range', () => {
    // 10 picks: 51.7 ± 31 → about 20.7 to 82.6.
    expect(meterDomain(30, expectedRange(10))).toEqual([20, 90])
    expect(meterDomain(100, null)).toEqual([30, 100])
    expect(meterDomain(0, null)).toEqual([0, 70])
  })
  it('contains every reference figure and the 50-pick range', () => {
    const range = expectedRange(50)!
    const [lo, hi] = meterDomain(48, range)
    for (const v of [42.86, 51.68, 54.62, 48, ...range]) {
      expect(v).toBeGreaterThanOrEqual(lo)
      expect(v).toBeLessThanOrEqual(hi)
    }
  })
})

describe('meterPosition and meterTicks', () => {
  it('maps and clamps', () => {
    expect(meterPosition(50, [30, 70])).toBe(50)
    expect(meterPosition(30, [30, 70])).toBe(0)
    expect(meterPosition(90, [30, 70])).toBe(100)
  })
  it('ticks every ten, ends included', () => {
    expect(meterTicks([30, 70])).toEqual([30, 40, 50, 60, 70])
    expect(meterTicks([20, 90])).toEqual([20, 30, 40, 50, 60, 70, 80, 90])
  })
})

describe('niceDomain', () => {
  it('keeps the floor range and snaps outwards to the step', () => {
    expect(niceDomain([0.1987], 0.02, [0.18, 0.24])).toEqual([0.18, 0.24])
    expect(niceDomain([0.31], 0.02, [0.18, 0.24], 0.005)).toEqual([0.18, 0.32])
    expect(niceDomain([0.15], 0.02, [0.18, 0.24])).toEqual([0.14, 0.24])
  })
})
