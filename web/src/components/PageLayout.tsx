import * as m from 'motion/react-m'
import { LazyMotion, MotionConfig } from 'motion/react'
import { Suspense, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { DURATION, EASE_OUT_EXPO } from '../lib/motion'
import { Atmosphere } from './Atmosphere'
import { Footer } from './Footer'
import { HEADER_HEIGHT, Header } from './Header'
import { StatusMessage } from './StatusMessage'

/**
 * Shared shell for every route: skip link, atmosphere, fixed header, main
 * column, footer. Pages render inside <main> (a page-col, padded below the
 * header) and are responsible for their own <h1>. A page may break out to
 * full width with the `bleed` utility.
 *
 * Route changes fade the new page up into place. The first page of a visit
 * skips this so its own entrance animation is the first thing seen.
 */
const loadMotionFeatures = () => import('../lib/motionFeatures').then((mod) => mod.default)

export function PageLayout() {
  const { pathname } = useLocation()
  const [firstPath] = useState(pathname)
  const isFirst = firstPath === pathname

  return (
    <LazyMotion features={loadMotionFeatures}>
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-dvh flex-col overflow-x-clip text-white">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-pitch px-5 py-2.5 font-wide text-xs font-semibold tracking-[0.14em] text-black uppercase focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Atmosphere />
        <Header />
        <main id="main" tabIndex={-1} className="page-col flex-1 outline-none" style={{ paddingTop: HEADER_HEIGHT }}>
          <m.div
            key={pathname}
            initial={isFirst ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO }}
          >
            <Suspense fallback={<StatusMessage>Loading…</StatusMessage>}>
              <Outlet />
            </Suspense>
          </m.div>
        </main>
        <Footer />
        <ScrollRestoration />
      </div>
    </MotionConfig>
    </LazyMotion>
  )
}
