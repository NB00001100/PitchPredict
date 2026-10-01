import type { ReactNode } from 'react'
import { formatDateRange } from '../../lib/dates'
import type { WeekSummary } from '../../lib/season'
import type { Outcome } from '../../lib/types'
import { describeCounts, weekBreakdown, type OutcomeCounts, type WeekBreakdownRow } from '../../lib/weekBreakdown'
import { CheckIcon, CrossIcon } from '../Icons'
import { Panel } from '../Panel'
import { ZoneLabel } from './ZoneLabel'

const STATUS: Record<WeekSummary['status'], string> = {
  played: 'Played',
  'in-progress': 'In progress',
  upcoming: 'Upcoming',
}

/** "Matchweek 6", its status and date range. */
export function MatchweekTitle({ week, isCurrent }: { week: WeekSummary; isCurrent: boolean }) {
  const range = formatDateRange(week.fixtures)
  const count = week.fixtures.length
  return (
    <div className="flex flex-col gap-3">
      <p className="type-eyebrow flex items-center gap-3 text-pitch">
        <span aria-hidden="true" className="h-px w-8 bg-pitch/70" />
        {isCurrent ? `This week · ${STATUS[week.status]}` : STATUS[week.status]}
      </p>
      <h2 id="matchweek-heading" className="type-headline whitespace-nowrap">
        Matchweek <span className="text-glow">{week.matchweek}</span>
      </h2>
      <p className="type-label text-grey-200">
        {range ?? 'Dates to be confirmed'}
        {count ? <span className="text-grey-400"> · {count} {count === 1 ? 'match' : 'matches'}</span> : null}
      </p>
    </div>
  )
}

const RESULT_NOUNS: Record<Outcome, readonly [string, string]> = {
  H: ['home win', 'home wins'],
  D: ['draw', 'draws'],
  A: ['away win', 'away wins'],
}

/**
 * The matchweek in three aligned rows: what we predicted (each match's pick),
 * what actually happened (each result), and the verdict. Columns line up
 * match by match in kickoff order, so a hit is a column whose two letters
 * agree. Counts per outcome sit at the end of each row in the same Home /
 * Draw / Away columns, so the two splits compare straight down. The strip is
 * a picture of the sentence that screen readers get instead.
 */
export function WeekBreakdownPanel({ week }: { week: WeekSummary }) {
  const b = weekBreakdown(week.fixtures)
  const { rate } = week
  const n = b.rows.length

  const predictedNote =
    b.forecasts === 0 ? 'Forecasts are published before the matchweek.' : b.forecasts < n ? `${b.forecasts} of ${n} forecast` : null
  const actualNote = b.finished === 0 ? (n ? 'Nothing played yet.' : null) : b.finished < n ? `${b.finished} of ${n} played` : null

  const summary = [
    b.forecasts === 0
      ? 'No forecasts yet for this matchweek.'
      : `What we predicted: ${describeCounts(b.picks, RESULT_NOUNS)}${b.picks.D === 0 ? ', no draws' : ''}.`,
    b.finished === 0 ? 'Nothing played yet.' : `What happened: ${describeCounts(b.results, RESULT_NOUNS)}.`,
    rate.total > 0 ? `${rate.hits} of ${rate.total} picks correct.` : '',
  ].join(' ')

  return (
    <Panel className="p-3 sm:p-4">
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Row
          frame="pl-projected"
          label={<ZoneLabel zone="predicted">What we predicted</ZoneLabel>}
          note={predictedNote}
          cells={b.rows.map((r) => (
            <PickCell key={r.fixtureId} outcome={r.pick} />
          ))}
          n={n}
          aside={<Counts counts={b.picks} empty={b.forecasts === 0} />}
        />
        <Row
          frame="pl-actual"
          label={<ZoneLabel zone="actual">What happened</ZoneLabel>}
          note={actualNote}
          cells={b.rows.map((r) => (
            <ResultCell key={r.fixtureId} outcome={r.actual} />
          ))}
          n={n}
          aside={<Counts counts={b.results} empty={b.finished === 0} bright />}
        />
        <Row
          frame="border border-transparent"
          label={<span className="font-wide text-[0.64rem] leading-none font-bold tracking-[0.18em] text-grey-200 uppercase">Verdict</span>}
          note={rate.total === 0 ? 'Graded at full time.' : null}
          cells={b.rows.map((r) => (
            <VerdictCell key={r.fixtureId} row={r} />
          ))}
          n={n}
          aside={<Score hits={rate.hits} total={rate.total} />}
        />
      </div>
      <p aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 font-mono text-[0.66rem] tracking-[0.06em] text-grey-400 uppercase">
        <span>
          <b className="font-semibold text-grey-200">H</b> home win
        </span>
        <span>
          <b className="font-semibold text-grey-200">D</b> draw
        </span>
        <span>
          <b className="font-semibold text-grey-200">A</b> away win
        </span>
        <span className="text-grey-500">Columns: each match, in kickoff order</span>
      </p>
    </Panel>
  )
}

interface RowProps {
  frame: string
  label: ReactNode
  note: string | null
  cells: ReactNode[]
  n: number
  aside: ReactNode
}

function Row({ frame, label, note, cells, n, aside }: RowProps) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-lg px-3 py-2.5 md:grid-cols-[10.5rem_minmax(0,1fr)_9.5rem] ${frame}`}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {label}
        {note ? <span className="text-[0.72rem] leading-tight text-grey-400 md:hidden">{note}</span> : null}
      </div>
      <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-1 md:col-start-2">
        {n ? (
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {cells}
          </div>
        ) : null}
        {note ? <span className="mt-1.5 hidden text-[0.72rem] leading-tight text-grey-400 md:block">{note}</span> : null}
      </div>
      <div className="col-start-2 row-start-1 justify-self-end md:col-start-3">{aside}</div>
    </div>
  )
}

const CELL = 'flex h-7 min-w-0 items-center justify-center rounded-[5px] font-mono text-[0.72rem] leading-none font-semibold'

const OUTLINE: Record<Outcome, string> = {
  H: 'border-home/80 bg-home/12',
  D: 'border-draw bg-draw/15',
  A: 'border-away/80 bg-away/12',
}

const SOLID: Record<Outcome, string> = {
  H: 'bg-home text-black',
  D: 'bg-draw text-white',
  A: 'bg-away text-black',
}

function PickCell({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return <span className={`${CELL} border border-dashed border-[rgb(150_200_255/0.2)]`} />
  return <span className={`${CELL} border border-dashed text-white ${OUTLINE[outcome]}`}>{outcome}</span>
}

function ResultCell({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return <span className={`${CELL} bg-black/30 text-grey-500`}>·</span>
  return <span className={`${CELL} shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3)] ${SOLID[outcome]}`}>{outcome}</span>
}

function VerdictCell({ row }: { row: WeekBreakdownRow }) {
  if (row.hit === null) return <span className={`${CELL} text-grey-700`}>·</span>
  return row.hit ? (
    <span className={`${CELL} text-pitch`}>
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-pitch text-black">
        <CheckIcon className="size-3" strokeWidth={2.6} />
      </span>
    </span>
  ) : (
    <span className={`${CELL} text-miss`}>
      <span className="inline-flex size-5 items-center justify-center rounded-full border border-miss/70 bg-miss-dim">
        <CrossIcon className="size-3" strokeWidth={2.4} />
      </span>
    </span>
  )
}

function Counts({ counts, empty, bright = false }: { counts: OutcomeCounts; empty: boolean; bright?: boolean }) {
  return (
    <span className="grid grid-cols-3 gap-x-3 font-mono text-[0.78rem] leading-none whitespace-nowrap tabular-nums md:w-full">
      {(['H', 'D', 'A'] as const).map((o) => (
        <span key={o} className="text-right">
          <span className="text-grey-500">{o} </span>
          <span className={empty ? 'text-grey-500' : bright ? 'font-semibold text-white' : 'pl-cool-text font-medium'}>
            {empty ? '–' : counts[o]}
          </span>
        </span>
      ))}
    </span>
  )
}

function Score({ hits, total }: { hits: number; total: number }) {
  if (total === 0) return <span className="font-mono text-[0.78rem] text-grey-500">–</span>
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-display text-[1.6rem] leading-none font-extrabold text-white tabular-nums">
        {hits}
        <span className="text-grey-500">/{total}</span>
      </span>
      <span className="font-wide text-[0.6rem] font-semibold tracking-[0.16em] text-grey-200 uppercase">correct</span>
    </span>
  )
}

