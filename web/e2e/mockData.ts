import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

/** A snapshot of the `matchweek_predictions` view (2026/27 after matchweek 5). */
export const FIXTURES: Record<string, unknown>[] = JSON.parse(
  readFileSync(new URL('./fixtures/matchweek_predictions.json', import.meta.url), 'utf8'),
)

/** The moment the snapshot describes: matchweek 6 is next. */
export const NOW = new Date('2026-10-01T12:00:00Z')

/**
 * Freezes the clock and answers the site's Supabase requests from the
 * snapshot, imitating the two PostgREST features it uses: `season=eq.X` and
 * the `select=season … limit=1` lookup of the latest season.
 */
export async function mockSupabase(page: Page, rows: Record<string, unknown>[] = FIXTURES) {
  await page.clock.setFixedTime(NOW)
  await page.route('**/rest/v1/matchweek_predictions**', async (route) => {
    const url = new URL(route.request().url())
    let body = rows
    const season = url.searchParams.get('season')
    if (season?.startsWith('eq.')) body = body.filter((r) => r.season === season.slice(3))
    if (url.searchParams.get('select') === 'season') {
      body = body
        .map((r) => ({ season: String(r.season) }))
        .sort((a, b) => b.season.localeCompare(a.season))
        .slice(0, Number(url.searchParams.get('limit') ?? body.length))
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

/** Collects console errors and uncaught exceptions for an end-of-test check. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}
