import * as m from 'motion/react-m'
import { useId, type ReactNode } from 'react'
import { EASE_OUT_EXPO } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'
import { ArrowRightIcon } from './Icons'
import { Tag } from './Tag'

export interface BarRow {
  name: string
  detail?: string
  value: number
  /** Emphasised series (drawn in pitch green); the rest stay neutral. */
  emphasis?: boolean
}

interface BarComparisonProps {
  title: ReactNode
  /** Which way is good. Drives the direction banner and the "Best" tag. */
  better: 'higher' | 'lower'
  rows: BarRow[]
  /** Axis domain upper bound; the baseline is always 0. */
  max: number
  ticks: number[]
  format: (n: number) => string
  /** Axis tick labels (defaults to `format`). */
  tickFormat?: (n: number) => string
  /** Column header for the value in the table view. */
  valueLabel: string
  note?: ReactNode
}

/**
 * Horizontal bars from a zero baseline, one emphasised series, values at the
 * bar tips, hairline gridlines, and a table view underneath. Bars grow in
 * (scaleX) when the chart scrolls into view. The "better" direction is spelt
 * out in words, with an arrow, and the best row is tagged.
 */
export function BarComparison({ title, better, rows, max, ticks, format, tickFormat = format, valueLabel, note }: BarComparisonProps) {
  const reduced = usePrefersReducedMotion()
  const titleId = useId()
  const best = rows.reduce((a, b) => ((better === 'higher' ? b.value > a.value : b.value < a.value) ? b : a))
  const pct = (n: number) => `${(n / max) * 100}%`

  return (
    <figure aria-labelledby={titleId} className="flex flex-col gap-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span id={titleId} className="type-title">
          {title}
        </span>
        <span className="type-label inline-flex items-center gap-2 rounded-full border border-hairline-strong px-3 py-1.5 text-[0.65rem] text-white">
          {better === 'lower' ? (
            <>
              <ArrowRightIcon className="size-3.5 rotate-180 text-pitch" />
              Lower is better
            </>
          ) : (
            <>
              Higher is better
              <ArrowRightIcon className="size-3.5 text-pitch" />
            </>
          )}
        </span>
      </figcaption>

      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.name}>
            {row.name}
            {row.detail ? ` (${row.detail})` : ''}: {format(row.value)}
            {row === best ? ', the best' : ''}
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="flex flex-col">
        <ul className="flex flex-col gap-5">
          {rows.map((row, i) => (
            <li key={row.name} className="grid grid-cols-[minmax(6.5rem,9rem)_1fr] items-center gap-x-4">
              <span className="flex flex-col">
                <span className={`text-sm font-semibold ${row.emphasis ? 'text-white' : 'text-grey-200'}`}>{row.name}</span>
                {row.detail ? <span className="text-xs text-grey-500">{row.detail}</span> : null}
              </span>
              <span className="relative flex h-10 items-center">
                {/* Gridlines */}
                {ticks.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-grey-800" style={{ left: pct(t) }} />
                ))}
                <m.span
                  className={`relative h-5 origin-left rounded-r-[4px] ${row.emphasis ? 'bg-pitch shadow-[0_0_24px_-4px_rgb(60_240_140/0.7)]' : 'bg-grey-500'}`}
                  style={{ width: pct(row.value) }}
                  initial={reduced ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 1.1, ease: EASE_OUT_EXPO, delay: 0.15 + i * 0.12 }}
                />
                <m.span
                  className="relative ml-3 flex items-center gap-2 font-mono text-sm text-white tabular-nums"
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.9 + i * 0.12 }}
                >
                  {format(row.value)}
                  {row === best ? (
                    <Tag tone="accent" icon={null} className="hidden sm:inline-flex">
                      Best
                    </Tag>
                  ) : null}
                </m.span>
              </span>
            </li>
          ))}
        </ul>
        {/* Axis */}
        <div className="mt-2 grid grid-cols-[minmax(6.5rem,9rem)_1fr] gap-x-4 border-t border-grey-700 pt-2">
          <span />
          <span className="relative h-4">
            {ticks.map((t, i) => (
              <span
                key={t}
                className={`type-label absolute text-[0.62rem] text-grey-500 ${i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: pct(t) }}
              >
                {tickFormat(t)}
              </span>
            ))}
          </span>
        </div>
      </div>

      {note ? <p className="text-sm leading-relaxed text-grey-400">{note}</p> : null}

      <details className="group rounded-xl border border-hairline bg-black/30 text-sm">
        <summary className="type-label flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[0.68rem] text-grey-200 marker:hidden hover:text-white">
          View as table
          <ArrowRightIcon className="size-3.5 rotate-90 transition-transform duration-200 group-open:-rotate-90" />
        </summary>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-y border-hairline">
              <th scope="col" className="type-label px-4 py-2 text-[0.62rem] font-normal text-grey-400">
                Forecaster
              </th>
              <th scope="col" className="type-label px-4 py-2 text-right text-[0.62rem] font-normal text-grey-400">
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-hairline last:border-b-0">
                <th scope="row" className="px-4 py-2.5 font-normal">
                  {row.name}
                  {row.detail ? <span className="text-grey-500"> · {row.detail}</span> : null}
                </th>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{format(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
