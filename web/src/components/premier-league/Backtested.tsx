import { buttonClasses } from '../buttonStyles'
import { TextLink } from '../TextLink'
import { InfoIcon } from './icons'

const POPOVER_ID = 'backtested-explainer'

/**
 * "Backtested" pill that opens the shared explanation. A native popover
 * button: works with mouse, touch and keyboard, closes on Escape or a click
 * outside. Render `<BacktestedExplainer />` once per page. Styled like the
 * system's neutral Tag, in the Predicted zone's cool voice, because the flag
 * describes the forecast, not the result.
 */
export function BacktestedTag() {
  return (
    <button
      type="button"
      popoverTarget={POPOVER_ID}
      className="pl-cool-text relative inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-[rgb(150_200_255/0.35)] bg-black/50 px-2.5 font-wide text-[0.6rem] leading-none font-semibold tracking-[0.16em] uppercase transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] hover:border-[rgb(150_200_255/0.7)] hover:bg-[rgb(150_200_255/0.12)]"
    >
      Backtested
      <InfoIcon className="size-3" strokeWidth={1.8} />
      <span className="sr-only">: what does this mean?</span>
    </button>
  )
}

/** The one popover every `BacktestedTag` opens. */
export function BacktestedExplainer() {
  return (
    <div
      id={POPOVER_ID}
      popover="auto"
      aria-labelledby={`${POPOVER_ID}-title`}
      className="glass m-auto max-w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-black/85! p-6 text-left text-white shadow-lift backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <p className="pl-cool-text type-label">Predicted · backtested</p>
      <p id={`${POPOVER_ID}-title`} className="type-title mt-3 uppercase">
        Backtested forecast
      </p>
      <p className="mt-3 text-sm leading-relaxed text-grey-200">
        This forecast was generated after the match was played, using only data from before its matchweek, so the
        model could not see the result. Forecasts from now on are published before kickoff.
      </p>
      <div className="mt-5 flex items-center justify-between gap-4 text-sm">
        <TextLink to="/about">How it works</TextLink>
        <button type="button" popoverTarget={POPOVER_ID} popoverTargetAction="hide" className={buttonClasses('secondary', 'md', 'h-9! px-4!')}>
          Close
        </button>
      </div>
    </div>
  )
}
