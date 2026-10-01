import { useEffect, type RefObject } from 'react'

const QUERY_FINE = '(hover: hover) and (pointer: fine)'
const QUERY_REDUCE = '(prefers-reduced-motion: reduce)'

/**
 * Pulls an element (styled with the `magnetic` utility) a few pixels towards the pointer while it hovers, then
 * springs back on leave. Writes `translate` directly (no React renders), only
 * for a fine pointer, and never under reduced motion.
 *
 * @param strength fraction of the pointer offset to follow (0.2 = 20%).
 * @param max cap on the pull, in px.
 */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.22, max = 8) {
  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia(QUERY_FINE).matches || window.matchMedia(QUERY_REDUCE).matches) return

    let frame = 0
    const clamp = (n: number) => Math.max(-max, Math.min(max, n))

    function onMove(event: PointerEvent) {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clamp((event.clientX - (rect.left + rect.width / 2)) * strength)
      const y = clamp((event.clientY - (rect.top + rect.height / 2)) * strength)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--mag-dur', '120ms')
        el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
      })
    }

    function onLeave() {
      if (!el) return
      cancelAnimationFrame(frame)
      el.style.setProperty('--mag-dur', '520ms')
      el.style.translate = '0px 0px'
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.style.translate = ''
      el.style.removeProperty('--mag-dur')
    }
  }, [ref, strength, max])
}
