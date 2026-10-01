import * as m from 'motion/react-m'
import { ButtonLink } from '../components/Button'
import { ArrowRightIcon } from '../components/Icons'
import { PitchLines } from '../components/PitchLines'
import { EASE_OUT_EXPO } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

export default function NotFound() {
  const reduced = usePrefersReducedMotion()
  const rise = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE_OUT_EXPO, delay },
        }

  return (
    <>
      <title>Page not found · PitchPredict</title>
      <section
        aria-labelledby="nf-title"
        className="bleed relative isolate -mt-[76px] flex min-h-[100svh] flex-col overflow-hidden pt-[76px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,#000_70%,transparent)]"
        >
          {/* The top half of a pitch: penalty box under the numbers. */}
          <div className="absolute top-[-8%] left-1/2 w-[min(1300px,170vw)] -translate-x-1/2 opacity-80 [mask-image:linear-gradient(180deg,#000_30%,transparent_62%)]">
            <PitchLines delay={0.1} strokeWidth={2} className="h-auto w-full text-pitch/35" />
          </div>
          {/* A VAR offside line sweeping across. */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-[linear-gradient(180deg,transparent,var(--color-miss)_20%,var(--color-miss)_80%,transparent)] opacity-70 shadow-[0_0_18px_2px_rgb(255_107_112/0.5)] motion-safe:animate-[pp-scan_9s_ease-in-out_infinite] motion-reduce:hidden" />
        </div>

        <div className="page-col flex flex-1 flex-col items-center justify-center py-16 text-center">
          <m.p
            {...rise(0)}
            aria-hidden="true"
            className="font-display text-[clamp(8rem,30vw,22rem)] leading-[0.8] font-black text-transparent [-webkit-text-stroke:1.5px_rgb(214_255_234/0.35)] [font-variation-settings:'wdth'_62]"
          >
            404
          </m.p>
          <m.p {...rise(0.15)} className="type-eyebrow mt-6 flex items-center gap-3 text-miss">
            <span aria-hidden="true" className="h-px w-8 bg-miss/70" />
            Flag up
          </m.p>
          <m.h1 {...rise(0.25)} id="nf-title" className="type-display mt-4">
            That page is <span className="text-glow">offside</span>
          </m.h1>
          <m.p {...rise(0.4)} className="type-lede mt-6 max-w-[34rem]">
            There is no page at this address. It may have moved, or the link may be mistyped.
          </m.p>
          <m.div {...rise(0.55)} className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/" variant="primary" size="lg" icon={<ArrowRightIcon className="size-4" />}>
              Back to kick-off
            </ButtonLink>
            <ButtonLink to="/premier-league" size="lg">
              This week’s forecasts
            </ButtonLink>
          </m.div>
        </div>
      </section>
    </>
  )
}
