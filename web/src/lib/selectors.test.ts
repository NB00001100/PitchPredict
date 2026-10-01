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
  const at = (iso: string) => Date.parse(iso)
  /** A full round of `n` fixtures from `start`, one every 2.5 hours. */
  function round(matchweek: number, start: string, status: Fixture['status'] = 'TIMED', n = 10): Fixture[] {
    return Array.from({ length: n }, (_, i) =>
      fx({ matchweek, status, kickoff: new Date(at(start) + i * 2.5 * 3600_000).toISOString() }),
    )
  }

  it('normal week: the next full round', () => {
    const fixtures = [
      ...round(5, '2026-10-03T11:30:00Z', 'FINISHED'),
      ...round(6, '2026-10-10T11:30:00Z'),
      ...round(7, '2026-10-17T11:30:00Z'),
    ]
    expect(currentMatchweek(fixtures, at('2026-10-07T12:00:00Z'))).toBe(6)
  })

  it('ignores a leftover postponed fixture from an earlier matchweek', () => {
    const fixtures = [
      ...round(4, '2026-09-26T11:30:00Z', 'FINISHED', 9),
      fx({ matchweek: 4, status: 'POSTPONED', kickoff: '2026-09-27T15:00:00Z' }),
      ...round(5, '2026-10-03T11:30:00Z', 'FINISHED'),
      ...round(6, '2026-10-10T11:30:00Z'),
    ]
    expect(currentMatchweek(fixtures, at('2026-10-07T12:00:00Z'))).toBe(6)
  })

  it('a rescheduled midweek game from an old matchweek does not outvote the next full round', () => {
    const fixtures = [
      ...round(3, '2026-09-19T11:30:00Z', 'FINISHED', 9),
      fx({ matchweek: 3, status: 'TIMED', kickoff: '2026-10-07T19:00:00Z' }),
      ...round(5, '2026-10-03T11:30:00Z', 'FINISHED'),
      ...round(6, '2026-10-10T11:30:00Z'),
    ]
    expect(currentMatchweek(fixtures, at('2026-10-06T12:00:00Z'))).toBe(6)
  })

  it('prefers a matchweek in progress', () => {
    const fixtures = [...round(6, '2026-10-10T11:30:00Z', 'FINISHED', 6), ...round(6, '2026-10-12T19:00:00Z', 'TIMED', 4), ...round(7, '2026-10-17T11:30:00Z')]
    expect(currentMatchweek(fixtures, at('2026-10-11T22:00:00Z'))).toBe(6)
  })

  it('a finished round with one game moved weeks ahead is not "in progress"', () => {
    const fixtures = [
      ...round(5, '2026-10-03T11:30:00Z', 'FINISHED', 9),
      fx({ matchweek: 5, status: 'TIMED', kickoff: '2026-12-02T19:45:00Z' }),
      ...round(6, '2026-10-10T11:30:00Z'),
    ]
    expect(currentMatchweek(fixtures, at('2026-10-05T23:00:00Z'))).toBe(6)
  })

  it('ignores stale scheduled fixtures left in the past', () => {
    const fixtures = [fx({ matchweek: 2, status: 'TIMED', kickoff: '2026-08-29T14:00:00Z' }), ...round(6, '2026-10-10T11:30:00Z')]
    expect(currentMatchweek(fixtures, at('2026-10-07T12:00:00Z'))).toBe(6)
  })

  it('season finished: the last matchweek; null when empty', () => {
    expect(currentMatchweek([fx({ matchweek: 38, status: 'FINISHED' }), fx({ matchweek: 37, status: 'FINISHED' })])).toBe(38)
    expect(currentMatchweek([...round(38, '2027-05-23T15:00:00Z', 'FINISHED'), fx({ matchweek: 30, status: 'POSTPONED' })], at('2027-06-01T00:00:00Z'))).toBe(38)
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
