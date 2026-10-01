const SIZES = {
  sm: 'size-8 text-[0.6rem]',
  md: 'size-11 text-[0.72rem]',
  lg: 'size-16 text-[0.95rem]',
} as const

interface TeamMonogramProps {
  /** Three-letter team code, e.g. "ARS". */
  tla: string
  /**
   * Full team name. When given, the badge is announced as that team; leave it
   * out when the name is already printed next to the badge.
   */
  name?: string
  size?: keyof typeof SIZES
  className?: string
}

/** Round badge with a team's three-letter code. Original artwork: no crests. */
export function TeamMonogram({ tla, name, size = 'md', className = '' }: TeamMonogramProps) {
  const label = tla.trim().toUpperCase().slice(0, 3) || '?'
  return (
    <span
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      title={name}
      translate="no"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-hairline-strong bg-[radial-gradient(circle_at_50%_25%,rgb(214_255_234/0.14),rgb(214_255_234/0.03)_70%)] font-wide leading-none font-bold tracking-[0.08em] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.1)] select-none ${SIZES[size]} ${className}`}
    >
      <span>{label}</span>
    </span>
  )
}
