/*
 * The lazy pages' dynamic imports, in one place so links can start a page's
 * download before it is clicked (`preloadPage`). Calling an import twice is
 * free: the browser fetches each chunk once.
 */
export const pageImports = {
  premierLeague: () => import('./pages/PremierLeague'),
  premierLeagueResults: () => import('./pages/PremierLeagueResults'),
  about: () => import('./pages/About'),
  championsLeague: () => import('./pages/ChampionsLeague'),
  notFound: () => import('./pages/NotFound'),
}

const BY_PATH: Record<string, () => Promise<unknown>> = {
  '/premier-league': pageImports.premierLeague,
  '/premier-league/results': pageImports.premierLeagueResults,
  '/about': pageImports.about,
  '/champions-league': pageImports.championsLeague,
}

/** Starts downloading the page behind `path` (ignores paths it doesn't know, and failures). */
export function preloadPage(path: string) {
  BY_PATH[path.split(/[?#]/)[0]]?.().catch(() => {})
}
