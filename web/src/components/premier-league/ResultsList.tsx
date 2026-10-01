import * as m from 'motion/react-m'
import type { ReactNode } from 'react'
import { formatDateRange } from '../../lib/dates'
import { EASE_OUT_EXPO } from '../../lib/motion'
import { RESULT_WORD, type ResultRow } from '../../lib/results'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'
import { TeamMonogram } from '../TeamMonogram'
import { Score, Teams, VerdictShell } from './FixtureCard'
import { ProbabilityBar } from './ProbabilityBar'
import { CallLabel, CorrectMark, ExactScoreMark, Scoreline } from './ResultParts'
import { ZoneLabel } from './ZoneLabel'

interface Group {
  matchweek: number
  rows: ResultRow[]
}

function groupRows(rows: readonly ResultRow[]): Group[] {
  const groups: Group[] = []
  for (const row of rows) {
    const last = groups.at(-1)
    if (last?.matchweek === row.matchweek) last.rows.push(row)
    else groups.push({ matchweek: row.matchweek, rows: [row] })
  }
  return groups
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * The rows on screen, grouped by matchweek (newest first). Wide screens get a
 * ledger table whose Predicted and Actual column groups wear the two voices;
 * narrower screens get one card per match with the same zones stacked.
 */
export function ResultsList({ rows }: { rows: readonly ResultRow[] }) {
  const groups = groupRows(rows)
  return (
    <>
      <ResultsTable groups={groups} />
      <div className="flex flex-col gap-10 xl:hidden">
        {groups.map((g) => (
          <section key={g.matchweek} aria-labelledby={`results-mw-${g.matchweek}`}>
            <GroupHeading id={`results-mw-${g.matchweek}`} group={g} />
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {g.rows.map((row, i) => (
                <Rise key={row.fixture.fixture_id} as="li" index={i}>
                  <ResultCard row={row} />
                </Rise>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

function GroupHeading({ id, group, as: Tag = 'h3' }: { id?: string; group: Group; as?: 'h3' | 'span' }) {
  const hits = group.rows.filter((r) => r.correct).length
  const range = formatDateRange(group.rows.map((r) => r.fixture))
  return (
    <Tag id={id} className="flex items-center gap-4">
      <span className="type-eyebrow whitespace-nowrap text-white">Matchweek {group.matchweek}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-hairline-strong to-transparent" />
      <span className="type-label text-[0.68rem] whitespace-nowrap text-grey-400">
        {range ? <span className="hidden sm:inline">{range} · </span> : null}
        <span className="text-white">{hits}</span> of {group.rows.length} correct
      </span>
    </Tag>
  )
}

function Rise({ as, index, children }: { as: 'li' | 'tr'; index: number; children: ReactNode }) {
  const reduced = usePrefersReducedMotion()
  const Component = as === 'li' ? m.li : m.tr
  return (
    <Component
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT_EXPO, delay: Math.min(index * 0.03, 0.35) }}
    >
      {children}
    </Component>
  )
}

/* ---------- Wide: the ledger table ---------- */

const PRED_CELL = 'bg-[rgb(150_200_255/0.035)] border-y border-dashed border-[rgb(150_200_255/0.22)]'
const ACT_CELL = 'bg-grey-800 border-y border-hairline-strong'

function ResultsTable({ groups }: { groups: Group[] }) {
  return (
    <table className="hidden w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-1.5 text-left xl:table">
      <caption className="sr-only">Results, newest matchweek first: the model’s forecast beside what actually happened</caption>
      <colgroup>
        <col className="w-[15rem]" />
        <col />
        <col className="w-[9.5rem]" />
        <col className="w-[6.5rem]" />
        <col className="w-[9rem]" />
        <col className="w-[8rem]" />
        <col className="w-[11rem]" />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2} scope="col" className="type-label pb-2 pl-4 align-bottom text-[0.68rem] font-normal text-grey-400">
            Match
          </th>
          <th colSpan={3} scope="colgroup" className="pl-cool-text relative rounded-t-xl border-x border-t border-dashed border-[rgb(150_200_255/0.3)] bg-[rgb(150_200_255/0.04)] px-4 py-2.5 font-normal after:absolute after:inset-x-[-1px] after:top-full after:h-1.5 after:border-x after:border-dashed after:border-[rgb(150_200_255/0.3)] after:bg-[rgb(150_200_255/0.04)] after:content-['']">
            <ZoneLabel zone="predicted" />
          </th>
          <th colSpan={2} scope="colgroup" className="relative rounded-t-xl border-x border-t border-hairline-strong bg-grey-800 px-4 py-2.5 font-normal after:absolute after:inset-x-[-1px] after:top-full after:h-1.5 after:border-x after:border-hairline-strong after:bg-grey-800 after:content-['']">
            <ZoneLabel zone="actual" />
          </th>
          <th rowSpan={2} scope="col" className="pb-2 pl-4 align-bottom font-normal">
            <span className="font-wide text-[0.64rem] font-bold tracking-[0.18em] text-grey-200 uppercase">Verdict</span>
          </th>
        </tr>
        <tr className="type-label text-[0.64rem] text-grey-400">
          <th scope="col" className="border-l border-dashed border-[rgb(150_200_255/0.3)] bg-[rgb(150_200_255/0.04)] px-4 pb-2 font-normal">
            Home · Draw · Away
          </th>
          <th scope="col" className="bg-[rgb(150_200_255/0.04)] px-3 pb-2 font-normal">
            Call
          </th>
          <th scope="col" className="border-r border-dashed border-[rgb(150_200_255/0.3)] bg-[rgb(150_200_255/0.04)] px-3 pb-2 font-normal">
            Likeliest
          </th>
          <th scope="col" className="border-l border-hairline-strong bg-grey-800 px-4 pb-2 font-normal">
            Score
          </th>
          <th scope="col" className="border-r border-hairline-strong bg-grey-800 px-3 pb-2 font-normal">
            Result
          </th>
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.matchweek}>
          <tr>
            <th colSpan={7} scope="rowgroup" className="px-1 pt-7 pb-2 text-left font-normal">
              <GroupHeading group={g} as="span" />
            </th>
          </tr>
          {g.rows.map((row, i) => (
            <Rise key={row.fixture.fixture_id} as="tr" index={i}>
              <TableRow row={row} />
            </Rise>
          ))}
        </tbody>
      ))}
    </table>
  )
}

function TableRow({ row }: { row: ResultRow }) {
  const { fixture } = row
  return (
    <>
      <th scope="row" className="rounded-l-xl border-y border-l border-hairline bg-glass py-3 pr-3 pl-4 text-left font-normal">
        <span className="flex flex-col gap-1.5">
          <TeamLine tla={fixture.home_tla} name={fixture.home_team} />
          <span className="sr-only"> versus </span>
          <TeamLine tla={fixture.away_tla} name={fixture.away_team} />
          <span className="mt-0.5 font-mono text-[0.66rem] tracking-[0.04em] text-grey-500 uppercase">
            <time dateTime={fixture.kickoff}>{dayFormat.format(new Date(fixture.kickoff))}</time>
          </span>
        </span>
      </th>
      <td className={`${PRED_CELL} border-l px-4 py-3 align-middle`}>
        <ProbabilityBar fixture={fixture} forecast={{ shares: row.shares, percents: row.percents, pick: row.call }} />
      </td>
      <td className={`${PRED_CELL} px-3 py-3 align-middle`}>
        <CallLabel row={row} />
      </td>
      <td className={`${PRED_CELL} border-r px-3 py-3 align-middle text-[0.95rem] text-grey-200`}>
        <span className="sr-only">Likeliest score </span>
        <Scoreline score={row.modalScore} />
      </td>
      <td className={`${ACT_CELL} border-l px-4 py-3 align-middle shadow-[inset_0_1px_0_0_rgb(255_255_255/0.1)]`}>
        <span className="sr-only">Final score </span>
        <span aria-hidden="true" className="font-display text-[1.9rem] leading-none font-extrabold text-white tabular-nums">
          {row.score[0]}
          <span className="mx-1 text-grey-500">–</span>
          {row.score[1]}
        </span>
        <span className="sr-only">{`${row.score[0]}–${row.score[1]}`}</span>
      </td>
      <td className={`${ACT_CELL} border-r px-3 py-3 align-middle text-[0.92rem] font-semibold text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.1)]`}>
        {RESULT_WORD[row.actual]}
      </td>
      <td
        className={`rounded-r-xl border-y border-r px-4 py-3 align-middle ${row.correct ? 'border-pitch/40 bg-pitch-dim/70' : 'border-miss/40 bg-miss-dim/70'}`}
      >
        <span className="flex flex-col items-start gap-2">
          <CorrectMark correct={row.correct} />
          <ExactScoreMark exact={row.exactScore} />
        </span>
      </td>
    </>
  )
}

function TeamLine({ tla, name }: { tla: string; name: string }) {
  return (
    <span className="flex items-center gap-2">
      <TeamMonogram tla={tla} size="sm" className="size-6! text-[0.5rem]!" />
      <span className="truncate text-[0.88rem] leading-tight text-white">{name}</span>
    </span>
  )
}

/* ---------- Narrow: one card per match ---------- */

function ResultCard({ row }: { row: ResultRow }) {
  const { fixture } = row
  return (
    <Panel as="article" className="grid h-full gap-2 p-2 sm:p-2.5">
      <PointerLight size={480} color="rgb(150 200 255 / 0.09)" />
      <div className="flex items-start justify-between gap-3">
        <Teams fixture={fixture} />
        <p className="shrink-0 px-2 pt-2.5 text-right font-mono text-[0.64rem] leading-snug tracking-[0.04em] text-grey-400 uppercase">
          MW {row.matchweek}
          <br />
          <time dateTime={fixture.kickoff}>{dayFormat.format(new Date(fixture.kickoff))}</time>
        </p>
      </div>
      <div className="pl-projected flex flex-col gap-3 rounded-xl p-3.5">
        <ZoneLabel zone="predicted" />
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="pl-cool-text font-mono text-[0.68rem] tracking-[0.12em] uppercase">Call</span>
            <CallLabel row={row} />
          </span>
          <span className="text-right text-[0.78rem] text-grey-400">
            Likeliest <span className="font-mono font-medium text-white">{row.modalScore ? `${row.modalScore[0]}–${row.modalScore[1]}` : '–'}</span>
          </span>
        </div>
        <ProbabilityBar fixture={fixture} forecast={{ shares: row.shares, percents: row.percents, pick: row.call }} />
      </div>
      <div className="pl-actual flex items-center justify-between gap-3 rounded-xl p-3.5" data-state="final">
        <div className="flex flex-col gap-2.5">
          <ZoneLabel zone="actual" />
          <Score fixture={fixture} score={row.score} />
        </div>
        <p className="text-right text-[0.95rem] font-semibold text-white">{RESULT_WORD[row.actual]}</p>
      </div>
      <VerdictShell tone={row.correct ? 'hit' : 'miss'}>
        <CorrectMark correct={row.correct} />
        <ExactScoreMark exact={row.exactScore} />
      </VerdictShell>
    </Panel>
  )
}
