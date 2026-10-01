import { describe, expect, it } from 'vitest'
import { byMatchweek, currentMatchweek, hitRate, hitRateByMatchweek } from './selectors'
import { toFixture, type Fixture } from './types'

let id = 0
function fx(overrides: Partial<Fixture>): Fixture {
  id += 1
  return {
    ...toFixture({ fixture_id: id, season: '2026-2027', home_tla: 'ARS', away_tla: 'LEE' }),
    status: 'TIMED',
    matchweek: 1,
    kickoff: '2026-08-15T14:00:00+00:00',
    ...overrides,
  }
}

describe('toFixture', () => {
  it('coerces numeric strings and rejects junk', () => {
    const f = toFixture({ fixture_id: '42', matchweek: '6', p_home: '0.5', p_draw: 'x', hit: 'true', pick: 'Z', status: 'TIMED' })
    expect(f.fixture_id).toBe(42)
    expect(f.matchweek).toBe(6)
    expect(f.p_home).toBe(0.5)
    expect(f.p_draw).toBeNull()
    expect(f.hit).toBe(true)
    expect(f.pick).toBeNull()
  })
})

describe('byMatchweek', () => {
  it('groups ascending and sorts by kickoff', () => {
    const late = fx({ matchweek: 2, kickoff: '2026-08-23T16:30:00+00:00' })
    const early = fx({ matchweek: 2, kickoff: '2026-08-22T11:30:00+00:00' })
    const first = fx({ matchweek: 1 })
    const groups = byMatchweek([late, first, early])
    expect(groups.map((g) => g.matchweek)).toEqual([1, 2])
    expect(groups[1].fixtures).toEqual([early, late])
  })
})

describe('currentMatchweek', () => {
  it('is the lowest matchweek with an unfinished fixture', () => {
    const fixtures = [
      fx({ matchweek: 5, status: 'FINISHED' }),
      fx({ matchweek: 5, status: 'CANCELLED' }),
      fx({ matchweek: 6, status: 'FINISHED' }),
      fx({ matchweek: 6, status: 'POSTPONED' }),
      fx({ matchweek: 7, status: 'TIMED' }),
    ]
    expect(currentMatchweek(fixtures)).toBe(6)
  })

  it('falls back to the last matchweek when all are done, and null when empty', () => {
    expect(currentMatchweek([fx({ matchweek: 38, status: 'FINISHED' }), fx({ matchweek: 37, status: 'FINISHED' })])).toBe(38)
    expect(currentMatchweek([])).toBeNull()
  })
})

describe('hitRate', () => {
  it('counts only graded fixtures', () => {
    expect(hitRate([fx({ hit: true }), fx({ hit: false }), fx({ hit: true }), fx({ hit: null })])).toEqual({
      hits: 2,
      total: 3,
      pct: (2 / 3) * 100,
    })
  })

  it('has a null pct with nothing graded', () => {
    expect(hitRate([fx({ hit: null })])).toEqual({ hits: 0, total: 0, pct: null })
  })

  it('splits by matchweek, skipping ungraded weeks', () => {
    const rates = hitRateByMatchweek([
      fx({ matchweek: 1, hit: true }),
      fx({ matchweek: 1, hit: false }),
      fx({ matchweek: 2, hit: null }),
      fx({ matchweek: 3, hit: true }),
    ])
    expect(rates).toEqual([
      { matchweek: 1, hits: 1, total: 2, pct: 50 },
      { matchweek: 3, hits: 1, total: 1, pct: 100 },
    ])
  })
})
