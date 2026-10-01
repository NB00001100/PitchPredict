import { Logo } from './Logo'

interface WordmarkProps {
  className?: string
  /** Logo size utility, e.g. "size-9". */
  logoClassName?: string
}

/**
 * The round pitch-and-spark mark with "PitchPredict" set in the condensed
 * display face, "Predict" lit in pitch green. The mark sits in a soft halo and
 * turns a little when the parent link (`group`) is hovered.
 */
export function Wordmark({ className = '', logoClassName = 'size-9' }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="relative inline-flex shrink-0">
        <span
          aria-hidden="true"
          className="absolute -inset-1.5 rounded-full bg-pitch/25 opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100"
        />
        <Logo
          className={`relative rounded-full shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_0_24px_-4px_rgb(60_240_140/0.5)] transition-transform duration-700 ease-out-expo group-hover:rotate-[30deg] motion-reduce:transform-none ${logoClassName}`}
        />
      </span>
      <span
        translate="no"
        className="font-display text-[1.45rem] leading-none font-extrabold tracking-[0.01em] uppercase [font-variation-settings:'wdth'_70]"
      >
        Pitch<span className="text-pitch">Predict</span>
      </span>
    </span>
  )
}
