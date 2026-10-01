import { animate, useInView } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { EASE_OUT_EXPO } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

interface CountUpProps {
  value: number
  /** Digits after the decimal point. */
  decimals?: number
  prefix?: string
  suffix?: string
  /** Seconds. */
  duration?: number
  delay?: number
  className?: string
}

const formatter = (decimals: number) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/**
 * A number that counts up from zero the first time it scrolls into view.
 *
 * - The final value is always in the accessibility tree; the ticking copy is
 *   aria-hidden, so screen readers never hear intermediate numbers.
 * - An invisible copy of the final value reserves the width: no layout shift.
 * - Updates write textContent directly (no React renders per frame).
 * - Under reduced motion it shows the final value at once.
 */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', duration = 1.6, delay = 0, className = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduced = usePrefersReducedMotion()
  const format = useMemo(() => formatter(decimals), [decimals])
  const final = `${prefix}${format.format(value)}${suffix}`

  useEffect(() => {
    const el = ref.current
    if (!el || !inView || reduced) return
    const controls = animate(0, value, {
      duration,
      delay,
      ease: EASE_OUT_EXPO,
      onUpdate: (n) => {
        el.textContent = `${prefix}${format.format(n)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, reduced, value, duration, delay, prefix, suffix, format])

  return (
    <span className={`inline-grid ${className}`}>
      <span className="sr-only">{final}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {final}
      </span>
      <span ref={ref} aria-hidden="true" className="col-start-1 row-start-1">
        {reduced ? final : `${prefix}${format.format(0)}${suffix}`}
      </span>
    </span>
  )
}
