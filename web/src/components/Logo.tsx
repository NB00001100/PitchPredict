import logoUrl from '../assets/logo.svg'

interface LogoProps {
  className?: string
}

/** The round PitchPredict mark. Decorative: pair it with the wordmark or a label. */
export function Logo({ className }: LogoProps) {
  return <img src={logoUrl} alt="" width={80} height={80} className={className} />
}
