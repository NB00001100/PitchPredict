import { describe, expect, it } from 'vitest'
import { BASE_RATES_PCT, BOOKMAKERS_PCT, MODEL_BACKTEST_PCT, expectedRange, formatPct, seasonVerdict } from './benchmarks'
import { fixtureView } from './fixtureView'
import { summariseSeason } from './season'
import { formatDateRange, groupByKickoffDay } from './dates'
import { matchweekStatus, parseMatchweekParam } from './matchweek'
import { barSegments, forecastPercents, outcomeLabel, percentGivenToActual, roundPercents } from './probability'
import { toFixture, type Fixture } from './types'

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

describe('roundPercents', () => {
  it('always totals 100', () => {
    expect(roundPercents([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33])
    expect(roundPercents([0.632957, 0.24157, 0.125473])).toEqual([63, 24, 13])
    // Naive rounding gives 46 + 29 + 26 = 101 here.
    expect(roundPercents([0.455, 0.285, 0.26])).toEqual([46, 28, 26])
    for (const shares of [
      [0.173466, 0.246876, 0.579657],
      [0.005, 0.005, 0.99],
      [0.125, 0.125, 0.75],
    ]) {
      expect(roundPercents(shares).reduce((a, b) => a + b, 0)).toBe(100)
    }
  })

  it('normalises inputs that do not sum to 1 and handles zeros', () => {
    expect(roundPercents([2, 1, 1])).toEqual([50, 25, 25])
    expect(roundPercents([0, 0, 0])).toEqual([0, 0, 0])
    expect(roundPercents([1, 0, 0])).toEqual([100, 0, 0])
  })
})

describe('forecast helpers', () => {
  const played = fx({ p_home: 0.55641, p_draw: 0.236983, p_away: 0.206606, actual: 'D', pick: 'H' })

  it('gives the rounded probability of the actual result, matching the bar', () => {
    expect(forecastPercents({ H: 0.55641, D: 0.236983, A: 0.206606 })).toEqual({ H: 55, D: 24, A: 21 })
    expect(percentGivenToActual(played)).toBe(24)
  })

  it('is null without a result or a forecast', () => {
    expect(percentGivenToActual(fx({ p_home: 0.5, p_draw: 0.3, p_away: 0.2 }))).toBeNull()
    expect(percentGivenToActual(fx({ actual: 'H' }))).toBeNull()
  })

  it('names outcomes', () => {
    expect(outcomeLabel(played, 'H')).toBe('Arsenal to win')
    expect(outcomeLabel(played, 'A')).toBe('Leeds United to win')
    expect(outcomeLabel(played, 'D')).toBe('Draw')
  })
})

describe('groupByKickoffDay', () => {
  const fri = fx({ kickoff: '2026-10-09T19:00:00+00:00' })
  const lateSat = fx({ kickoff: '2026-10-10T23:30:00+00:00' })
  const sat = fx({ kickoff: '2026-10-10T11:30:00+00:00' })

  it('groups by calendar day in the given zone, in kickoff order', () => {
    const days = groupByKickoffDay([lateSat, fri, sat], 'Europe/London')
    expect(days.map((d) => d.key)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11'])
    expect(days[1].fixtures).toEqual([sat])
  })

  it('shifts days with the viewer’s time zone', () => {
    const days = groupByKickoffDay([lateSat, fri, sat], 'America/New_York')
    expect(days.map((d) => d.key)).toEqual(['2026-10-09', '2026-10-10'])
    expect(days[1].fixtures).toEqual([sat, lateSat])
  })
})

describe('formatDateRange', () => {
  it('spans first to last kickoff', () => {
    const range = formatDateRange(
      [fx({ kickoff: '2026-10-12T19:00:00+00:00' }), fx({ kickoff: '2026-10-10T11:30:00+00:00' })],
      'en-GB',
      'Europe/London',
    )
    expect(range).toMatch(/Sat 10.*Mon 12 Oct/)
    expect(formatDateRange([], 'en-GB')).toBeNull()
  })
})

describe('matchweekStatus', () => {
  it('is upcoming before anything kicks off', () => {
    expect(matchweekStatus([{ status: 'TIMED' }, { status: 'POSTPONED' }])).toBe('upcoming')
  })
  it('is in progress while something is live or still to come', () => {
    expect(matchweekStatus([{ status: 'FINISHED' }, { status: 'TIMED' }])).toBe('in-progress')
    expect(matchweekStatus([{ status: 'IN_PLAY' }])).toBe('in-progress')
  })
  it('is played when nothing is left this week', () => {
    expect(matchweekStatus([{ status: 'FINISHED' }, { status: 'POSTPONED' }, { status: 'CANCELLED' }])).toBe('played')
  })
})

describe('parseMatchweekParam', () => {
  it('accepts whole matchweeks in the season', () => {
    expect(parseMatchweekParam('2', 6)).toBe(2)
    expect(parseMatchweekParam(' 38 ', 6)).toBe(38)
  })
  it('falls back on anything else', () => {
    for (const raw of [null, '', '0', '39', '999', '2.5', '-1', 'abc', '1e1', '06x']) {
      expect(parseMatchweekParam(raw, 6)).toBe(6)
    }
  })
})

describe('expectedRange', () => {
  it('narrows as picks accumulate', () => {
    const [lo50, hi50] = expectedRange(50)!
    const [lo380, hi380] = expectedRange(380)!
    expect(lo50).toBeCloseTo(37.8, 0)
    expect(hi50).toBeCloseTo(65.5, 0)
    expect(hi380 - lo380).toBeLessThan(hi50 - lo50)
    expect(expectedRange(0)).toBeNull()
  })
})

describe('seasonVerdict and formatPct', () => {
  it('places a season rate against the expected range', () => {
    expect(seasonVerdict(48, 50)).toBe('within')
    expect(seasonVerdict(30, 50)).toBe('below')
    expect(seasonVerdict(70, 50)).toBe('above')
    expect(seasonVerdict(null, 0)).toBe('none')
  })
  it('formats', () => {
    expect(formatPct(48)).toBe('48%')
    expect(formatPct(MODEL_BACKTEST_PCT)).toBe('51.7%')
    expect(formatPct(BOOKMAKERS_PCT)).toBe('54.6%')
    expect(formatPct(BASE_RATES_PCT)).toBe('42.9%')
  })
})

describe('fixtureView', () => {
  it('describes a finished, forecast match', () => {
    const v = fixtureView(
      fx({
        status: 'FINISHED', home_goals: 2, away_goals: 2, p_home: 0.55641, p_draw: 0.236983, p_away: 0.206606,
        exp_home_goals: 1.940926, exp_away_goals: 1.05, modal_score: '1-1', is_backfill: true,
        pick: 'H', actual: 'D', hit: false, home_team: 'Liverpool', away_team: 'Nottingham',
      }),
    )
    expect(v.phase).toBe('finished')
    expect(v.score).toEqual([2, 2])
    expect(v.forecast).toMatchObject({ pick: 'H', pickLabel: 'Liverpool to win', likeliestScore: '1–1', expectedGoals: ['1.9', '1.1'], backtested: true })
    expect(v.result).toEqual({ outcome: 'D', label: 'Draw', percentGiven: 24, hit: false })
  })

  it('shows no score for a live match without goals, and no forecast when there is none', () => {
    const v = fixtureView(fx({ status: 'IN_PLAY' }))
    expect(v.phase).toBe('live')
    expect(v.score).toBeNull()
    expect(v.forecast).toBeNull()
    expect(v.result).toBeNull()
    expect(fixtureView(fx({ status: 'IN_PLAY', home_goals: 1, away_goals: 0 })).score).toEqual([1, 0])
  })

  it('never shows a score for a postponed match', () => {
    expect(fixtureView(fx({ status: 'POSTPONED', home_goals: 0, away_goals: 0 })).score).toBeNull()
  })
})

describe('summariseSeason', () => {
  it('covers all 38 matchweeks and counts drawn misses', () => {
    const s = summariseSeason([
      fx({ matchweek: 1, status: 'FINISHED', hit: true, actual: 'H' }),
      fx({ matchweek: 1, status: 'FINISHED', hit: false, actual: 'D' }),
      fx({ matchweek: 2, status: 'TIMED', p_home: 0.5, p_draw: 0.3, p_away: 0.2 }),
    ])
    expect(s.weeks).toHaveLength(38)
    expect(s.current).toBe(2)
    expect(s.rate).toEqual({ hits: 1, total: 2, pct: 50 })
    expect(s.drawnMisses).toBe(1)
    expect(s.weeks[0]).toMatchObject({ status: 'played', forecasts: 0 })
    expect(s.weeks[1]).toMatchObject({ status: 'upcoming', forecasts: 1 })
    expect(s.weeks[37].fixtures).toEqual([])
  })
})

describe('barSegments', () => {
  it('lays segments end to end', () => {
    const s = barSegments({ H: 0.5, D: 0.3, A: 0.2 })
    expect(s.map((x) => [x.outcome, Math.round(x.start), Math.round(x.width)])).toEqual([['H', 0, 50], ['D', 50, 30], ['A', 80, 20]])
  })
})
