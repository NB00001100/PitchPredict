import { useMemo } from 'react'
import { BacktestedExplainer } from '../components/premier-league/Backtested'
import { DataStatus } from '../components/premier-league/DataStatus'
import { PageHero } from '../components/premier-league/PageHero'
import { MatchweekCarousel } from '../components/premier-league/MatchweekCarousel'
import { MatchweekNavProvider } from '../components/premier-league/MatchweekNavProvider'
import { PageSkeleton } from '../components/premier-league/PageSkeleton'
import { LoadError } from '../components/premier-league/LoadError'
import { SeasonPanel } from '../components/premier-league/SeasonPanel'
import '../components/premier-league/premierLeague.css'
import { useMatchweekNav } from '../lib/matchweekNav'
import { summariseSeason, withSeason } from '../lib/season'
import type { Fixture } from '../lib/types'
import { useFixtures } from '../lib/useFixtures'

const BASE_TITLE = 'Premier League · PitchPredict'

export default function PremierLeague() {
  const { status, fixtures, error, retry, updatedAt } = useFixtures()

  return (
    <>
      <PageHero
        eyebrow={withSeason('Forecasts', fixtures)}
        status={
          status === 'ready' ? <DataStatus fixtures={fixtures} updatedAt={updatedAt} /> : <p>{status === 'loading' ? 'Loading…' : 'Data unavailable'}</p>
        }
      />
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

function Season({ fixtures }: { fixtures: readonly Fixture[] }) {
  const season = useMemo(() => summariseSeason(fixtures), [fixtures])
  return (
    <MatchweekNavProvider current={season.current} seasonOver={season.complete}>
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
