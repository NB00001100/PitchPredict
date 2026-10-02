import * as m from 'motion/react-m'
import { AnimatePresence, useScroll, useTransform } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { DURATION, EASE_OUT_EXPO } from '../lib/motion'
import { REPO_URL } from '../lib/site'
import { preloadPage } from '../pageImports'
import { ArrowUpRightIcon, CrossIcon, MenuIcon } from './Icons'
import { Wordmark } from './Wordmark'

const NAV = [
  { to: '/premier-league', label: 'Premier League' },
  { to: '/about', label: 'How it works' },
] as const

const linkBase =
  'relative inline-flex h-10 items-center gap-1.5 rounded-full px-4 font-wide text-[0.68rem] font-semibold tracking-[0.14em] uppercase transition-colors duration-200'

/** Height of the header bar in px; main content is padded by this much. */
export const HEADER_HEIGHT = 76

/**
 * Fixed header. Transparent over the top of the page; once you scroll, a
 * glass bar fades in behind it and the wordmark condenses (transform and
 * opacity only). Below 640px the links fold into a menu.
 */
export function Header() {
  const { scrollY } = useScroll()
  const bg = useTransform(scrollY, [0, 80], [0, 1])
  const barScale = useTransform(scrollY, [0, 80], [1, 0.84])
  const markScale = useTransform(scrollY, [0, 80], [1, 0.9])
  const lift = useTransform(scrollY, [0, 80], [0, -6])

  return (
    <header className="fixed inset-x-0 top-0 z-40" style={{ height: HEADER_HEIGHT }}>
      <m.div
        aria-hidden="true"
        className="absolute inset-0 origin-top border-b border-hairline bg-black/80 backdrop-blur-xl backdrop-saturate-150"
        style={{ opacity: bg, scaleY: barScale }}
      />
      <m.div className="page-col relative flex h-full items-center justify-between gap-4" style={{ y: lift }}>
        <Link to="/" className="group -ml-1 rounded-full p-1" aria-label="PitchPredict, home">
          <m.span className="block origin-left" style={{ scale: markScale }}>
            <Wordmark />
          </m.span>
        </Link>
        <DesktopNav />
        <MobileNav />
      </m.div>
    </header>
  )
}

function DesktopNav() {
  return (
    <nav aria-label="Main" className="hidden sm:block">
      <ul className="flex items-center gap-1">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onPointerEnter={() => preloadPage(item.to)}
              onFocus={() => preloadPage(item.to)}
              className={({ isActive }) => `${linkBase} ${isActive ? 'text-white' : 'text-grey-400 hover:text-white'}`}
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <m.span
                      layoutId="nav-active"
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-full border border-hairline-strong bg-glass-strong"
                      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                    />
                  ) : null}
                  {isActive ? <span aria-hidden="true" className="size-1.5 rounded-full bg-pitch shadow-[0_0_8px_var(--color-pitch)]" /> : null}
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <a href={REPO_URL} className={`${linkBase} text-grey-400 hover:text-white`}>
            GitHub
            <ArrowUpRightIcon className="size-3.5" />
          </a>
        </li>
      </ul>
    </nav>
  )
}

function MobileNav() {
  const { pathname } = useLocation()
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenOn(null)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="sm:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (!open) for (const item of NAV) preloadPage(item.to)
          setOpenOn(open ? null : pathname)
        }}
        className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 font-wide text-[0.66rem] font-semibold tracking-[0.14em] uppercase"
      >
        {open ? <CrossIcon className="size-3.5" /> : <MenuIcon className="size-3.5" />}
        Menu
      </button>
      <AnimatePresence>
        {open ? (
          <m.nav
            id={menuId}
            aria-label="Main"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT_EXPO }}
            className="glass absolute inset-x-0 top-[calc(100%-4px)] origin-top rounded-2xl bg-black/80! p-2"
          >
            <ul className="flex flex-col">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onFocus={() => preloadPage(item.to)}
                    className={({ isActive }) =>
                      `flex h-12 items-center justify-between rounded-xl px-4 font-wide text-xs font-semibold tracking-[0.14em] uppercase ${isActive ? 'bg-glass-strong text-pitch' : 'text-white'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <a
                  href={REPO_URL}
                  className="flex h-12 items-center justify-between rounded-xl px-4 font-wide text-xs font-semibold tracking-[0.14em] text-white uppercase"
                >
                  GitHub
                  <ArrowUpRightIcon className="size-4" />
                </a>
              </li>
            </ul>
          </m.nav>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
