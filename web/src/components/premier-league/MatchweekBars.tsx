import type { CSSProperties, ReactNode } from 'react'
import { formatPct, MODEL_BACKTEST_PCT } from '../../lib/benchmarks'
import { useMatchweekNav } from '../../lib/matchweekNav'
import type { WeekSummary } from '../../lib/season'

interface MatchweekBarsProps {
  weeks: readonly WeekSummary[]
  /** Called after a jump, e.g. to bring the carousel into view. */
  onJump?: (matchweek: number) => void
}

/** Phones fold the season into two rows of 19; wider screens show all 38 in one. */
const ROW_SM = 19
const ROW_LG = 38

/**
 * One column per matchweek, its height the share of that week's picks that
 * were right (0–100%, from a zero baseline), the hit count on its cap. A
 * hairline across the plot marks the model's long-run rate. Played weeks are
 * buttons that open the week in the carousel; the current week is ringed in
 * green; weeks to come are quiet placeholders. Every button's accessible name
 * carries its numbers, and hover or focus shows them in a tooltip.
 */
export function MatchweekBars({ weeks, onJump }: MatchweekBarsProps) {
  const { selected, current, go } = useMatchweekNav()

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h3 className="type-label text-grey-200">Correct picks by matchweek</h3>
        <p aria-hidden="true" className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[0.66rem] tracking-[0.06em] text-grey-400 uppercase">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2 rounded-t-[2px] bg-pitch" />
            Share correct
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 bg-white/60" />
            Model long-run {formatPct(MODEL_BACKTEST_PCT)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-pitch/70" />
            This week
          </span>
        </p>
      </div>
      <ol aria-label="Correct picks by matchweek" className="mt-5 grid grid-cols-19 gap-y-5 sm:grid-cols-38">
        {weeks.map((week, i) => {
          const { matchweek, rate } = week
          const graded = rate.total > 0 && rate.pct !== null
          const isSelected = matchweek === selected
          const isCurrent = matchweek === current
          const edge = edgeClasses(i)
          if (!graded && !isCurrent) {
            return (
              <li key={matchweek} aria-hidden="true" className="flex flex-col items-center gap-1.5">
                <Plot>
                  <span className="absolute bottom-0 left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-grey-700" />
                </Plot>
                <span className="font-mono text-[0.6rem] leading-none text-grey-500/60 tabular-nums">{matchweek}</span>
              </li>
            )
          }
          const label = graded
            ? `Matchweek ${matchweek}: ${rate.hits} of ${rate.total} correct`
            : `Matchweek ${matchweek}, this week: not graded yet`
          return (
            <li key={matchweek}>
              <button
                type="button"
                onClick={() => {
                  go(matchweek)
                  onJump?.(matchweek)
                }}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={label}
                className="group/bar relative flex w-full flex-col items-center gap-1.5 rounded-md focus-visible:outline-offset-1"
              >
                <Plot selected={isSelected}>
                  {graded ? (
                    <>
                      <span
                        className={`pl-grow-y absolute bottom-0 left-1/2 w-[62%] max-w-6 -translate-x-1/2 rounded-t-[4px] transition-colors duration-200 ${isSelected ? 'bg-pitch-bright shadow-[0_0_16px_rgb(60_240_140/0.7)]' : 'bg-pitch group-hover/bar:bg-pitch-bright'}`}
                        style={{ height: `${Math.max(rate.pct ?? 0, 2)}%`, '--pl-delay': `${300 + i * 45}ms` } as CSSProperties}
                      />
                      <span
                        className={`pl-fade absolute left-1/2 -translate-x-1/2 font-mono text-[0.62rem] leading-none tabular-nums ${isSelected ? 'font-semibold text-white' : 'text-grey-200'}`}
                        style={{ bottom: `calc(${rate.pct}% + 4px)`, '--pl-delay': `${700 + i * 45}ms` } as CSSProperties}
                      >
                        {rate.hits}
                      </span>
                    </>
                  ) : (
                    <span className="absolute inset-x-[18%] top-0 bottom-0 rounded-t-[4px] border border-b-0 border-dashed border-pitch/60 bg-pitch-dim/40" />
                  )}
                </Plot>
                <span
                  className={`font-mono text-[0.6rem] leading-none tabular-nums ${
                    isSelected ? 'font-semibold text-white underline decoration-pitch decoration-2 underline-offset-4' : isCurrent ? 'text-pitch' : 'text-grey-400 group-hover/bar:text-white'
                  }`}
                >
                  {matchweek}
                </span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-[calc(100%+6px)] z-10 rounded-lg border border-hairline-strong bg-black/90 px-2.5 py-1.5 text-left font-mono text-[0.68rem] leading-snug whitespace-nowrap text-grey-200 opacity-0 shadow-lift transition-[opacity,translate] duration-200 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100 ${edge}`}
                >
                  <span className="block text-white">MW {matchweek}</span>
                  {graded ? `${rate.hits}/${rate.total} · ${formatPct(rate.pct ?? 0)}` : 'Not graded yet'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** The column's frame: zero baseline, and the long-run reference line running through every slot. */
function Plot({ children, selected = false }: { children: ReactNode; selected?: boolean }) {
  return (
    <span className={`relative block h-16 w-full border-b border-grey-700 sm:h-20 ${selected ? 'rounded-t-md bg-white/[0.06]' : ''}`}>
      <span className="absolute inset-x-0 h-px bg-white/30" style={{ bottom: `${MODEL_BACKTEST_PCT}%` }} />
      {children}
    </span>
  )
}

/** Keeps tooltips at either end of a row inside the chart. */
function edgeClasses(i: number): string {
  const sm = i % ROW_SM
  const lg = i % ROW_LG
  const small = sm < 2 ? 'left-0' : sm > ROW_SM - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
  const large = lg < 2 ? 'sm:left-0 sm:right-auto sm:translate-x-0' : lg > ROW_LG - 3 ? 'sm:right-0 sm:left-auto sm:translate-x-0' : 'sm:left-1/2 sm:right-auto sm:-translate-x-1/2'
  return `${small} ${large}`
}
