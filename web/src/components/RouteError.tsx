import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button, ButtonLink } from './Button'
import { ArrowRightIcon } from './Icons'
import { Panel } from './Panel'

/** A lazy page's code failed to download: usually a new deploy replaced the old files. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(message)
}

/**
 * Route-level error boundary. Renders inside the page shell (header and footer
 * stay), so a crash in one page never blanks the site. A failed lazy chunk,
 * the common case after a deploy, gets a reload button; anything else gets the
 * way home and the error text.
 */
export function RouteError() {
  const error = useRouteError()
  const chunk = isChunkLoadError(error)
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error)

  return (
    <>
      <title>Something went wrong · PitchPredict</title>
      <section aria-labelledby="route-error-title" className="flex min-h-[calc(100svh-76px)] items-center py-16">
        <Panel role="alert" className="flex w-full max-w-2xl flex-col items-start gap-5 border-miss/35! p-6 sm:p-8">
          <p className="type-eyebrow flex items-center gap-3 text-miss">
            <span aria-hidden="true" className="h-px w-8 bg-miss/70" />
            {chunk ? 'Out of date' : 'Stoppage'}
          </p>
          <h1 id="route-error-title" className="type-title uppercase">
            {chunk ? 'This page has been updated' : 'This page hit a problem'}
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-grey-200">
            {chunk
              ? 'The site changed since this tab opened, so part of the page couldn’t load. Reloading fetches the new version.'
              : 'Something on this page broke while it was being shown. Reloading usually fixes it; the rest of the site still works.'}
          </p>
          {detail ? (
            <p className="max-w-full rounded-lg border border-hairline bg-black/40 px-3 py-2 font-mono text-[0.75rem] break-words text-grey-400">
              {detail}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
            <ButtonLink to="/" icon={<ArrowRightIcon className="size-3.5" />}>
              Back to home
            </ButtonLink>
          </div>
        </Panel>
      </section>
    </>
  )
}
