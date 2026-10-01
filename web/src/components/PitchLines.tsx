import * as m from 'motion/react-m'
import { useId } from 'react'
import { DURATION, EASE_IN_OUT_QUART } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

/*
 * A full pitch, top-down, at 10 units per metre: 68 m wide, 105 m long,
 * goals at the top and bottom. Paths only, so each one can stroke itself in.
 */
const W = 680
const L = 1050
const BOX_W = 403
const BOX_D = 165
const SIX_W = 183
const SIX_D = 55
const R = 91.5
const SPOT = 110

const bx = (W - BOX_W) / 2
const sx = (W - SIX_W) / 2
// Penalty arc: the part of the 9.15 m circle round the spot outside the box.
const arcDy = BOX_D - SPOT
const arcDx = Math.sqrt(R * R - arcDy * arcDy)

const LINES: string[] = [
  // Touchlines and goal lines.
  `M0 0H${W}V${L}H0Z`,
  // Halfway line.
  `M0 ${L / 2}H${W}`,
  // Centre circle.
  `M${W / 2} ${L / 2 - R}a${R} ${R} 0 1 1 0 ${2 * R}a${R} ${R} 0 1 1 0 ${-2 * R}`,
  // Penalty areas.
  `M${bx} 0V${BOX_D}H${bx + BOX_W}V0`,
  `M${bx} ${L}V${L - BOX_D}H${bx + BOX_W}V${L}`,
  // Goal areas.
  `M${sx} 0V${SIX_D}H${sx + SIX_W}V0`,
  `M${sx} ${L}V${L - SIX_D}H${sx + SIX_W}V${L}`,
  // Penalty arcs.
  `M${W / 2 - arcDx} ${BOX_D}A${R} ${R} 0 0 0 ${W / 2 + arcDx} ${BOX_D}`,
  `M${W / 2 - arcDx} ${L - BOX_D}A${R} ${R} 0 0 1 ${W / 2 + arcDx} ${L - BOX_D}`,
  // Corner arcs.
  `M10 0A10 10 0 0 1 0 10`,
  `M${W - 10} 0A10 10 0 0 0 ${W} 10`,
  `M0 ${L - 10}A10 10 0 0 1 10 ${L}`,
  `M${W} ${L - 10}A10 10 0 0 0 ${W - 10} ${L}`,
]

const SPOTS: [number, number][] = [
  [W / 2, L / 2],
  [W / 2, SPOT],
  [W / 2, L - SPOT],
]

const STRIPES = 14

interface PitchLinesProps {
  className?: string
  /** Seconds before the lines start drawing. */
  delay?: number
  /** Paint alternating mown stripes under the lines. */
  stripes?: boolean
  /** Stroke width in pitch units (10 = 1 m). */
  strokeWidth?: number
}

/**
 * Pitch markings as line art. Each line strokes itself in on mount (an SVG
 * path draw, run once); under reduced motion they are simply there.
 * Decorative: aria-hidden.
 */
export function PitchLines({ className = '', delay = 0, stripes = false, strokeWidth = 2.5 }: PitchLinesProps) {
  const reduced = usePrefersReducedMotion()
  const gradient = `pp-stripes-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg
      viewBox={`-20 -20 ${W + 40} ${L + 40}`}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(60 240 140)" stopOpacity="0.05" />
          <stop offset="1" stopColor="rgb(60 240 140)" stopOpacity="0.11" />
        </linearGradient>
      </defs>
      {stripes ? (
        <m.g
          fill={`url(#${gradient})`}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.draw, ease: EASE_IN_OUT_QUART, delay }}
        >
          {Array.from({ length: STRIPES / 2 }, (_, i) => (
            <rect key={i} x={0} y={(L / STRIPES) * i * 2} width={W} height={L / STRIPES} />
          ))}
        </m.g>
      ) : null}
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {LINES.map((d, i) => (
          <m.path
            key={d}
            d={d}
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
              pathLength: { duration: DURATION.draw, ease: EASE_IN_OUT_QUART, delay: delay + i * 0.06 },
              opacity: { duration: 0.2, delay: delay + i * 0.06 },
            }}
          />
        ))}
      </g>
      <g fill="currentColor">
        {SPOTS.map(([cx, cy]) => (
          <m.circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={strokeWidth * 2}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: delay + DURATION.draw * 0.8 }}
          />
        ))}
      </g>
    </svg>
  )
}
