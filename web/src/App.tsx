import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { PageLayout } from './components/PageLayout'
import Home from './pages/Home'

// Only the landing page ships in the main bundle. The data page pulls in
// supabase-js; the others are small but not needed for first paint.
const PremierLeague = lazy(() => import('./pages/PremierLeague'))
const About = lazy(() => import('./pages/About'))
const ChampionsLeague = lazy(() => import('./pages/ChampionsLeague'))
const NotFound = lazy(() => import('./pages/NotFound'))

const router = createBrowserRouter([
  {
    Component: PageLayout,
    children: [
      { index: true, Component: Home },
      { path: 'premier-league', Component: PremierLeague },
      { path: 'champions-league', Component: ChampionsLeague },
      { path: 'about', Component: About },
      { path: '*', Component: NotFound },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
