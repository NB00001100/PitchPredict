import * as m from 'motion/react-m'
import { useScroll, useTransform } from 'motion/react'
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion'
import { PitchLines } from '../PitchLines'

/**
 * The hero's night scene: a pitch laid out in perspective, receding towards a
 * horizon under the headline, its markings stroking themselves in; two
 * floodlight beams; a glow where the light lands. All decorative.
 * Parallax: the pitch drifts slower than the page as you scroll away.
 */
export function HeroBackdrop() {
  const reduced = usePrefersReducedMotion()
  const { scrollY } = useScroll()
  const pitchY = useTransform(scrollY, [0, 800], [0, 160])
  const beamsOpacity = useTransform(scrollY, [0, 600], [1, 0.3])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(180deg,#000_78%,transparent)]"
    >
      {/* Floodlight beams from the stands, top corners. */}
      <m.div style={reduced ? undefined : { opacity: beamsOpacity }} className="absolute inset-0">
        <div className="animate-breathe absolute -top-[10%] left-[-12%] h-[120%] w-[55%] origin-top-left rotate-[-28deg] bg-[linear-gradient(180deg,rgb(200_230_255/0.16),rgb(200_230_255/0.04)_45%,transparent_75%)] blur-2xl [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
        <div className="animate-breathe absolute -top-[10%] right-[-12%] h-[120%] w-[55%] origin-top-right rotate-[28deg] bg-[linear-gradient(180deg,rgb(200_255_225/0.14),rgb(200_255_225/0.035)_45%,transparent_75%)] blur-2xl [animation-delay:-3s] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
      </m.div>

      {/* The pitch, tipped back in 3D. */}
      <m.div
        style={reduced ? undefined : { y: pitchY }}
        className="absolute inset-x-0 bottom-0 h-[72%] [mask-image:linear-gradient(180deg,transparent_0%,#000_55%)]"
      >
        <div className="absolute inset-0 [perspective:900px] [perspective-origin:50%_0%]">
          <div className="absolute bottom-[-70%] left-1/2 w-[230vw] -translate-x-1/2 origin-bottom [transform:rotateX(68deg)] sm:w-[max(1700px,150vw)]">
            <PitchLines
              stripes
              delay={0.5}
              strokeWidth={2.2}
              className="h-auto w-full text-pitch/45 [filter:drop-shadow(0_0_5px_rgb(60_240_140/0.5))]"
            />
          </div>
        </div>
      </m.div>

      {/* Where the floodlights land. */}
      <div className="absolute bottom-[8%] left-1/2 h-[45%] w-[90%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(60_240_140/0.14),transparent)]" />
      <div className="grain absolute inset-0 opacity-[0.05]" />
    </div>
  )
}
