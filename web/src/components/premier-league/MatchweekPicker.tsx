import { useEffect, useRef } from 'react'
import { useMatchweekNav } from '../../lib/matchweekNav'
import type { WeekSummary } from '../../lib/season'

/**
 * Scrollable strip of matchweeks 1–38. Played weeks show their score, the
 * current week says "Now", future weeks sit back; the selected one is lit in
 * pitch green and kept centred (scrolling the strip only, never the page).
 */
export function MatchweekPicker({ weeks }: { weeks: readonly WeekSummary[] }) {
  const { selected, current, go } = useMatchweekNav()
  const strip = useRef<HTMLOListElement>(null)
  const first = useRef(true)

  useEffect(() => {
    const list = strip.current
    const item = list?.querySelector<HTMLElement>(`[data-mw="${selected}"]`)
    if (!list || !item) return
    const smooth = !first.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    first.current = false
    list.scrollTo({ left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
  }, [selected])

  return (
    <ol
      ref={strip}
      className="pl-strip-mask relative flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain scroll-px-6 px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {weeks.map((week) => {
        const isSelected = week.matchweek === selected
        const isCurrent = week.matchweek === current
        const graded = week.rate.total > 0
        const caption = isCurrent ? 'Now' : graded ? `${week.rate.hits}/${week.rate.total}` : ''
        const future = week.matchweek > current
        return (
          <li key={week.matchweek} data-mw={week.matchweek} className="shrink-0">
            <button
              type="button"
              onClick={() => go(week.matchweek)}
              aria-current={isSelected ? 'true' : undefined}
              aria-label={`Matchweek ${week.matchweek}${isCurrent ? ', this week' : ''}${graded ? `, ${week.rate.hits} of ${week.rate.total} correct` : ''}`}
              className={`relative flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-xl transition-[background-color,color,box-shadow,scale] duration-200 focus-visible:outline-offset-1 active:scale-95 ${
                isSelected
                  ? 'bg-pitch text-black shadow-[0_0_0_1px_rgb(155_255_200/0.7),0_6px_24px_-6px_rgb(60_240_140/0.75)]'
                  : isCurrent
                    ? 'text-pitch shadow-[inset_0_0_0_1px_rgb(60_240_140/0.55)] hover:bg-pitch-dim'
                    : future
                      ? 'text-grey-500 hover:bg-glass-strong hover:text-white'
                      : 'text-white shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-glass-strong'
              }`}
            >
              <span className="font-display text-[1.15rem] leading-none font-bold tabular-nums">{week.matchweek}</span>
              <span
                className={`h-2.5 font-mono text-[0.6rem] leading-none tracking-[0.04em] tabular-nums uppercase ${isSelected ? 'text-black/75' : isCurrent ? 'text-pitch' : 'text-grey-400'}`}
              >
                {caption}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
