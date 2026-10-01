import { formatPct } from '../../lib/benchmarks'
import { CALL_WORD, type ResultRow } from '../../lib/results'
import { CheckIcon, CrossIcon } from '../Icons'

/*
 * Small pieces shared by the results table and the results cards, in the
 * same two voices as the matchweek view: cool and mono for what the model
 * said, solid and bright for what happened.
 */

/** The model's call as Home / Draw / Away, the team underneath, and the lean-draw flag. */
export function CallLabel({ row }: { row: ResultRow }) {
  const { call, fixture } = row
  const team = call === 'H' ? fixture.home_team : call === 'A' ? fixture.away_team : null
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[0.95rem] leading-none font-semibold text-white">{CALL_WORD[call]}</span>
        {row.leanDraw ? <LeanDrawTag pDraw={row.shares.D} /> : null}
      </span>
      {team ? <span className="text-[0.75rem] leading-tight text-grey-400">{team}</span> : null}
    </span>
  )
}

/** Marks a call that wasn't a draw but nearly was. Explained in its accessible name. */
export function LeanDrawTag({ pDraw }: { pDraw: number }) {
  return (
    <span
      title={`Draw was close: ${formatPct(pDraw * 100)}`}
      className="pl-cool-text inline-flex h-5 items-center rounded-full border border-dashed border-[rgb(150_200_255/0.5)] px-2 font-mono text-[0.6rem] leading-none tracking-[0.08em] whitespace-nowrap uppercase"
    >
      Lean draw
      <span className="sr-only">: the draw was close to the top probability, or above 30%</span>
    </span>
  )
}

/** Correct or incorrect: icon, word and colour together. */
export function CorrectMark({ correct, size = 'md' }: { correct: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-wide font-bold tracking-[0.14em] uppercase ${size === 'sm' ? 'text-[0.62rem]' : 'text-[0.7rem]'} ${correct ? 'text-pitch' : 'text-miss'}`}
    >
      <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-black ${correct ? 'bg-pitch' : 'bg-miss'}`}>
        {correct ? <CheckIcon className="size-3" strokeWidth={2.6} /> : <CrossIcon className="size-3" strokeWidth={2.6} />}
      </span>
      {correct ? 'Correct' : 'Incorrect'}
    </span>
  )
}

/** Whether the likeliest scoreline was the final score. */
export function ExactScoreMark({ exact }: { exact: boolean }) {
  return exact ? (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-pitch">
      <CheckIcon className="size-3.5" strokeWidth={2.2} />
      Exact score
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-grey-400">
      <span aria-hidden="true" className="inline-block w-3.5 text-center">
        –
      </span>
      Score not exact
    </span>
  )
}

/** "1–0" with an en dash, in mono. */
export function Scoreline({ score }: { score: [number, number] | null }) {
  if (!score) return <span className="font-mono text-grey-500">–</span>
  return (
    <span className="font-mono tabular-nums">
      {score[0]}–{score[1]}
    </span>
  )
}
