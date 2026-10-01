import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigError } from './supabase'
import { toFixture, type Fixture, type FixtureRow } from './types'

export type FixturesState =
  | { status: 'loading'; fixtures: readonly Fixture[]; error: null }
  | { status: 'ready'; fixtures: readonly Fixture[]; error: null }
  | { status: 'error'; fixtures: readonly Fixture[]; error: Error }

export type UseFixturesResult = FixturesState & {
  /** Discards any cached failure and fetches again. */
  retry: () => void
}

const VIEW = 'matchweek_predictions'

async function fetchFixtures(): Promise<Fixture[]> {
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.')
  const { data, error } = await supabase
    .from(VIEW)
    .select('*')
    .order('matchweek', { ascending: true })
    .order('kickoff', { ascending: true })
    .order('fixture_id', { ascending: true })
  if (error) throw new Error(`Could not load fixtures: ${error.message}`)
  return (data as FixtureRow[]).map(toFixture)
}

/*
 * One request per page load, shared by every component and route that calls
 * the hook. A failed request is dropped from the cache so `retry` refetches.
 */
let request: Promise<Fixture[]> | null = null
let loaded: Fixture[] | null = null

function loadFixtures(): Promise<Fixture[]> {
  request ??= fetchFixtures().then(
    (fixtures) => {
      loaded = fixtures
      return fixtures
    },
    (error: unknown) => {
      request = null
      throw error instanceof Error ? error : new Error(String(error))
    },
  )
  return request
}

const EMPTY: readonly Fixture[] = []

function initialState(): FixturesState {
  return loaded
    ? { status: 'ready', fixtures: loaded, error: null }
    : { status: 'loading', fixtures: EMPTY, error: null }
}

/**
 * Loads all fixtures of the season (380 rows), ordered by matchweek, then
 * kickoff. Safe under StrictMode: the request is shared, and results arriving
 * after unmount (or after a newer attempt started) are ignored.
 */
export function useFixtures(): UseFixturesResult {
  const [state, setState] = useState<FixturesState>(initialState)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadFixtures().then(
      (fixtures) => {
        if (active) setState({ status: 'ready', fixtures, error: null })
      },
      (error: Error) => {
        if (active) setState({ status: 'error', fixtures: EMPTY, error })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', fixtures: EMPTY, error: null })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, retry }
}
