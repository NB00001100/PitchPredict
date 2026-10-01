import { forecastPercents, type Forecast } from '../lib/probability'

interface ProbabilityBarProps {
  /** Shares 0–1 for H, D, A (need not sum to exactly 1). */
  forecast: Forecast
  /** Names for the accessible label, e.g. "Arsenal". */
  homeName: string
  awayName: string
  /** `sm` for tickers and lists, `md` for cards. */
  size?: 'sm' | 'md'
  /** Show the three percentages under the bar (default true). */
  labels?: boolean
  className?: string
}

const SEGMENTS = [
  { key: 'H', fill: 'bg-home', align: 'text-left', name: 'Home' },
  { key: 'D', fill: 'bg-draw', align: 'text-center', name: 'Draw' },
  { key: 'A', fill: 'bg-away', align: 'text-right', name: 'Away' },
] as const

/**
 * Home / draw / away as one bar split in three, home on the left. Segment
 * widths use the exact shares; the labels use whole percentages that sum to
 * 100. Colour is backed by position (home left, away right) and by the
 * labels; screen readers get one spoken summary instead of the graphic.
 */
export function ProbabilityBar({ forecast, homeName, awayName, size = 'md', labels = true, className = '' }: ProbabilityBarProps) {
  const pct = forecastPercents(forecast)
  const summary = `${homeName} win ${pct.H}%, draw ${pct.D}%, ${awayName} win ${pct.A}%`
  return (
    <div className={className}>
      <span className="sr-only">{summary}</span>
      <div aria-hidden="true" className={`flex w-full gap-0.5 ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
        {SEGMENTS.map((s) => (
          <span
            key={s.key}
            className={`${s.fill} min-w-1 first:rounded-l-full last:rounded-r-full`}
            style={{ flexGrow: Math.max(forecast[s.key], 0.001), flexBasis: 0 }}
          />
        ))}
      </div>
      {labels ? (
        <div
          aria-hidden="true"
          className={`mt-1.5 grid grid-cols-3 font-mono tabular-nums ${size === 'sm' ? 'text-[0.7rem]' : 'text-xs'}`}
        >
          {SEGMENTS.map((s) => (
            <span key={s.key} className={`${s.align} text-grey-200`}>
              <span className="text-grey-500">{s.key} </span>
              {pct[s.key]}%
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
