import { Button } from '../Button'
import { Panel } from '../Panel'
import { RetryIcon } from './icons'

/** On-brand failure panel with the underlying message and a retry. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Panel role="alert" className="mt-12 flex flex-col items-start gap-5 border-miss/35! p-6 sm:p-8 md:mt-16">
      <p className="type-eyebrow flex items-center gap-3 text-miss">
        <span aria-hidden="true" className="h-px w-8 bg-miss/70" />
        No signal
      </p>
      <p className="type-title uppercase">Couldn’t load the forecasts</p>
      <p className="max-w-prose text-sm leading-relaxed text-grey-200">
        The forecasts live in a database this page reads directly, and that request failed. It’s usually brief.
      </p>
      <p className="max-w-prose rounded-lg border border-hairline bg-black/40 px-3 py-2 font-mono text-[0.75rem] break-words text-grey-400">
        {message}
      </p>
      <Button variant="primary" onClick={onRetry} icon={<RetryIcon className="size-4" />}>
        Try again
      </Button>
    </Panel>
  )
}
