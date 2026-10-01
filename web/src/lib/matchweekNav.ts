import { createContext, use } from 'react'

export interface MatchweekNav {
  /** The matchweek on screen. */
  selected: number
  /** The matchweek being played or coming up next. */
  current: number
  /** Shows matchweek `n` (clamped to the season) and records it in the URL. */
  go: (n: number) => void
  /**
   * Moves `delta` matchweeks from the most recently requested one (not the
   * one on screen), so quick repeated presses each count. Stops at 1 and 38.
   */
  step: (delta: number) => void
}

export const MatchweekNavContext = createContext<MatchweekNav | null>(null)

export function useMatchweekNav(): MatchweekNav {
  const nav = use(MatchweekNavContext)
  if (!nav) throw new Error('useMatchweekNav must be used inside <MatchweekNavProvider>')
  return nav
}

/** Transition types for the directional matchweek change. */
export const MW_FORWARD = 'mw-forward'
export const MW_BACK = 'mw-back'
