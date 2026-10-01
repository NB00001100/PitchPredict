import type { ReactNode } from 'react'
import type { OutcomeFilter } from '../../lib/results'

interface ResultsFiltersProps {
  matchweeks: readonly number[]
  matchweek: number | null
  outcome: OutcomeFilter
  onMatchweek: (mw: number | null) => void
  onOutcome: (outcome: OutcomeFilter) => void
}

const OUTCOMES: { value: OutcomeFilter; label: string }[] = [
  { value: 'all', label: 'All calls' },
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Incorrect' },
]

/** One row of filters above everything they scope: matchweek, then outcome. */
export function ResultsFilters({ matchweeks, matchweek, outcome, onMatchweek, onOutcome }: ResultsFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <FilterGroup label="Matchweek">
        <Chip pressed={matchweek === null} onClick={() => onMatchweek(null)}>
          All
        </Chip>
        {matchweeks.map((mw) => (
          <Chip key={mw} pressed={matchweek === mw} onClick={() => onMatchweek(mw)} ariaLabel={`Matchweek ${mw}`}>
            <span className="font-mono tabular-nums">{mw}</span>
          </Chip>
        ))}
      </FilterGroup>
      <FilterGroup label="Show">
        {OUTCOMES.map((o) => (
          <Chip key={o.value} pressed={outcome === o.value} onClick={() => onOutcome(o.value)}>
            {o.label}
          </Chip>
        ))}
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span aria-hidden="true" className="type-label shrink-0 text-[0.66rem] text-grey-400">
          {label}
        </span>
        <div className="glass flex max-w-full min-w-0 gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none]">{children}</div>
      </div>
    </fieldset>
  )
}

function Chip({ pressed, onClick, ariaLabel, children }: { pressed: boolean; onClick: () => void; ariaLabel?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-3 font-wide sm:px-3.5 text-[0.62rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase transition-[background-color,color,box-shadow,scale] duration-200 focus-visible:outline-offset-[-2px] active:scale-95 ${
        pressed ? 'bg-pitch text-black shadow-[0_6px_20px_-6px_rgb(60_240_140/0.7)]' : 'text-grey-200 hover:bg-glass-strong hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
