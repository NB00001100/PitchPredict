import { useRef, type ComponentProps, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useMagnetic } from '../lib/useMagnetic'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles'

/** A light band that sweeps across the primary button on hover. */
function Sheen({ variant }: { variant: ButtonVariant }) {
  if (variant === 'ghost') return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition-[translate,opacity] duration-700 ease-out-expo group-hover/btn:translate-x-[400%] group-hover/btn:opacity-100 motion-reduce:hidden"
    />
  )
}

interface StyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Trailing icon, e.g. <ArrowIcon />. Nudges right on hover. */
  icon?: ReactNode
}

function Label({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <>
      <span className="relative">{children}</span>
      {icon ? (
        <span className="relative transition-transform duration-300 ease-out-expo group-hover/btn:translate-x-1 motion-reduce:transform-none">
          {icon}
        </span>
      ) : null}
    </>
  )
}

/** Native button. Pill shaped, magnetic on fine pointers, presses down on click. */
export function Button({
  className = '',
  type = 'button',
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  ...props
}: ComponentProps<'button'> & StyleProps) {
  const ref = useRef<HTMLButtonElement>(null)
  useMagnetic(ref)
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...props}>
      <Sheen variant={variant} />
      <Label icon={icon}>{children}</Label>
    </button>
  )
}

/** In-app navigation styled as a button. */
export function ButtonLink({
  className = '',
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  ...props
}: ComponentProps<typeof Link> & StyleProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  useMagnetic(ref)
  return (
    <Link ref={ref} className={buttonClasses(variant, size, className)} {...props}>
      <Sheen variant={variant} />
      <Label icon={icon}>{children as ReactNode}</Label>
    </Link>
  )
}

/** External link styled as a button. */
export function ButtonAnchor({
  className = '',
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  ...props
}: ComponentProps<'a'> & StyleProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  useMagnetic(ref)
  return (
    <a ref={ref} className={buttonClasses(variant, size, className)} {...props}>
      <Sheen variant={variant} />
      <Label icon={icon}>{children}</Label>
    </a>
  )
}
