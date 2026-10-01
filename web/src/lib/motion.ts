/*
 * Motion tokens for the `motion` library, mirroring the CSS easings in
 * index.css. Rules (DESIGN.md): animate transform and opacity only, keep UI
 * feedback under 250ms and entrances under ~900ms, and never block input.
 */

/** Cubic-bezier control points, usable as `ease` in motion transitions. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
export const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const
export const EASE_IN_OUT_QUART = [0.76, 0, 0.24, 1] as const

/** Durations in seconds. */
export const DURATION = {
  /** Hover, press, small state changes. */
  fast: 0.18,
  /** Panels, reveals. */
  base: 0.6,
  /** Hero entrances, line draws. */
  slow: 1.1,
  /** Pitch lines stroking in. */
  draw: 1.8,
} as const

/** Delay between siblings in a staggered entrance, in seconds. */
export const STAGGER = 0.07

/** Standard spring for pointer-driven motion (tilt, magnetic pull). */
export const POINTER_SPRING = { stiffness: 220, damping: 22, mass: 0.6 } as const
