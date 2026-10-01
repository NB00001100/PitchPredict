import { expectedRange, seasonVerdict, type SeasonVerdict } from '../../lib/benchmarks'
import type { SeasonSummary } from '../../lib/season'
import { CountUp } from '../CountUp'
import { ArrowRightIcon } from '../Icons'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'
import { TextLink } from '../TextLink'
import { HitRateMeter } from './HitRateMeter'
import { MatchweekBars } from './MatchweekBars'

const VERDICT: Record<Exclude<SeasonVerdict, 'none'>, string> = {
  below: 'Below the range expected',
  within: 'Within the range expected',
  above: 'Above the range expected',
}

/** Brings the carousel into view after a jump from the matchweek chart. */
function revealCarousel() {
  const target = document.getElementById('matchweek')
  if (!target) return
  const { top } = target.getBoundingClientRect()
  if (top < 0 || top > window.innerHeight * 0.6) {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }
}

/**
 * The season's record, as an instrument panel: the hit rate as the anchor
 * figure, the meter that puts it in context, the per-matchweek chart, and
 * the honest note about draws.
 */
export function SeasonPanel({ season }: { season: SeasonSummary }) {
  const { rate, weeks, drawnMisses } = season
  const verdict = seasonVerdict(rate.pct, rate.total)
  const range = expectedRange(rate.total)
  const misses = rate.total - rate.hits
  const seasonMatches = weeks.reduce((n, w) => n + w.fixtures.length, 0)

  return (
    <section aria-labelledby="season-heading" className="mt-12 md:mt-16">
      <Panel className="p-5 sm:p-7 lg:p-10">
        <PointerLight size={720} color="rgb(60 240 140 / 0.08)" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-32 -z-10 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(60_240_140/0.10),transparent)]"
        />
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-16">
          <SeasonFigure pct={rate.pct} hits={rate.hits} total={rate.total} verdict={verdict} />
          <HitRateMeter pct={rate.pct} graded={rate.total} />
        </div>

        <div aria-hidden="true" className="my-9 h-px bg-gradient-to-r from-transparent via-hairline-strong to-transparent" />

        <MatchweekBars weeks={weeks} onJump={revealCarousel} />

        <p className="mt-9 max-w-[46rem] text-[0.9rem] leading-relaxed text-grey-200">
          The pick is the model’s most likely outcome, and that is never a draw: a draw is almost never the single
          most likely result of a match. So every drawn match counts as a miss
          {rate.total > 0 ? (
            <>
              {' '}
              (<span className="font-mono text-white tabular-nums">{drawnMisses}</span> of the{' '}
              <span className="font-mono text-white tabular-nums">{misses}</span> misses so far)
            </>
          ) : null}
          .{range && rate.total < seasonMatches ? ' Small samples swing a lot, so read the needle against the bracket.' : ''}{' '}
          <TextLink to="/about" className="inline-flex items-center gap-1 whitespace-nowrap text-white">
            How it works
            <ArrowRightIcon className="size-3.5" />
          </TextLink>
        </p>
      </Panel>
    </section>
  )
}

interface SeasonFigureProps {
  pct: number | null
  hits: number
  total: number
  verdict: SeasonVerdict
}

function SeasonFigure({ pct, hits, total, verdict }: SeasonFigureProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 id="season-heading" className="type-eyebrow flex items-center gap-3 text-pitch">
        <span aria-hidden="true" className="h-px w-8 bg-pitch/70" />
        Season hit rate
      </h2>
      {pct === null || verdict === 'none' ? (
        <>
          <p className="font-display text-[clamp(5rem,12vw,8.5rem)] leading-[0.82] font-extrabold text-grey-500">–</p>
          <p className="text-lg text-grey-200">No results to score yet.</p>
          <p className="text-sm text-grey-400">The hit rate starts counting once the first forecast match is played.</p>
        </>
      ) : (
        <>
          <p className="font-display text-[clamp(5.5rem,12vw,9rem)] leading-[0.8] font-extrabold tracking-[-0.02em] text-white [font-variation-settings:'wdth'_78]">
            <CountUp value={Math.round(pct)} suffix="%" duration={1.4} />
          </p>
          <p className="text-[1.1rem] text-grey-200">
            <span className="font-mono font-semibold text-white tabular-nums">{hits}</span> of{' '}
            <span className="font-mono font-semibold text-white tabular-nums">{total}</span> picks correct
          </p>
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline-strong bg-black/40 px-3 py-1.5 text-[0.8rem] text-grey-200">
            <span aria-hidden="true" className="inline-block h-2.5 w-3.5 rounded-b-[2px] border-x border-b border-grey-200" />
            {VERDICT[verdict]} after {total} picks
          </p>
        </>
      )}
    </div>
  )
}
