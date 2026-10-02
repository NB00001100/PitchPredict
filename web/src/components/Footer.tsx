import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AUTHOR, REPO_URL } from '../lib/site'
import { preloadPage } from '../pageImports'
import { ArrowUpRightIcon } from './Icons'
import { Wordmark } from './Wordmark'

const linkClass =
  'inline-flex items-center gap-1.5 text-grey-200 transition-colors duration-200 hover:text-pitch'

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className={linkClass} onPointerEnter={() => preloadPage(to)} onFocus={() => preloadPage(to)}>
        {children}
      </Link>
    </li>
  )
}

const YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-hairline">
      {/* A floodlit edge along the top rule. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-pitch)_50%,transparent)] opacity-60"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,rgb(60_240_140/0.08),transparent)]"
      />
      <div className="page-col relative grid gap-12 pt-16 pb-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex max-w-sm flex-col gap-4">
          <Link to="/" className="group self-start rounded-full" aria-label="PitchPredict, home">
            <Wordmark logoClassName="size-10" />
          </Link>
          <p className="text-sm leading-relaxed text-grey-400">
            Premier League forecasts from a Dixon–Coles model, scored in public against what actually happened.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="type-eyebrow mb-4 text-grey-500">Explore</p>
          <ul className="flex flex-col gap-3 text-sm">
            <FooterLink to="/premier-league">Premier League</FooterLink>
            <FooterLink to="/champions-league">Champions League</FooterLink>
            <FooterLink to="/about">How it works</FooterLink>
          </ul>
        </nav>
        <div>
          <p className="type-eyebrow mb-4 text-grey-500">Source</p>
          <ul className="flex flex-col gap-3 text-sm">
            <li>
              <a href={REPO_URL} className={linkClass}>
                Code on GitHub
                <ArrowUpRightIcon className="size-3.5" />
              </a>
            </li>
            <li className="text-grey-400">Built by {AUTHOR}</li>
          </ul>
        </div>
      </div>
      {/* Giant outlined sign-off, cropped by the page edge. */}
      <div aria-hidden="true" className="page-col relative select-none">
        <p className="translate-y-[18%] text-center font-display text-[clamp(4.5rem,18.5vw,17rem)] leading-[0.8] font-black tracking-[-0.01em] text-transparent uppercase [-webkit-text-stroke:1px_rgb(214_255_234/0.16)] [font-variation-settings:'wdth'_62]">
          PitchPredict
        </p>
      </div>
      <div className="relative border-t border-hairline bg-black/40">
        <div className="page-col flex flex-col gap-3 py-5 text-grey-500">
          <div className="flex flex-col gap-2 font-mono text-[0.7rem] tracking-[0.06em] uppercase sm:flex-row sm:justify-between">
            <p>© {YEAR} {AUTHOR}</p>
            <p>No betting odds were used as model input</p>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed">
            Premier League and UEFA Champions League names and logos are trademarks of their respective owners.
            PitchPredict is an independent project and is not affiliated with, or endorsed by, either competition.
          </p>
        </div>
      </div>
    </footer>
  )
}
