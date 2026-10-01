import { motion } from 'motion/react'
import { BACKTEST_MATCHES, BENCHMARKS, expectedRange, formatPct, type Benchmark } from '../../lib/benchmarks'
import { meterDomain, meterPosition } from '../../lib/meterScale'
import { EASE_OUT_EXPO } from '../../lib/motion'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'

interface MarkStyle {
  /** Label lane under the rail: 0 is nearer the rail. */
  lane: 0 | 1
  /** How the label hangs off its tick (keeps the close model/bookmaker marks apart). */
  anchor: 'start' | 'center' | 'end'
  strong: boolean
}

/*
 * Model (51.7) and bookmakers (54.6) are under three points apart, so the
 * model's label drops to the second lane; base rates hang left of their tick
 * and bookmakers right, so the first lane never collides.
 */
const MARKS: Record<Benchmark['id'], MarkStyle> = {
  'base-rates': { lane: 0, anchor: 'end', strong: false },
  bookmakers: { lane: 0, anchor: 'start', strong: false },
  model: { lane: 1, anchor: 'center', strong: true },
}

const LANE_TOP = [76, 116] as const
const RAIL_TOP = 46
const RAIL_H = 8

const ANCHOR = { start: 'translate-x-0 items-start text-left', center: '-translate-x-1/2 items-center text-center', end: '-translate-x-full items-end text-right' } as const

interface HitRateMeterProps {
  /** Season hit rate, 0–100, or null before anything is graded. */
  pct: number | null
  /** Number of graded picks. */
  graded: number
}

/**
 * An instrument scale for the season hit rate. A needle shows this season;
 * ticks mark three reference figures (base rates, the model's long-run
 * backtest, the bookmakers' closing odds); a bracket shows the range a season
 * lands in 95% of the time after this many picks. It encodes position, not
 * length, so the scale can start above zero; its ends are labelled. The
 * graphic is hidden from assistive tech; the same figures follow as text.
 */
export function HitRateMeter({ pct, graded }: HitRateMeterProps) {
  const reduced = usePrefersReducedMotion()
  const range = expectedRange(graded)
  const domain = meterDomain(pct, range)
  const at = (v: number) => meterPosition(v, domain)
  const minor: number[] = []
  for (let t = Math.ceil(domain[0] / 5) * 5; t <= domain[1]; t += 5) minor.push(t)

  const needle = pct === null ? null : at(pct)
  const chipAnchor = needle === null ? 'center' : needle < 14 ? 'start' : needle > 86 ? 'end' : 'center'

  return (
    <figure className="flex flex-col gap-4">
      <div aria-hidden="true" className="relative h-[13.25rem] select-none">
        {/* Rail, with the expected range lit along it and minor ticks every 5 points. */}
        <div className="absolute inset-x-0 rounded-full bg-grey-800 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" style={{ top: RAIL_TOP, height: RAIL_H }}>
          {range ? (
            <motion.div
              className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,rgb(214_255_234/0.08),rgb(214_255_234/0.2),rgb(214_255_234/0.08))] shadow-[inset_0_0_0_1px_rgb(214_255_234/0.22)]"
              style={{ left: `${at(range[0])}%`, width: `${at(range[1]) - at(range[0])}%`, originX: 0.5 }}
              initial={reduced ? false : { opacity: 0, scaleX: 0.2 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.2 }}
            />
          ) : null}
        </div>
        {minor.map((t) => (
          <span
            key={t}
            className={`absolute w-px ${t % 10 === 0 ? 'h-2 bg-grey-500' : 'h-1 bg-grey-700'}`}
            style={{ left: `${at(t)}%`, top: RAIL_TOP + RAIL_H + 3 }}
          />
        ))}

        {/* Reference ticks crossing the rail, leaders down to their labels. */}
        {BENCHMARKS.map((b) => {
          const m = MARKS[b.id]
          const x = at(b.pct)
          const top = LANE_TOP[m.lane]
          return (
            <div key={b.id}>
              <span
                className={`absolute w-0.5 -translate-x-1/2 rounded-full ${m.strong ? 'bg-white' : 'bg-grey-400'}`}
                style={{ left: `${x}%`, top: RAIL_TOP - 6, height: RAIL_H + 12 }}
              />
              <span
                className={`absolute w-px -translate-x-1/2 ${m.strong ? 'bg-white/45' : 'bg-grey-400/40'}`}
                style={{ left: `${x}%`, top: RAIL_TOP + RAIL_H + 6, height: top - (RAIL_TOP + RAIL_H + 6) - 2 }}
              />
              <span className={`absolute flex flex-col gap-0.5 whitespace-nowrap ${ANCHOR[m.anchor]}`} style={{ left: `${x}%`, top }}>
                <span className={`text-[0.74rem] leading-tight ${m.strong ? 'font-medium text-white' : 'text-grey-200'}`}>{b.label}</span>
                <span className={`font-mono text-[0.74rem] leading-tight tabular-nums ${m.strong ? 'text-white' : 'text-grey-400'}`}>{formatPct(b.pct)}</span>
              </span>
            </div>
          )
        })}

        {/* Scale ends. */}
        <span className="absolute left-0 font-mono text-[0.66rem] text-grey-500 tabular-nums" style={{ top: LANE_TOP[1] + 8 }}>
          {domain[0]}%
        </span>
        <span className="absolute right-0 font-mono text-[0.66rem] text-grey-500 tabular-nums" style={{ top: LANE_TOP[1] + 8 }}>
          {domain[1]}%
        </span>

        {/* Expected-range bracket, under everything, aligned with the lit band. */}
        {range ? (
          <div className="absolute" style={{ left: `${at(range[0])}%`, width: `${at(range[1]) - at(range[0])}%`, top: 166 }}>
            <span className="block h-2 rounded-b-[3px] border-x border-b border-grey-400/70" />
            <span className="mt-1.5 block text-center font-mono text-[0.66rem] leading-tight tracking-[0.04em] whitespace-nowrap text-grey-400 uppercase tabular-nums">
              Expected range · {formatPct(range[0])}–{formatPct(range[1])}
            </span>
          </div>
        ) : null}

        {/* The needle: this season. Slides in from the low end of the scale. */}
        {needle !== null ? (
          <motion.div
            className="absolute inset-x-0 top-0"
            initial={reduced ? false : { x: '0%', opacity: 0 }}
            whileInView={{ x: `${needle}%`, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ x: { duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.15 }, opacity: { duration: 0.3, delay: 0.15 } }}
          >
            <span
              className={`absolute top-0 flex items-center gap-1.5 rounded-full bg-pitch px-2.5 py-1 font-mono text-[0.72rem] leading-none font-semibold whitespace-nowrap text-black shadow-[0_0_24px_-4px_rgb(60_240_140/0.9)] ${chipAnchor === 'center' ? '-translate-x-1/2' : chipAnchor === 'end' ? '-translate-x-full' : ''}`}
            >
              This season {formatPct(Math.round(pct ?? 0))}
            </span>
            <span className="absolute w-[3px] -translate-x-1/2 rounded-full bg-pitch shadow-[0_0_12px_rgb(60_240_140/0.9)]" style={{ top: 24, height: RAIL_TOP - 24 + RAIL_H + 8 }} />
            <span className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-pitch-bright shadow-[0_0_14px_rgb(60_240_140/0.9)]" style={{ top: RAIL_TOP + RAIL_H / 2 }} />
          </motion.div>
        ) : null}
      </div>

      <figcaption>
        <ul className="sr-only">
          <li>This season: {pct === null ? 'no picks graded yet' : formatPct(pct)}</li>
          {BENCHMARKS.toReversed().map((b) => (
            <li key={b.id}>
              {b.description}: {formatPct(b.pct)}
            </li>
          ))}
          {range ? (
            <li>
              Normal range after {graded} picks: {formatPct(range[0])} to {formatPct(range[1])}
            </li>
          ) : null}
        </ul>
        <p className="text-[0.78rem] leading-relaxed text-grey-400">
          Reference figures measured on {BACKTEST_MATCHES.toLocaleString('en-GB')} past matches.
          {range
            ? ` The bracket is where a season’s hit rate lands 95% of the time after ${graded} picks if the model performs at its long-run level; it narrows as the season goes on.`
            : ''}
        </p>
      </figcaption>
    </figure>
  )
}
