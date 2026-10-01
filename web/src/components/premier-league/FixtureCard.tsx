import type { ReactNode } from 'react'
import { formatKickoffTime } from '../../lib/dates'
import { fixtureView, type FixtureView, type ForecastView } from '../../lib/fixtureView'
import { resultLabel } from '../../lib/probability'
import type { Fixture } from '../../lib/types'
import { actualOutcome } from '../../lib/weekBreakdown'
import { CheckIcon, CrossIcon } from '../Icons'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'
import { Tag } from '../Tag'
import { TeamMonogram } from '../TeamMonogram'
import { BacktestedTag } from './Backtested'
import { ClockIcon } from './icons'
import { ProbabilityBar } from './ProbabilityBar'
import { ZoneLabel } from './ZoneLabel'

/**
 * One fixture, in four parts that keep the same order in every state so the
 * eye learns them: the teams; PREDICTED (the model's forecast, in the cool,
 * dashed, projected voice); ACTUAL (what happened, solid and bright); and the
 * verdict that connects the two. Phones stack the parts; wide screens lay
 * them out as one row, so a column of cards reads like a ledger.
 */
export function FixtureCard({ fixture, delay = 0 }: { fixture: Fixture; delay?: number }) {
  const view = fixtureView(fixture)
  return (
    <Panel
      as="article"
      className="grid h-full gap-2 p-2 transition-[border-color] duration-300 hover:border-hairline-strong sm:p-2.5 lg:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)_minmax(0,13rem)_minmax(0,10.5rem)] lg:gap-2.5"
    >
      <PointerLight size={520} color="rgb(150 200 255 / 0.09)" />
      <Teams view={view} />
      <Predicted view={view} delay={delay} />
      <Actual view={view} />
      <Verdict view={view} />
    </Panel>
  )
}

/* ---------- Teams ---------- */

function Teams({ view }: { view: FixtureView }) {
  const { fixture } = view
  return (
    <h4 className="flex flex-col justify-center gap-2 px-2 pt-2 pb-1 lg:py-2">
      <TeamRow tla={fixture.home_tla} name={fixture.home_team} side="Home" />
      <span className="sr-only"> versus </span>
      <TeamRow tla={fixture.away_tla} name={fixture.away_team} side="Away" />
    </h4>
  )
}

function TeamRow({ tla, name, side }: { tla: string; name: string; side: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <TeamMonogram tla={tla} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[0.98rem] leading-tight font-medium text-white" title={name}>
        {name}
      </span>
      <span aria-hidden="true" className="font-mono text-[0.62rem] tracking-[0.12em] text-grey-500 uppercase lg:hidden">
        {side}
      </span>
    </span>
  )
}

/* ---------- Predicted ---------- */

function Predicted({ view, delay }: { view: FixtureView; delay: number }) {
  const { forecast } = view
  return (
    <div className="pl-projected flex flex-col gap-3 rounded-xl p-3.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <ZoneLabel zone="predicted" />
        {forecast?.backtested ? <BacktestedTag /> : null}
      </div>
      {forecast ? <Forecast view={view} forecast={forecast} delay={delay} /> : <NoForecast finished={view.phase === 'finished'} />}
    </div>
  )
}

function Forecast({ view, forecast, delay }: { view: FixtureView; forecast: ForecastView; delay: number }) {
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 leading-snug">
        <span className="pl-cool-text font-mono text-[0.68rem] tracking-[0.12em] uppercase">Pick</span>
        <span className="text-[0.98rem] font-semibold text-white">{forecast.pickLabel}</span>
      </p>
      <ProbabilityBar fixture={view.fixture} forecast={forecast} delay={delay} />
      <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.78rem] leading-none">
        <Fact term="Likeliest score">{forecast.likeliestScore ?? '–'}</Fact>
        <Fact term="Expected goals">{forecast.expectedGoals ? forecast.expectedGoals.join(' – ') : '–'}</Fact>
      </dl>
    </>
  )
}

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-grey-400">{term}</dt>
      <dd className="font-mono font-medium text-white tabular-nums">{children}</dd>
    </div>
  )
}

function NoForecast({ finished }: { finished: boolean }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 py-1">
      <p className="text-[0.95rem] font-medium text-grey-200">{finished ? 'No forecast was published' : 'Forecast to come'}</p>
      <p className="text-[0.8rem] leading-snug text-grey-400">
        {finished ? 'This match isn’t graded.' : 'Published before the matchweek kicks off.'}
      </p>
    </div>
  )
}

/* ---------- Actual ---------- */

function Actual({ view }: { view: FixtureView }) {
  const { fixture, phase, score } = view
  const pending = phase !== 'finished'
  return (
    <div className="pl-actual flex flex-col gap-2.5 rounded-xl p-3.5" data-state={pending ? 'pending' : 'final'}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <ZoneLabel zone="actual" />
        <ActualStatus view={view} />
      </div>
      {score ? (
        <Score fixture={fixture} score={score} dim={phase !== 'finished'} />
      ) : phase === 'scheduled' ? (
        <p className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[0.8rem] text-grey-200">
            <ClockIcon className="size-3.5" />
            Awaiting kickoff
          </span>
          <time dateTime={fixture.kickoff} className="font-mono text-[1.6rem] leading-none font-medium text-grey-200 tabular-nums">
            {formatKickoffTime(fixture.kickoff)}
          </time>
        </p>
      ) : (
        <p className="text-[0.95rem] font-medium text-grey-200">{NO_SCORE_TEXT[phase] ?? 'No score yet'}</p>
      )}
      <ResultLine view={view} />
    </div>
  )
}

const NO_SCORE_TEXT: Partial<Record<FixtureView['phase'], string>> = {
  live: 'In play',
  postponed: 'Not played',
  cancelled: 'Not played',
  suspended: 'Stopped',
}

function ActualStatus({ view }: { view: FixtureView }) {
  const { phase } = view
  if (phase === 'live') return <Tag tone="live">Live</Tag>
  const text =
    phase === 'finished'
      ? 'Full time'
      : phase === 'scheduled'
        ? null
        : phase === 'postponed'
          ? 'Postponed'
          : phase === 'suspended'
            ? 'Suspended'
            : 'Cancelled'
  if (!text) return null
  return (
    <span className={`font-wide text-[0.6rem] font-semibold tracking-[0.16em] uppercase ${phase === 'finished' ? 'text-grey-200' : 'text-grey-400'}`}>
      {text}
    </span>
  )
}

function Score({ fixture, score, dim }: { fixture: Fixture; score: [number, number]; dim: boolean }) {
  return (
    <p className="flex items-center gap-3">
      <span className="sr-only">{`${fixture.home_team} ${score[0]}, ${fixture.away_team} ${score[1]}`}</span>
      <span aria-hidden="true" translate="no" className="font-mono text-[0.72rem] tracking-[0.08em] text-grey-400">
        {fixture.home_tla}
      </span>
      <span
        aria-hidden="true"
        className={`font-display text-[2.6rem] leading-[0.85] font-extrabold tabular-nums ${dim ? 'text-grey-200' : 'text-white'}`}
      >
        {score[0]}
        <span className="mx-1.5 text-grey-500">–</span>
        {score[1]}
      </span>
      <span aria-hidden="true" translate="no" className="font-mono text-[0.72rem] tracking-[0.08em] text-grey-400">
        {fixture.away_tla}
      </span>
    </p>
  )
}

function ResultLine({ view }: { view: FixtureView }) {
  const { fixture, phase } = view
  if (phase === 'finished') {
    const outcome = view.result?.outcome ?? actualOutcome(fixture)
    return outcome ? <p className="text-[0.95rem] leading-snug font-semibold text-white">{resultLabel(fixture, outcome)}</p> : null
  }
  const text: Partial<Record<FixtureView['phase'], string>> = {
    postponed: 'New date to be confirmed.',
    cancelled: 'This match won’t be played.',
    suspended: 'Play was stopped; it may resume later.',
    live: 'Score updates when the feed does.',
  }
  return text[phase] ? <p className="text-[0.8rem] leading-snug text-grey-400">{text[phase]}</p> : null
}

/* ---------- Verdict ---------- */

function Verdict({ view }: { view: FixtureView }) {
  const { result, forecast, phase } = view
  if (result) {
    const hit = result.hit
    return (
      <VerdictShell tone={hit ? 'hit' : 'miss'}>
        <span className={`inline-flex items-center gap-2 font-wide text-[0.78rem] font-bold tracking-[0.16em] uppercase ${hit ? 'text-pitch' : 'text-miss'}`}>
          <span className={`inline-flex size-6 items-center justify-center rounded-full text-black ${hit ? 'bg-pitch' : 'bg-miss'}`}>
            {hit ? <CheckIcon className="size-3.5" strokeWidth={2.4} /> : <CrossIcon className="size-3.5" strokeWidth={2.4} />}
          </span>
          <span>
            <span className="sr-only">Verdict: </span>
            {hit ? 'Hit' : 'Miss'}
          </span>
        </span>
        <span className="text-[0.82rem] leading-snug text-grey-200">
          Model gave this result <span className="font-mono font-semibold whitespace-nowrap text-white tabular-nums">{result.percentGiven}%</span>
        </span>
      </VerdictShell>
    )
  }
  const text = !forecast
    ? phase === 'finished'
      ? 'Not graded'
      : 'Graded at full time'
    : phase === 'postponed' || phase === 'cancelled'
      ? 'Not graded'
      : 'Graded at full time'
  return (
    <VerdictShell tone="pending">
      <span className="inline-flex items-center gap-2 text-[0.82rem] text-grey-400">
        <ClockIcon className="size-4 shrink-0" />
        <span>
          <span className="sr-only">Verdict: </span>
          {text}
        </span>
      </span>
    </VerdictShell>
  )
}

const VERDICT_TONE = {
  hit: 'border-pitch/45 bg-pitch-dim/80 shadow-[inset_0_1px_0_0_rgb(60_240_140/0.25)]',
  miss: 'border-miss/45 bg-miss-dim/80 shadow-[inset_0_1px_0_0_rgb(255_107_112/0.22)]',
  pending: 'border-hairline bg-black/20',
} as const

function VerdictShell({ tone, children }: { tone: keyof typeof VERDICT_TONE; children: ReactNode }) {
  return (
    <p
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 lg:flex-col lg:flex-nowrap lg:items-start lg:justify-center ${VERDICT_TONE[tone]}`}
    >
      {children}
    </p>
  )
}
