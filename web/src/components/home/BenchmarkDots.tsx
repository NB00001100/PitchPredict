import * as m from 'motion/react-m'
import { BASE_RATES_PCT, BOOKMAKERS_PCT, MODEL_BACKTEST_PCT } from '../../lib/benchmarks'
import { EASE_OUT_EXPO } from '../../lib/motion'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'

const MIN = 40
const MAX = 60
const at = (pct: number) => `${((pct - MIN) / (MAX - MIN)) * 100}%`

const MARKS = [
  { key: 'base', label: 'Base rates', pct: BASE_RATES_PCT, dot: 'border border-grey-400 bg-black', above: false },
  { key: 'model', label: 'Model', pct: MODEL_BACKTEST_PCT, dot: 'bg-pitch shadow-[0_0_10px_rgb(60_240_140/0.8)]', above: true },
  { key: 'books', label: 'Bookmakers', pct: BOOKMAKERS_PCT, dot: 'bg-white', above: false },
] as const

/**
 * Where the model's 51.7% sits between guessing (42.9%) and the market
 * (54.6%), on a 40–60% strip. Each dot is labelled, so nothing rests on
 * colour; the same figures are in the card's caption, so this is aria-hidden.
 */
export function BenchmarkDots() {
  const reduced = usePrefersReducedMotion()
  return (
    <div aria-hidden="true" className="relative pt-6 pb-9">
      <div className="relative h-px bg-grey-700">
        {MARKS.map((mark, i) => (
          <m.span
            key={mark.key}
            className="absolute top-1/2"
            style={{ left: at(mark.pct) }}
            initial={reduced ? false : { opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.4 + i * 0.12 }}
          >
            <span className={`absolute -top-[5px] -left-[5px] size-2.5 rounded-full ${mark.dot}`} />
            <span
              className={`type-label absolute -translate-x-1/2 text-[0.6rem] whitespace-nowrap ${mark.above ? 'bottom-3 text-pitch' : 'top-3 text-grey-400'} ${mark.key === 'books' ? 'translate-x-[-70%]' : ''}`}
            >
              {mark.label}
            </span>
          </m.span>
        ))}
      </div>
      <div className="type-label absolute inset-x-0 bottom-0 flex justify-between text-[0.6rem] text-grey-500">
        <span>{MIN}%</span>
        <span>{MAX}%</span>
      </div>
    </div>
  )
}
