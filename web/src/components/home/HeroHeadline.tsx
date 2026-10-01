import * as m from 'motion/react-m'
import { useState } from 'react'
import { EASE_OUT_EXPO } from '../../lib/motion'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'

interface Line {
  text: string
  className?: string
}

interface HeroHeadlineProps {
  lines: Line[]
  /** Seconds before the first word rises. */
  delay?: number
  className?: string
  id?: string
}

const WORD_STAGGER = 0.06

/**
 * The page h1, word by word: each word rises out of its own clipping slot.
 * Words are plain inline text to assistive tech (one heading, read normally).
 * Under reduced motion the heading is simply there.
 */
export function HeroHeadline({ lines, delay = 0.15, className = '', id }: HeroHeadlineProps) {
  const reduced = usePrefersReducedMotion()
  // Each word rises out of a clipped slot. Once the last word lands the clip
  // is dropped, so glows and overhangs are never cut off at rest.
  const [settled, setSettled] = useState(false)
  const total = lines.reduce((n, l) => n + l.text.split(' ').length, 0)
  const clip = !(reduced || settled)
  let index = 0
  return (
    <h1 id={id} className={className}>
      {lines.map((line, li) => (
        <span key={li} className={`block ${line.className ?? ''}`}>
          {line.text.split(' ').map((word, wi, words) => {
            const i = index++
            return (
              <span key={wi}>
                <span
                  className="inline-block align-bottom"
                  style={clip ? { clipPath: 'inset(-0.5em -0.3em 0 -0.3em)' } : undefined}
                >
                  <m.span
                    className="inline-block will-change-transform"
                    initial={reduced ? false : { y: '110%', rotate: 4 }}
                    animate={{ y: '0%', rotate: 0 }}
                    transition={{ duration: 0.95, ease: EASE_OUT_EXPO, delay: delay + i * WORD_STAGGER }}
                    onAnimationComplete={i === total - 1 ? () => setSettled(true) : undefined}
                  >
                    {word}
                  </m.span>
                </span>
                {wi < words.length - 1 ? ' ' : null}
              </span>
            )
          })}
          {li < lines.length - 1 ? ' ' : null}
        </span>
      ))}
    </h1>
  )
}
