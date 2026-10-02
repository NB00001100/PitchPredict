import type { ReactNode } from 'react'
import { Panel } from '../Panel'
import { PointerLight } from '../PointerLight'
import { Reveal, RevealItem } from '../Reveal'
import { CheckIcon } from '../Icons'
import { ActualZone, PredictedActual, PredictedZone, VerdictZone } from '../PredictedActual'

interface Step {
  title: string
  body: string
  art: ReactNode
}

/** Attack and defence ratings as two pairs of bars. */
function RatingsArt() {
  const rows = [
    { team: 'Team A', attack: 0.82, defence: 0.64 },
    { team: 'Team B', attack: 0.55, defence: 0.78 },
  ]
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.team} className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3 gap-y-1.5">
          <span className="type-label row-span-2 text-[0.6rem] text-grey-400">{r.team}</span>
          <span className="h-1.5 origin-left rounded-r-full bg-pitch" style={{ width: `${r.attack * 100}%` }} />
          <span className="h-1.5 origin-left rounded-r-full bg-grey-400" style={{ width: `${r.defence * 100}%` }} />
        </div>
      ))}
      <p className="type-label flex gap-4 text-[0.6rem] text-grey-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-pitch" />
          Attack
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-grey-400" />
          Defence
        </span>
      </p>
    </div>
  )
}

/** A small scoreline grid: brighter cells are likelier scores. */
function ScorelineArt() {
  const goals = [0, 1, 2, 3]
  // An illustrative shape (not real data): mass near 1–0, 1–1, 2–1.
  const p = (h: number, a: number) => Math.exp(-((h - 1.3) ** 2) / 1.6 - ((a - 0.9) ** 2) / 1.2)
  return (
    <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1 font-mono text-[0.6rem] text-grey-500">
      <span />
      {goals.map((a) => (
        <span key={a} className="text-center">
          {a}
        </span>
      ))}
      {goals.map((h) => (
        <div key={h} className="contents">
          <span className="pr-1 text-right">{h}</span>
          {goals.map((a) => (
            <span
              key={a}
              className="aspect-[2/1] rounded-[3px] bg-pitch"
              style={{ opacity: 0.08 + p(h, a) * 0.85 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** An illustrative graded pick (not real data): forecast, result and verdict kept apart, as on the forecast pages. */
function GradeArt() {
  return (
    <PredictedActual className="grid-cols-2!">
      <PredictedZone className="gap-1.5 p-2.5">
        <span className="text-[0.8rem] text-white">
          Home win <span className="font-mono text-grey-200">54%</span>
        </span>
      </PredictedZone>
      <ActualZone className="gap-1.5 p-2.5">
        <span className="text-[0.8rem] text-white">
          Home win <span className="font-mono text-grey-200">2–1</span>
        </span>
      </ActualZone>
      <VerdictZone tone="hit" className="col-span-2 px-2.5! py-2!">
        <span className="inline-flex items-center gap-2 font-wide text-[0.66rem] font-bold tracking-[0.16em] text-pitch uppercase">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-pitch text-black">
            <CheckIcon className="size-3" strokeWidth={2.4} />
          </span>
          Hit
        </span>
      </VerdictZone>
    </PredictedActual>
  )
}

const STEPS: Step[] = [
  {
    title: 'Learn team strengths',
    body: 'Every team gets an attack rating and a defence rating, learned from past scorelines only, with recent matches counting more.',
    art: <RatingsArt />,
  },
  {
    title: 'Work out the score',
    body: 'Two teams’ ratings give the goals each side should expect, which gives the chance of every possible scoreline, and from those, each result.',
    art: <ScorelineArt />,
  },
  {
    title: 'Publish, then grade',
    body: 'Home, draw and away chances go up before kick-off. After the match, each pick is marked right or wrong, in full view.',
    art: <GradeArt />,
  },
]

/** The three-step "how it works" teaser on the landing page. */
export function Steps() {
  return (
    <Reveal as="ol" stagger className="relative mt-14 grid gap-4 md:grid-cols-3">
      {STEPS.map((step, i) => (
        <RevealItem as="li" key={step.title}>
          <Panel className="flex h-full flex-col gap-6 p-6 md:p-7">
            <PointerLight />
            <div className="flex items-center justify-between">
              <span className="font-display text-5xl leading-none font-extrabold text-transparent [-webkit-text-stroke:1px_var(--color-pitch)] [font-variation-settings:'wdth'_70]">
                0{i + 1}
              </span>
              <span aria-hidden="true" className="h-px flex-1 translate-x-3 bg-gradient-to-r from-hairline-strong to-transparent" />
            </div>
            <div aria-hidden="true" className="flex h-40 flex-col justify-center rounded-xl border border-hairline bg-black/40 p-4">
              {step.art}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="type-title">{step.title}</h3>
              <p className="text-sm leading-relaxed text-grey-200">{step.body}</p>
            </div>
          </Panel>
        </RevealItem>
      ))}
    </Reveal>
  )
}
