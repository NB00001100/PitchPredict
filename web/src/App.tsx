import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { PageLayout } from './components/PageLayout'
import { RouteError } from './components/RouteError'
import Home from './pages/Home'
import { pageImports } from './pageImports'

// Only the landing page ships in the main bundle. The data pages pull in
// supabase-js; the others are small but not needed for first paint. Header
// and footer links start these downloads on hover or focus (see pageImports).
const PremierLeague = lazy(pageImports.premierLeague)
const PremierLeagueResults = lazy(pageImports.premierLeagueResults)
const About = lazy(pageImports.about)
const ChampionsLeague = lazy(pageImports.championsLeague)
const NotFound = lazy(pageImports.notFound)

const router = createBrowserRouter([
  {
    Component: PageLayout,
    children: [
      {
        // Pathless: a page that throws is replaced by RouteError inside the shell.
        ErrorBoundary: RouteError,
        children: [
          { index: true, Component: Home },
          { path: 'premier-league', Component: PremierLeague },
          { path: 'premier-league/results', Component: PremierLeagueResults },
          { path: 'champions-league', Component: ChampionsLeague },
          { path: 'about', Component: About },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
