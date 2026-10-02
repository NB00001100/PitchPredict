import { defineConfig, devices } from '@playwright/test'

/*
 * Smoke test for the built site (npm run e2e). It builds with `--mode e2e`
 * (placeholder Supabase settings from .env.e2e) and answers every Supabase
 * request from e2e/fixtures, so it never touches live data. Not part of
 * `npm test`.
 */
const PORT = 4318

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `vite build --mode e2e --outDir e2e/.dist --emptyOutDir && vite preview --mode e2e --outDir e2e/.dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
