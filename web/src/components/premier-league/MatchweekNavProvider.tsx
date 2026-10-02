import type { ReactNode } from 'react'
import { MatchweekNavContext } from '../../lib/matchweekNav'
import { useMatchweekSelection } from '../../lib/useMatchweekSelection'

/**
 * Owns the selected matchweek (synced to `?mw=`) for everything below it:
 * the meter's per-matchweek strip and the carousel both read and change it
 * through `useMatchweekNav()`.
 */
export function MatchweekNavProvider({ current, seasonOver = false, children }: { current: number; seasonOver?: boolean; children: ReactNode }) {
  const nav = useMatchweekSelection(current, seasonOver)
  return <MatchweekNavContext value={nav}>{children}</MatchweekNavContext>
}
