import * as m from 'motion/react-m'
import { BACKTEST_MATCHES, BASE_RATES_RPS, BOOKMAKERS_RPS, formatPct, MODEL_BACKTEST_RPS } from '../../lib/benchmarks'
import { meterPosition, niceDomain } from '../../lib/meterScale'
import { EASE_OUT_EXPO } from '../../lib/motion'
import { SMALL_SAMPLE, type ResultsSummary as Summary } from '../../lib/results'
import type { Outcome } from '../../lib/types'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { CountUp } from '../CountUp'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'

const OUTCOME_ROWS: { key: Outcome; label: string; swatch: string }[] = [
  { key: 'H', label: 'Home wins', swatch: 'bg-home' },
  { key: 'D', label: 'Draws', swatch: 'bg-draw' },
  { key: 'A', label: 'Away wins', swatch: 'bg-away' },
]

const rps4 = (v: number) => v.toFixed(4)

/**
 * The record for whatever rows are on screen: hit rate, hit rate split by
 * what actually happened, mean RPS against long-run references, and exact
 * scores, with the honest notes about draws and small samples.
 */
export function ResultsSummary({ summary, scope }: { summary: Summary; scope: string }) {
  const { hits, n, pct, byActual, meanRps, exactScores } = summary
  return (
    <section aria-labelledby="results-summary-heading" className="mt-12 md:mt-16">
      <Panel className="p-5 sm:p-7 lg:p-10">
        <PointerLight size={720} color="rgb(60 240 140 / 0.08)" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="results-summary-heading" className="type-eyebrow flex items-center gap-3 text-pitch">
            <span aria-hidden="true" className="h-px w-8 bg-pitch/70" />
            The record
          </h2>
          <p className="type-label text-grey-400">{scope}</p>
        </div>

        <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
          {/* Hit rate and exact scores. */}
          <div className="flex flex-col gap-3">
            <p className="type-label text-grey-400">Calls correct</p>
            <p className="font-display text-[clamp(4.5rem,9vw,6.5rem)] leading-[0.8] font-extrabold tracking-[-0.02em] [font-variation-settings:'wdth'_78]">
              {pct === null ? '–' : <CountUp value={Math.round(pct)} suffix="%" duration={1.2} />}
            </p>
            <p className="text-[1.05rem] text-grey-200">
              <Num>{hits}</Num> of <Num>{n}</Num> calls correct
            </p>
            <div className="mt-2 border-t border-hairline pt-4">
              <p className="flex items-baseline gap-2 text-[0.95rem] text-grey-200">
                <span className="font-display text-[1.9rem] leading-none font-extrabold text-white tabular-nums">{exactScores}</span>
                exact {exactScores === 1 ? 'score' : 'scores'}
              </p>
              <p className="mt-1 text-[0.78rem] leading-snug text-grey-400">The likeliest scoreline was the final score.</p>
            </div>
          </div>

          {/* Split by what actually happened. */}
          <div>
            <h3 className="type-label text-grey-200">Correct, by what actually happened</h3>
            <ul className="mt-5 flex flex-col gap-4">
              {OUTCOME_ROWS.map((o) => (
                <OutcomeRate key={o.key} label={o.label} swatch={o.swatch} {...byActual[o.key]} />
              ))}
            </ul>
            <p className="mt-4 text-[0.8rem] leading-relaxed text-grey-400">
              Draws at {byActual.D.n ? '0%' : '–'} are expected: the call is the single most likely outcome, and that is
              almost never a draw.
            </p>
          </div>

          {/* RPS. */}
          <div>
            <h3 className="type-label text-grey-200">Probability score (RPS)</h3>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[2.4rem] leading-none font-semibold text-white tabular-nums">
                {meanRps === null ? '–' : rps4(meanRps)}
              </span>
              <span className="text-[0.82rem] text-grey-400">mean over these {n} matches · lower is better</span>
            </p>
            {meanRps !== null ? <RpsStrip value={meanRps} /> : null}
          </div>
        </div>

        <div className="mt-9 grid gap-3 border-t border-hairline pt-6 text-[0.88rem] leading-relaxed text-grey-200 lg:grid-cols-2 lg:gap-10">
          <p>
            The model gives every match a probability for all three outcomes. A single call, its most likely outcome,
            rarely lands on a draw, because a draw is seldom any match’s single most likely result. That is why the
            probabilities and RPS are shown, not just the call.
          </p>
          {n < SMALL_SAMPLE ? (
            <p className="text-grey-400">
              <span className="font-semibold text-grey-200">Small sample.</span> With {n}{' '}
              {n === 1 ? 'match' : 'matches'} these figures are noisy; a few results either way move them a lot. The
              references are long-run figures from {BACKTEST_MATCHES.toLocaleString('en-GB')} past matches, not this
              season’s.
            </p>
          ) : (
            <p className="text-grey-400">
              References are long-run figures from {BACKTEST_MATCHES.toLocaleString('en-GB')} past matches, not this
              season’s.
            </p>
          )}
        </div>
      </Panel>
    </section>
  )
}

function Num({ children }: { children: number }) {
  return <span className="font-mono font-semibold text-white tabular-nums">{children}</span>
}

function OutcomeRate({ label, swatch, hits, n, pct }: { label: string; swatch: string; hits: number; n: number; pct: number | null }) {
  const reduced = usePrefersReducedMotion()
  return (
    <li className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3">
      <span className="flex items-center gap-2 text-[0.88rem] text-grey-200">
        <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${swatch}`} />
        {label}
      </span>
      <span aria-hidden="true" className="relative h-2 overflow-hidden rounded-full bg-grey-800">
        {pct ? (
          <m.span
            className="absolute inset-y-0 left-0 rounded-full bg-pitch"
            style={{ width: `${pct}%`, originX: 0 }}
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          />
        ) : null}
      </span>
      <span className="min-w-[6.5rem] text-right font-mono text-[0.82rem] whitespace-nowrap text-grey-400 tabular-nums">
        <span className="text-white">{hits}</span>/{n}
        <span className="ml-2 inline-block w-[3.2rem] font-semibold text-white">{pct === null ? '–' : formatPct(Math.round(pct))}</span>
      </span>
    </li>
  )
}

const REFS = [
  { id: 'books', label: 'Bookmakers', value: BOOKMAKERS_RPS, lane: 0, anchor: 'end' },
  { id: 'model', label: 'Model, long-run', value: MODEL_BACKTEST_RPS, lane: 1, anchor: 'center' },
  { id: 'base', label: 'Base rates', value: BASE_RATES_RPS, lane: 0, anchor: 'center' },
] as const

const ANCHOR = { start: '', center: '-translate-x-1/2 items-center text-center', end: '-translate-x-full items-end text-right' } as const

/**
 * The selection's mean RPS on a short scale with the three long-run
 * references. Better is to the left; the scale stretches to fit the value.
 */
function RpsStrip({ value }: { value: number }) {
  const reduced = usePrefersReducedMotion()
  const domain = niceDomain([value], 0.02, [0.18, 0.24], 0.004)
  const at = (v: number) => meterPosition(v, domain)
  const x = at(value)
  const chip = x < 18 ? '' : x > 82 ? '-translate-x-full' : '-translate-x-1/2'
  return (
    <figure className="mt-5">
      <div aria-hidden="true" className="relative h-[8.5rem] select-none">
        <div className="absolute inset-x-0 top-9 h-1.5 rounded-full bg-grey-800 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
        {REFS.map((r) => {
          const left = `${at(r.value)}%`
          const top = r.lane === 0 ? 56 : 92
          return (
            <div key={r.id}>
              <span className={`absolute top-7 h-[1.375rem] w-0.5 -translate-x-1/2 rounded-full ${r.id === 'model' ? 'bg-white' : 'bg-grey-400'}`} style={{ left }} />
              <span className={`absolute w-px -translate-x-1/2 ${r.id === 'model' ? 'bg-white/45' : 'bg-grey-400/40'}`} style={{ left, top: 50, height: top - 52 }} />
              <span className={`absolute flex flex-col gap-0.5 whitespace-nowrap ${ANCHOR[r.anchor]}`} style={{ left, top }}>
                <span className={`text-[0.72rem] leading-tight ${r.id === 'model' ? 'font-medium text-white' : 'text-grey-200'}`}>{r.label}</span>
                <span className="font-mono text-[0.72rem] leading-tight text-grey-400 tabular-nums">{rps4(r.value)}</span>
              </span>
            </div>
          )
        })}
        <span className="absolute top-[5.75rem] left-0 font-mono text-[0.62rem] text-grey-400 uppercase">← Better</span>
        <m.div
          className="absolute inset-x-0 top-0"
          initial={reduced ? false : { x: '0%', opacity: 0 }}
          whileInView={{ x: `${x}%`, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ x: { duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.1 }, opacity: { duration: 0.3, delay: 0.1 } }}
        >
          <span className={`absolute top-0 rounded-full bg-pitch px-2.5 py-1 font-mono text-[0.7rem] leading-none font-semibold whitespace-nowrap text-black shadow-[0_0_20px_-4px_rgb(60_240_140/0.9)] ${chip}`}>
            Shown {rps4(value)}
          </span>
          <span className="absolute top-[1.4rem] h-6 w-[3px] -translate-x-1/2 rounded-full bg-pitch shadow-[0_0_10px_rgb(60_240_140/0.9)]" />
        </m.div>
      </div>
      <figcaption className="text-[0.76rem] leading-relaxed text-grey-400">
        <span className="sr-only">
          Mean RPS of the matches shown: {rps4(value)}. Long-run references on {BACKTEST_MATCHES.toLocaleString('en-GB')}{' '}
          matches: bookmakers {rps4(BOOKMAKERS_RPS)}, model {rps4(MODEL_BACKTEST_RPS)}, base rates {rps4(BASE_RATES_RPS)}.{' '}
        </span>
        Ticks: long-run references on {BACKTEST_MATCHES.toLocaleString('en-GB')} past matches. RPS rewards putting
        probability near what happened, draws included.
      </figcaption>
    </figure>
  )
}
