import * as m from 'motion/react-m'
import { useScroll, useTransform } from 'motion/react'
import championsLogo from '../assets/champions-league-logo-white.svg'
import championsArt from '../assets/champions-league-night.svg'
import { ButtonLink } from '../components/Button'
import { ArrowRightIcon } from '../components/Icons'
import { Panel } from '../components/Panel'
import { PointerLight } from '../components/PointerLight'
import { Reveal, RevealItem } from '../components/Reveal'
import { Tag } from '../components/Tag'
import { EASE_OUT_EXPO } from '../lib/motion'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'

const PLAN = [
  { k: 'Before kick-off', v: 'A forecast for every match.' },
  { k: 'After full time', v: 'An honest record of how those forecasts did.' },
  { k: 'Same approach', v: 'It will work the same way as the Premier League one.' },
]

export default function ChampionsLeague() {
  const reduced = usePrefersReducedMotion()
  const { scrollY } = useScroll()
  const artY = useTransform(scrollY, [0, 900], [0, 180])
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
      <title>Champions League · PitchPredict</title>
      <section
        aria-labelledby="ucl-title"
        className="bleed relative isolate -mt-[76px] flex min-h-[100svh] flex-col overflow-hidden pt-[76px]"
      >
        {/* The night-stadium artwork as atmosphere: slow settle on load, parallax on scroll. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,#000_70%,transparent)]"
        >
          <m.div className="absolute inset-0" style={reduced ? undefined : { y: artY }}>
            <m.img
              src={championsArt}
              alt=""
              width={1200}
              height={1200}
              className="size-full object-cover object-[50%_70%] opacity-60"
              initial={reduced ? false : { scale: 1.12, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.6 }}
              transition={{ duration: 2.4, ease: EASE_OUT_EXPO }}
            />
          </m.div>
          <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_42%,rgb(5_11_24/0.2),rgb(4_9_10/0.92))]" />
          <div className="animate-breathe absolute top-[18%] left-1/2 h-[60%] w-[70%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(140_165_255/0.18),transparent)]" />
          <div className="grain absolute inset-0 opacity-[0.05]" />
        </div>

        <div className="page-col flex flex-1 flex-col items-center justify-center py-20 text-center">
          <m.div {...rise(0.1)}>
            <Tag>Coming soon</Tag>
          </m.div>
          <m.img
            {...rise(0.25)}
            src={championsLogo}
            alt="UEFA Champions League"
            width={128}
            height={58}
            className="mt-10 h-auto w-[min(26rem,72vw)] drop-shadow-[0_0_40px_rgb(160_185_255/0.35)]"
          />
          <m.h1 {...rise(0.45)} id="ucl-title" className="type-display mt-12">
            Not kicked off <span className="text-glow">yet</span>
          </m.h1>
          <m.div {...rise(0.6)} className="type-lede mt-7 flex max-w-[38rem] flex-col gap-4">
            <p>
              There is no Champions League model yet, and no data behind this page. Nothing here is a prediction.
            </p>
          </m.div>
          <m.div {...rise(0.75)} className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/premier-league" variant="primary" size="lg" icon={<ArrowRightIcon className="size-4" />}>
              Premier League forecasts
            </ButtonLink>
            <ButtonLink to="/" size="lg">
              Back to home
            </ButtonLink>
          </m.div>
        </div>
      </section>

      <section aria-labelledby="plan-title" className="pt-20 md:pt-28">
        <Reveal as="header" stagger className="flex flex-col items-center gap-4 text-center">
          <RevealItem as="p" className="type-eyebrow flex items-center gap-3 text-pitch">
            <span aria-hidden="true" className="h-px w-8 bg-pitch/70" />
            When it arrives
          </RevealItem>
          <RevealItem>
            <h2 id="plan-title" className="type-headline">
              The same deal as the Premier League
            </h2>
          </RevealItem>
        </Reveal>
        <Reveal as="ol" stagger className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
          {PLAN.map((item, i) => (
            <RevealItem as="li" key={item.k}>
              <Panel className="flex h-full flex-col gap-3 p-6">
                <PointerLight color="rgb(140 165 255 / 0.16)" />
                <span className="font-mono text-xs text-pitch">0{i + 1}</span>
                <h3 className="type-title">{item.k}</h3>
                <p className="text-sm leading-relaxed text-grey-200">{item.v}</p>
              </Panel>
            </RevealItem>
          ))}
        </Reveal>
      </section>
    </>
  )
}
