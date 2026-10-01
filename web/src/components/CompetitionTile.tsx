import * as m from 'motion/react-m'
import { useMotionValue, useSpring, useTransform } from 'motion/react'
import { useRef, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { POINTER_SPRING } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'
import { ArrowRightIcon } from './Icons'
import { PointerLight } from './PointerLight'

/**
 * - `active`: the competition with live forecasts. Pitch-green rim, lit
 *   floor, the logo at full strength.
 * - `upcoming`: same size and layout, cooler night tone, logo dimmed until
 *   hover or focus. Reads as a sibling, not a disabled control.
 */
export type CompetitionTileTone = 'active' | 'upcoming'

interface CompetitionTileProps {
  to: string
  /** Competition name: the visible title and the start of the link's name. */
  name: string
  /** The competition's official logo, mono white, alt="" (the name labels the link). */
  logo: ReactNode
  /** Pinned top-left, e.g. <Tag tone="live">Forecasts live</Tag>. */
  status: ReactNode
  /** One line of detail under the name (may be live data). */
  detail: ReactNode
  /** Revealed on hover and keyboard focus (always shown on touch), e.g. "See the forecasts". */
  action: string
  tone?: CompetitionTileTone
}

const TILT = 7

const STAGE: Record<CompetitionTileTone, string> = {
  active:
    'border border-pitch/35 bg-[radial-gradient(90%_70%_at_50%_110%,rgb(60_240_140/0.22),transparent_70%),linear-gradient(180deg,rgb(214_255_234/0.06),rgb(214_255_234/0.015))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_0_50px_-18px_rgb(60_240_140/0.5)]',
  upcoming:
    'border border-hairline bg-[radial-gradient(90%_70%_at_50%_110%,rgb(110_140_255/0.16),transparent_70%),linear-gradient(180deg,rgb(214_225_255/0.05),rgb(214_225_255/0.012))] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]',
}

/**
 * A competition on the landing page: its official logo, large, on a lit glass
 * stage. On hover (and keyboard focus) the stage tilts towards the pointer,
 * a light follows it, the logo lifts, and an action line rises into view.
 * Tilt and light are pointer-only and off under reduced motion.
 */
export function CompetitionTile({ to, name, logo, status, detail, action, tone = 'active' }: CompetitionTileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [TILT, -TILT]), POINTER_SPRING)
  const rotateY = useSpring(useTransform(px, [0, 1], [-TILT, TILT]), POINTER_SPRING)

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== 'mouse' || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    px.set((event.clientX - rect.left) / rect.width)
    py.set((event.clientY - rect.top) / rect.height)
  }

  function onPointerLeave() {
    px.set(0.5)
    py.set(0.5)
  }

  const active = tone === 'active'

  return (
    <Link to={to} className="group block rounded-3xl [perspective:1200px] focus-visible:outline-offset-8">
      <m.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={reduced ? undefined : { rotateX, rotateY }}
        className="rounded-3xl transition-[translate] duration-500 ease-out-expo group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 motion-reduce:translate-y-0!"
      >
        <div
          className={`relative isolate flex aspect-[5/4] flex-col overflow-hidden rounded-3xl transition-[box-shadow,border-color] duration-500 sm:aspect-[4/3.4] ${STAGE[tone]} ${active ? 'group-hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.1),0_30px_80px_-30px_rgb(60_240_140/0.65)]' : 'group-hover:border-hairline-strong group-hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08),0_30px_80px_-30px_rgb(110_140_255/0.5)]'}`}
        >
          <PointerLight color={active ? 'rgb(60 240 140 / 0.16)' : 'rgb(140 165 255 / 0.16)'} />
          <TileBackdrop tone={tone} />
          <div className="flex items-start justify-between p-5">{status}</div>
          <div className="flex flex-1 items-center justify-center px-[14%] pb-6">
            <div
              className={`flex w-full items-center justify-center transition-[translate,scale,opacity] duration-700 ease-out-expo group-hover:-translate-y-2 group-hover:scale-[1.04] group-focus-visible:-translate-y-2 group-focus-visible:scale-[1.04] motion-reduce:transform-none ${active ? 'opacity-100' : 'opacity-75 group-hover:opacity-100 group-focus-visible:opacity-100'} [&_img]:h-auto [&_img]:max-h-[9rem] [&_img]:w-full [&_img]:object-contain [&_img]:drop-shadow-[0_0_30px_rgb(255_255_255/0.18)]`}
            >
              {logo}
            </div>
          </div>
          {/* The action line: rises in on hover/focus; always visible without hover. */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-hairline bg-black/55 px-5 py-3.5 backdrop-blur-md transition-[translate,opacity] duration-500 ease-out-expo [@media(hover:hover)]:translate-y-full [@media(hover:hover)]:opacity-0 group-hover:translate-y-0! group-hover:opacity-100! group-focus-visible:translate-y-0! group-focus-visible:opacity-100!">
            <span className="font-wide text-[0.68rem] font-semibold tracking-[0.14em] uppercase">{action}</span>
            <span
              aria-hidden="true"
              className={`inline-flex size-8 items-center justify-center rounded-full ${active ? 'bg-pitch text-black' : 'bg-white text-black'}`}
            >
              <ArrowRightIcon className="size-3.5" />
            </span>
          </div>
        </div>
      </m.div>
      <div className="mt-5 flex flex-col gap-1.5 px-1">
        <span className="type-title uppercase">{name}</span>
        <span className="type-label text-grey-400 normal-case">{detail}</span>
      </div>
    </Link>
  )
}

/** Line art behind the logo: a centre circle for the live league, a star field for the other. */
function TileBackdrop({ tone }: { tone: CompetitionTileTone }) {
  if (tone === 'active') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 400 340"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 -z-10 size-full text-pitch/25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M200 0V340" />
        <circle cx="200" cy="170" r="92" />
        <circle cx="200" cy="170" r="3" fill="currentColor" />
      </svg>
    )
  }
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(1px_1px_at_12%_18%,#fff,transparent),radial-gradient(1px_1px_at_28%_62%,#fff,transparent),radial-gradient(1.5px_1.5px_at_44%_22%,#fff,transparent),radial-gradient(1px_1px_at_63%_38%,#fff,transparent),radial-gradient(1px_1px_at_78%_14%,#fff,transparent),radial-gradient(1.5px_1.5px_at_86%_58%,#fff,transparent),radial-gradient(1px_1px_at_18%_82%,#fff,transparent),radial-gradient(1px_1px_at_52%_76%,#fff,transparent),radial-gradient(1px_1px_at_92%_84%,#fff,transparent),radial-gradient(1px_1px_at_36%_42%,rgb(255_255_255/0.6),transparent),radial-gradient(1px_1px_at_70%_68%,rgb(255_255_255/0.6),transparent)]"
    />
  )
}
