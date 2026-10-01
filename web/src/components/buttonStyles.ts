/* Button class recipes, shared by Button, ButtonLink and ButtonAnchor (and usable on any element). */

/**
 * - `primary`: pitch-green fill with a glow. One per view: the main action.
 * - `secondary`: glass pill with a hairline. Everything else (the default).
 * - `ghost`: text only, for low-emphasis actions in dense UI.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'lg'

const BASE =
  'magnetic group/btn relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full font-wide font-semibold uppercase tracking-[0.14em] whitespace-nowrap select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50'

const SIZES: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-[0.7rem]',
  lg: 'h-14 px-7 text-[0.78rem]',
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-pitch text-black shadow-[0_0_0_1px_rgb(60_240_140/0.6),0_10px_40px_-10px_rgb(60_240_140/0.7)] hover:bg-pitch-bright hover:shadow-[0_0_0_1px_rgb(155_255_200/0.8),0_14px_50px_-8px_rgb(60_240_140/0.85)]',
  secondary:
    'glass text-white hover:border-hairline-strong hover:bg-glass-strong',
  ghost: 'text-grey-200 hover:text-white',
}

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className = '') {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`
}
