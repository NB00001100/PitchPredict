import type { ComponentProps } from 'react'
import { Link } from 'react-router'

/** Inline link for running text: hairline underline that turns pitch green on hover. */
export function TextLink({ className = '', ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`underline decoration-grey-500 decoration-1 underline-offset-[0.25em] transition-colors duration-200 hover:text-pitch hover:decoration-pitch ${className}`}
      {...props}
    />
  )
}
