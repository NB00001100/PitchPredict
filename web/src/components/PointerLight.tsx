import { useEffect, useRef } from 'react'

interface PointerLightProps {
  /** Diameter of the light pool in px. */
  size?: number
  /** CSS colour of the light's centre. */
  color?: string
  className?: string
}

/**
 * A soft light pool that follows the pointer across its parent, like a
 * floodlight catching glass. Drop it as the first child of any `relative
 * overflow-hidden isolate` surface (Panel, a card). It moves with `transform` only,
 * fades in on enter and out on leave, and does nothing on touch screens or
 * under reduced motion.
 */
export function PointerLight({ size = 420, color = 'rgb(60 240 140 / 0.16)', className = '' }: PointerLightProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const light = ref.current
    const host = light?.parentElement
    if (!light || !host) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    function onMove(event: PointerEvent) {
      if (!light || !host) return
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left - size / 2
      const y = event.clientY - rect.top - size / 2
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        light.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`
        light.style.opacity = '1'
      })
    }
    function onLeave() {
      cancelAnimationFrame(frame)
      if (light) light.style.opacity = '0'
    }
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
    }
  }, [size])

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 left-0 -z-10 rounded-full opacity-0 transition-opacity duration-500 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle closest-side, ${color}, transparent)`,
      }}
    />
  )
}
