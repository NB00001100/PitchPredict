import { useMemo } from 'react'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { BacktestedExplainer } from '../components/premier-league/Backtested'
import { PageHero } from '../components/premier-league/PageHero'
import { MatchweekCarousel } from '../components/premier-league/MatchweekCarousel'
import { MatchweekNavProvider } from '../components/premier-league/MatchweekNavProvider'
import { PageSkeleton } from '../components/premier-league/PageSkeleton'
import { RetryIcon } from '../components/premier-league/icons'
import { SeasonPanel } from '../components/premier-league/SeasonPanel'
import '../components/premier-league/premierLeague.css'
import { useMatchweekNav } from '../lib/matchweekNav'
import { summariseSeason } from '../lib/season'
import type { Fixture } from '../lib/types'
import { useFixtures } from '../lib/useFixtures'

const BASE_TITLE = 'Premier League · PitchPredict'

export default function PremierLeague() {
  const { status, fixtures, error, retry } = useFixtures()

  return (
    <>
      <PageHero />
      {status === 'loading' ? (
        <>
          <title>{BASE_TITLE}</title>
          <PageSkeleton />
        </>
      ) : status === 'error' ? (
        <>
          <title>{BASE_TITLE}</title>
          <LoadError message={error.message} onRetry={retry} />
        </>
      ) : (
        <Season fixtures={fixtures} />
      )}
    </>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
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

function Season({ fixtures }: { fixtures: readonly Fixture[] }) {
  const season = useMemo(() => summariseSeason(fixtures), [fixtures])
  return (
    <MatchweekNavProvider current={season.current}>
      <SelectedTitle />
      <SeasonPanel season={season} />
      <MatchweekCarousel weeks={season.weeks} />
      <BacktestedExplainer />
    </MatchweekNavProvider>
  )
}

function SelectedTitle() {
  const { selected } = useMatchweekNav()
  return <title>{`Matchweek ${selected} · ${BASE_TITLE}`}</title>
}
