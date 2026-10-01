import type { SVGProps } from 'react'

/*
 * Page-local line icons on the same 16px grid and stroke as components/Icons.
 * Decorative (aria-hidden): always paired with visible or sr-only text.
 */
type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3 5 8l5 5" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 3 5 5-5 5" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 4.75V8l2.25 1.5" />
    </Icon>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.25V11M8 5h.01" />
    </Icon>
  )
}

export function ReturnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4 2.5 7.5 6 11M3 7.5h6.5a4 4 0 0 1 0 8" transform="translate(0 -1.5)" />
    </Icon>
  )
}

export function RetryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" />
    </Icon>
  )
}
