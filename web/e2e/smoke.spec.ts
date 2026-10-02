import { expect, test } from '@playwright/test'
import { FIXTURES, mockSupabase, watchErrors } from './mockData.ts'

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page)
  await mockSupabase(page)
})

test.afterEach(() => {
  expect(errors, 'console errors').toEqual([])
})

test('landing page loads and shows this week’s ticker', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Called before kick-off')
  const ticker = page.getByRole('region', { name: /Matchweek 6 forecasts/i })
  await expect(ticker).toBeVisible()
  // Ten fixtures, each a link to the week (the looping copy is hidden from the accessibility tree).
  await expect(ticker.getByRole('link')).toHaveCount(10)
  await expect(page.getByText(/of this season’s picks were right/)).toContainText('24 of 50')
})

test('Premier League opens on the current matchweek', async ({ page }) => {
  await page.goto('/premier-league')
  await expect(page.getByRole('heading', { name: 'Matchweek 6', level: 2 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Matchweeks' }).getByRole('button', { name: /^Matchweek 6, this week/ })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByText('24 of 50 picks correct')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Matchweeks' })).toHaveAttribute('aria-current', 'page')
})

test('next / previous and ?mw= stay in sync', async ({ page }) => {
  await page.goto('/premier-league')
  const title = page.locator('#matchweek-heading')
  await page.getByRole('button', { name: 'Next matchweek' }).click()
  await expect(title).toHaveText('Matchweek 7')
  await expect(page).toHaveURL(/[?&]mw=7\b/)
  await page.getByRole('button', { name: 'Previous matchweek' }).click()
  await page.getByRole('button', { name: 'Previous matchweek' }).click()
  await expect(title).toHaveText('Matchweek 5')
  await expect(page).toHaveURL(/[?&]mw=5\b/)
  await page.goBack()
  await expect(title).toHaveText('Matchweek 6')

  await page.goto('/premier-league?mw=3')
  await expect(title).toHaveText('Matchweek 3')
  await page.goto('/premier-league?mw=99')
  await expect(title).toHaveText('Matchweek 6')
  await expect(page).not.toHaveURL(/mw=/)
})

test('the matchweek strip is one tab stop driven by arrow keys', async ({ page }) => {
  await page.goto('/premier-league')
  const strip = page.getByRole('navigation', { name: 'Matchweeks' })
  await strip.getByRole('button', { name: /^Matchweek 6, this week/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#matchweek-heading')).toHaveText('Matchweek 7')
  await expect(strip.getByRole('button', { name: 'Matchweek 7', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Next matchweek' })).toBeFocused()
})

test('Results filters drive the summary', async ({ page }) => {
  await page.goto('/premier-league/results')
  const summary = page.getByRole('region', { name: 'The record' })
  await expect(summary).toContainText('24 of 50 calls correct')
  await expect(summary).toContainText('0.1987')
  await expect(summary).toContainText(/6\s*exact scores/)
  await expect(summary.getByRole('listitem').filter({ hasText: 'Home wins' })).toContainText('13/18')
  await expect(summary.getByRole('listitem').filter({ hasText: 'Draws' })).toContainText('0/16')
  await expect(summary.getByRole('listitem').filter({ hasText: 'Away wins' })).toContainText('11/16')

  await page.getByRole('button', { name: 'Matchweek 2' }).click()
  await expect(summary).toContainText('7 of 10 calls correct')
  await page.getByRole('button', { name: 'Correct', exact: true }).click()
  await expect(summary).toContainText('7 of 7 calls correct')
  await expect(page).toHaveURL(/mw=2/)
  await expect(page).toHaveURL(/show=correct/)
  await page.getByRole('button', { name: 'Incorrect' }).click()
  await expect(summary).toContainText('0 of 3 calls correct')
})

test('one season only, even when the view holds two', async ({ page }) => {
  const older = FIXTURES.map((r) => ({ ...r, season: '2025-2026', fixture_id: Number(r.fixture_id) + 1_000_000 }))
  await page.unrouteAll()
  await mockSupabase(page, [...older, ...FIXTURES])
  await page.goto('/premier-league/results')
  await expect(page.getByText('Results · 2026/27 season')).toBeVisible()
  await expect(page.getByRole('region', { name: 'The record' })).toContainText('24 of 50 calls correct')
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows final values and a static ticker', async ({ page }) => {
    await page.goto('/')
    const ticker = page.getByRole('region', { name: /Matchweek 6 forecasts/i })
    // No looping copy: just the one list, scrollable.
    await expect(ticker.getByRole('list')).toHaveCount(1)
    await page.goto('/premier-league')
    // The headline figure is final at once, not counting up.
    await expect(page.locator('#season-heading + p [aria-hidden="true"]:not(.invisible)')).toHaveText('48%')
  })
})
