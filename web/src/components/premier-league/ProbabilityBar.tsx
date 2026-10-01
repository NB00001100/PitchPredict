import type { CSSProperties } from 'react'
import type { ForecastView } from '../../lib/fixtureView'
import { barSegments, OUTCOMES } from '../../lib/probability'
import type { Fixture, Outcome } from '../../lib/types'

interface ProbabilityBarProps {
  fixture: Pick<Fixture, 'home_team' | 'away_team' | 'home_tla' | 'away_tla'>
  forecast: Pick<ForecastView, 'shares' | 'percents' | 'pick'>
  /** Entrance delay in ms, so the bar fills just after its card lands. */
  delay?: number
}

const FILL: Record<Outcome, string> = { H: 'bg-home', D: 'bg-draw', A: 'bg-away' }
const ALIGN: Record<Outcome, string> = { H: 'text-left', D: 'text-center', A: 'text-right' }

/**
 * The forecast as one bar split three ways, home on the left, in the
 * system's home / draw / away mark colours. The pick stands taller and at
 * full strength; the other two sit back. Labels live in a fixed three-column
 * row under the bar (never inside segments), whole percentages that sum to
 * 100. Position and the labels carry identity, so nothing rests on colour.
 * The bar is decorative; the labels are the readable figures.
 */
export function ProbabilityBar({ fixture, forecast, delay = 0 }: ProbabilityBarProps) {
  const names: Record<Outcome, { short: string; long: string }> = {
    H: { short: fixture.home_tla, long: `${fixture.home_team} win` },
    D: { short: 'Draw', long: 'Draw' },
    A: { short: fixture.away_tla, long: `${fixture.away_team} win` },
  }
  const segments = barSegments(forecast.shares)

  return (
    <div>
      <div aria-hidden="true" className="pl-grow-x flex h-3 items-center gap-0.5" style={{ '--pl-delay': `${delay}ms` } as CSSProperties}>
        {segments.map((s) => {
          const picked = s.outcome === forecast.pick
          return (
            <span
              key={s.outcome}
              className={`min-w-1.5 rounded-[2px] first:rounded-l-full last:rounded-r-full ${FILL[s.outcome]} ${picked ? 'h-3' : 'h-1.5 opacity-55'}`}
              style={{ width: `${s.width}%` }}
            />
          )
        })}
      </div>
      <ul className="mt-2 grid grid-cols-3 font-mono text-[0.8rem] leading-none tabular-nums">
        {OUTCOMES.map((o) => {
          const picked = o === forecast.pick
          return (
            <li key={o} className={`${ALIGN[o]} ${picked ? 'font-semibold text-white' : 'text-grey-400'}`}>
              <span aria-hidden="true" translate="no" className={picked ? 'text-grey-200' : 'text-grey-500'}>
                {names[o].short}{' '}
              </span>
              <span className="sr-only">{names[o].long}: </span>
              {forecast.percents[o]}%
            </li>
          )
        })}
      </ul>
    </div>
  )
}
