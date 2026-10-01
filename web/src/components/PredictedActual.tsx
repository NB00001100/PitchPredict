import type { ReactNode } from 'react'
import { ArrowRightIcon } from './Icons'
import { Tag } from './Tag'

/*
 * Forecast next to result, always as two separate, labelled zones:
 *
 *   <PredictedActual>
 *     <PredictedZone>Home win · 54%</PredictedZone>
 *     <ActualZone verdict="hit">Home win · 2–1</ActualZone>
 *   </PredictedActual>
 *
 * PREDICTED is translucent glass (it was a probability, made before
 * kick-off). ACTUAL is a solid surface (it happened), with a hit/miss tag
 * that carries an icon and a word. The zones never share a background, and
 * each has its own visible label, so they cannot be read as one thing.
 */

export function PredictedActual({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr] ${className}`}>{children}</div>
  )
}

interface ZoneProps {
  children: ReactNode
  /** Overrides the default label ("Predicted" / "Actual"). */
  label?: ReactNode
  /** Small qualifier after the label, e.g. "Before kick-off". */
  when?: ReactNode
}

function ZoneLabel({ label, when, children }: { label: ReactNode; when?: ReactNode; children?: ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span className="type-label text-[0.65rem] text-grey-400">
        {label}
        {when ? <span className="text-grey-500"> · {when}</span> : null}
      </span>
      {children}
    </p>
  )
}

export function PredictedZone({ children, label = 'Predicted', when = 'Before kick-off' }: ZoneProps) {
  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-glass p-3.5">
        <ZoneLabel label={label} when={when} />
        <div className="text-sm text-white">{children}</div>
      </div>
      <span aria-hidden="true" className="hidden items-center text-grey-500 sm:flex">
        <ArrowRightIcon className="size-3.5" />
      </span>
    </>
  )
}

interface ActualZoneProps extends ZoneProps {
  /** Graded outcome. Leave out while the match is still to be played. */
  verdict?: 'hit' | 'miss'
}

export function ActualZone({ children, label = 'Actual', when = 'Full time', verdict }: ActualZoneProps) {
  const rim = verdict === 'hit' ? 'border-l-pitch' : verdict === 'miss' ? 'border-l-miss' : 'border-l-grey-700'
  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-l-2 border-hairline bg-grey-900 p-3.5 ${rim}`}>
      <ZoneLabel label={label} when={when}>
        {verdict ? <Tag tone={verdict}>{verdict === 'hit' ? 'Right' : 'Wrong'}</Tag> : null}
      </ZoneLabel>
      <div className="text-sm text-white">{children}</div>
    </div>
  )
}
