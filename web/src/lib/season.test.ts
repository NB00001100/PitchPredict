import { describe, expect, it } from 'vitest'
import { resultRows, summariseResults } from './results'
import { formatSeason, latestSeason, onlyLatestSeason, seasonLabel, summariseSeason } from './season'
import { toFixture, type Fixture, type FixtureRow } from './types'
import { fetchFixtures, type FixturesClient } from './useFixtures'

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

/** A finished, graded fixture. */
const graded = (season: string, matchweek: number, hit: boolean): Fixture =>
  fx({
    season,
    matchweek,
    status: 'FINISHED',
    kickoff: `${season.slice(0, 4)}-09-0${matchweek}T14:00:00Z`,
    home_goals: hit ? 2 : 0,
    away_goals: hit ? 0 : 1,
    p_home: 0.6,
    p_draw: 0.25,
    p_away: 0.15,
    pick: 'H',
    actual: hit ? 'H' : 'A',
    hit,
  })

// Last season finished (all hits), this season just started (one hit, one miss).
const lastSeason = [graded('2026-2027', 1, true), graded('2026-2027', 2, true), graded('2026-2027', 38, true)]
const thisSeason = [graded('2027-2028', 1, true), graded('2027-2028', 1, false), fx({ season: '2027-2028', matchweek: 2, kickoff: '2027-08-21T14:00:00Z' })]
const mixed = [...lastSeason, ...thisSeason]

describe('latestSeason', () => {
  it('picks the season with the greatest starting year', () => {
    expect(latestSeason(['2026-2027', '2027-2028', '2025-2026'])).toBe('2027-2028')
    expect(latestSeason(['2027-2028', '2026-2027'])).toBe('2027-2028')
  })
  it('prefers well-formed ids and is null without any', () => {
    expect(latestSeason(['junk', '2026-2027'])).toBe('2026-2027')
    expect(latestSeason(['', ''])).toBeNull()
    expect(latestSeason([])).toBeNull()
  })
})

describe('onlyLatestSeason', () => {
  it('keeps one season when two are present', () => {
    const kept = onlyLatestSeason(mixed)
    expect(kept).toHaveLength(thisSeason.length)
    expect(new Set(kept.map((f) => f.season))).toEqual(new Set(['2027-2028']))
  })
  it('returns the same array when there is only one season', () => {
    expect(onlyLatestSeason(lastSeason)).toBe(lastSeason)
  })
})

describe('season labels', () => {
  it('formats season ids for display', () => {
    expect(formatSeason('2026-2027')).toBe('2026/27')
    expect(formatSeason('2027/28')).toBe('2027/28')
    expect(formatSeason('weird')).toBe('weird')
  })
  it('labels the latest season present, from the data', () => {
    expect(seasonLabel(mixed)).toBe('2027/28 season')
    expect(seasonLabel(lastSeason)).toBe('2026/27 season')
    expect(seasonLabel([])).toBeNull()
  })
})

describe('season figures with two seasons in the data', () => {
  it('counts only the latest season once filtered', () => {
    const season = summariseSeason(onlyLatestSeason(mixed))
    expect(season.rate).toMatchObject({ hits: 1, total: 2 })
    expect(season.weeks[37].fixtures).toHaveLength(0) // last season's matchweek 38 is gone
    const results = summariseResults(resultRows(onlyLatestSeason(mixed)))
    expect(results).toMatchObject({ hits: 1, n: 2 })
  })
})

/** A stand-in for the supabase-js query builder that records the filters it was given. */
function fakeClient(rows: FixtureRow[], { ignoreFilter = false } = {}) {
  const calls: string[] = []
  const client: FixturesClient = {
    from() {
      let result = [...rows]
      let selected = '*'
      let limit = Infinity
      type Q = ReturnType<FixturesClient['from']>
      const q: Q = {
        select(columns: string) {
          selected = columns
          calls.push(`select ${columns}`)
          return q
        },
        eq(column: string, value: string) {
          calls.push(`eq ${column} ${value}`)
          if (!ignoreFilter) result = result.filter((r) => r[column] === value)
          return q
        },
        order(column: string, { ascending }: { ascending: boolean }) {
          result.sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : String(a[column]) > String(b[column]) ? 1 : 0) * (ascending ? 1 : -1))
          return q
        },
        limit(n: number) {
          limit = n
          return q
        },
        then(onFulfilled, onRejected) {
          const data = result.slice(0, limit).map((r) => (selected === '*' ? r : { [selected]: r[selected] }))
          return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
        },
      }
      return q
    },
  }
  return { client, calls }
}

const asRows = (list: Fixture[]) => list.map((f) => ({ ...f }) as unknown as FixtureRow)

describe('fetchFixtures', () => {
  it('asks for the latest season only', async () => {
    const { client, calls } = fakeClient(asRows(mixed))
    const fixtures = await fetchFixtures(client)
    expect(calls).toContain('eq season 2027-2028')
    expect(fixtures.map((f) => f.season)).toEqual(['2027-2028', '2027-2028', '2027-2028'])
  })
  it('still shows one season if the server returns several', async () => {
    const { client } = fakeClient(asRows(mixed), { ignoreFilter: true })
    const fixtures = await fetchFixtures(client)
    expect(new Set(fixtures.map((f) => f.season))).toEqual(new Set(['2027-2028']))
  })
  it('returns nothing for an empty view and explains a missing client', async () => {
    expect(await fetchFixtures(fakeClient([]).client)).toEqual([])
    await expect(fetchFixtures(null)).rejects.toThrow(/Supabase|Missing/)
  })
})
