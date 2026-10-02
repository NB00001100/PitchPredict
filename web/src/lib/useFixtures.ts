import { useCallback, useEffect, useState } from 'react'
import { onlyLatestSeason } from './season'
import { supabase, supabaseConfigError } from './supabase'
import { toFixture, type Fixture, type FixtureRow } from './types'

export type FixturesState =
  | { status: 'loading'; fixtures: readonly Fixture[]; error: null }
  | { status: 'ready'; fixtures: readonly Fixture[]; error: null }
  | { status: 'error'; fixtures: readonly Fixture[]; error: Error }

export type UseFixturesResult = FixturesState & {
  /** Discards any cached failure and fetches again. */
  retry: () => void
  /** When the data on screen was last fetched successfully (ms since epoch), or null. */
  updatedAt: number | null
}

export const VIEW = 'matchweek_predictions'

/** Data older than this is refetched when the tab regains focus or visibility. */
export const STALE_AFTER_MS = 5 * 60 * 1000
/** While the tab is visible, data is refetched this often. */
export const REFRESH_EVERY_MS = 10 * 60 * 1000

/** The slice of the supabase-js query builder this module uses (so tests can pass a fake). */
interface QueryResult {
  data: unknown
  error: { message: string } | null
}
interface Query extends PromiseLike<QueryResult> {
  select(columns: string): Query
  eq(column: string, value: string): Query
  order(column: string, options: { ascending: boolean }): Query
  limit(n: number): Query
}
export interface FixturesClient {
  from(view: string): Query
}

/*
 * The view keeps every season's rows. The site shows one season, the latest
 * present: a tiny first request finds it ("2026-2027" ids sort by year), the
 * second loads only that season's fixtures. The result is filtered again on
 * the client, so a view that ever returns mixed seasons can't leak into the
 * page.
 */
export async function fetchFixtures(client: FixturesClient | null = supabase as unknown as FixturesClient | null): Promise<Fixture[]> {
  if (!client) throw new Error(supabaseConfigError ?? 'Supabase is not configured.')
  const latest = await client.from(VIEW).select('season').order('season', { ascending: false }).limit(1)
  if (latest.error) throw new Error(`Could not load fixtures: ${latest.error.message}`)
  const season = (latest.data as { season?: unknown }[] | null)?.[0]?.season
  if (typeof season !== 'string' || season === '') return []

  const { data, error } = await client
    .from(VIEW)
    .select('*')
    .eq('season', season)
    .order('matchweek', { ascending: true })
    .order('kickoff', { ascending: true })
    .order('fixture_id', { ascending: true })
  if (error) throw new Error(`Could not load fixtures: ${error.message}`)
  return [...onlyLatestSeason(((data ?? []) as FixtureRow[]).map(toFixture))]
}

/*
 * One request per page load, shared by every component and route that calls
 * the hook. A failed first request is dropped from the cache so `retry` (or
 * the tab coming back into view) refetches. After that, the data is
 * revalidated in the background (stale while revalidate): the current
 * fixtures stay on screen, every mounted hook gets the new ones when they
 * arrive, and a failed refresh is ignored. A refresh that returns exactly
 * what is on screen keeps the same array, so nothing below re-renders.
 */
let request: Promise<Fixture[]> | null = null
let loaded: Fixture[] | null = null
let loadedKey = ''
let loadedAt: number | null = null
let refreshing: Promise<void> | null = null
const subscribers = new Set<() => void>()

function store(fixtures: Fixture[]): Fixture[] {
  const key = JSON.stringify(fixtures)
  if (!loaded || key !== loadedKey) {
    loaded = fixtures
    loadedKey = key
  }
  loadedAt = Date.now()
  for (const notify of subscribers) notify()
  return loaded
}

function loadFixtures(): Promise<Fixture[]> {
  request ??= fetchFixtures().then(store, (error: unknown) => {
    request = null
    throw error instanceof Error ? error : new Error(String(error))
  })
  return request
}

/**
 * Refetches in the background if nothing is in flight. Keeps the old data on
 * failure. If nothing has loaded yet (the first request failed), tries the
 * first load again; success reaches every mounted hook through `store`.
 */
function revalidate() {
  if (!loaded) {
    if (!request) loadFixtures().catch(() => {})
    return
  }
  if (refreshing) return
  refreshing = fetchFixtures()
    .then(
      (fixtures) => {
        request = Promise.resolve(store(fixtures))
      },
      () => {
        // Keep showing what we have; the next focus or interval tries again.
      },
    )
    .finally(() => {
      refreshing = null
    })
}

function revalidateIfStale() {
  if (loadedAt === null || Date.now() - loadedAt > STALE_AFTER_MS) revalidate()
}

/*
 * The focus/visibility listeners and the interval are installed once, however
 * many components use the hook, and removed when the last one unmounts.
 */
let watchers = 0
let stopWatching: (() => void) | null = null

function watch() {
  watchers += 1
  if (watchers > 1) return
  const onVisible = () => {
    if (document.visibilityState === 'visible') revalidateIfStale()
  }
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') revalidate()
  }, REFRESH_EVERY_MS)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
  stopWatching = () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onVisible)
  }
}

function unwatch() {
  watchers -= 1
  if (watchers === 0) {
    stopWatching?.()
    stopWatching = null
  }
}

const EMPTY: readonly Fixture[] = []

function initialState(): FixturesState {
  return loaded
    ? { status: 'ready', fixtures: loaded, error: null }
    : { status: 'loading', fixtures: EMPTY, error: null }
}

/**
 * Loads the latest season's fixtures (380 rows), ordered by matchweek, then
 * kickoff, and keeps them fresh: refetched when the tab comes back after
 * five minutes away and every ten minutes while visible, without ever going
 * back to a loading state. Safe under StrictMode: the request is shared, and
 * results arriving after unmount (or after a newer attempt started) are
 * ignored.
 */
export function useFixtures(): UseFixturesResult {
  const [state, setState] = useState<FixturesState>(initialState)
  const [updatedAt, setUpdatedAt] = useState<number | null>(loadedAt)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadFixtures().then(
      (fixtures) => {
        if (!active) return
        setState((prev) => (prev.status === 'ready' && prev.fixtures === fixtures ? prev : { status: 'ready', fixtures, error: null }))
        setUpdatedAt(loadedAt)
      },
      (error: Error) => {
        // Data may have arrived through another hook's retry in the meantime.
        if (active && !loaded) setState({ status: 'error', fixtures: EMPTY, error })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  useEffect(() => {
    const onUpdate = () => {
      if (!loaded) return
      const fixtures = loaded
      setState((prev) => (prev.status === 'ready' && prev.fixtures === fixtures ? prev : { status: 'ready', fixtures, error: null }))
      setUpdatedAt(loadedAt)
    }
    subscribers.add(onUpdate)
    watch()
    // Catch up on anything stored between the first render and this effect.
    onUpdate()
    return () => {
      subscribers.delete(onUpdate)
      unwatch()
    }
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'loading', fixtures: EMPTY, error: null })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, retry, updatedAt }
}
