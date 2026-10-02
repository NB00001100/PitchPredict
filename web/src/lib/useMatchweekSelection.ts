import { addTransitionType, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { clampMatchweek, parseMatchweekParam } from './matchweek'
import { MW_BACK, MW_FORWARD, type MatchweekNav } from './matchweekNav'

export const MW_PARAM = 'mw'

/**
 * The selected matchweek, kept in sync with `?mw=N`.
 *
 * The URL is the source of truth: `go` only writes the URL (a new history
 * entry, without scrolling to the top), and an effect copies the URL's value
 * into the rendered state inside a transition tagged `mw-forward` or
 * `mw-back`. Because clicks, links and the browser's back/forward buttons all
 * flow through that one path, every change gets a directional view transition
 * (where the browser supports it). A missing or invalid `?mw` shows
 * `current`; an invalid one is also removed from the URL.
 */
export function useMatchweekSelection(current: number, seasonOver = false): MatchweekNav {
  const [params, setParams] = useSearchParams()
  const raw = params.get(MW_PARAM)
  const fromUrl = parseMatchweekParam(raw, current)
  const [selected, setSelected] = useState(fromUrl)

  useEffect(() => {
    if (fromUrl === selected) return
    startTransition(() => {
      addTransitionType(fromUrl > selected ? MW_FORWARD : MW_BACK)
      setSelected(fromUrl)
    })
  }, [fromUrl, selected])

  const invalid = raw !== null && parseMatchweekParam(raw, -1) === -1
  useEffect(() => {
    if (!invalid) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(MW_PARAM)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }, [invalid, setParams])

  /*
   * The last matchweek asked for. Relative steps start from here rather than
   * from `selected` or the URL, both of which lag behind quick repeated
   * presses. `expected` is the URL value our own navigation is waiting for;
   * any other URL change while nothing is pending (back/forward, a link) resets
   * the baseline.
   */
  const latest = useRef(fromUrl)
  const expected = useRef<number | null>(null)
  useEffect(() => {
    if (expected.current === fromUrl) expected.current = null
    else if (expected.current === null) latest.current = fromUrl
  }, [fromUrl])

  const navigate = useCallback(
    (target: (latest: number) => number) => {
      const to = clampMatchweek(target(latest.current))
      if (to === latest.current) return
      latest.current = to
      expected.current = to
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(MW_PARAM, String(to))
          return next
        },
        { preventScrollReset: true },
      )
    },
    [setParams],
  )
  const go = useCallback((n: number) => navigate(() => n), [navigate])
  const step = useCallback((delta: number) => navigate((latest) => latest + delta), [navigate])

  return { selected, current, seasonOver, go, step }
}
