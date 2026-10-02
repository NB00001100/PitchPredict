import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Fills `__SITE_URL__` in index.html with VITE_SITE_URL (the deployed origin,
 * no trailing slash), so Open Graph and Twitter image URLs are absolute as
 * those crawlers require. Unset, the URLs stay root-relative.
 */
function siteUrl(mode: string): Plugin {
  const url = (loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL ?? '').replace(/\/+$/, '')
  return {
    name: 'pitchpredict-site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), siteUrl(mode)],
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
