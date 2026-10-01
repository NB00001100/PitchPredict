import type { ReactNode } from 'react'

interface StatusMessageProps {
  children: ReactNode
  /** Optional follow-up, such as a retry button or a link. */
  action?: ReactNode
  tone?: 'neutral' | 'error'
}

/** A centred, announced message for loading, empty and error states. */
export function StatusMessage({ children, action, tone = 'neutral' }: StatusMessageProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="flex flex-col items-center gap-4 py-16 text-center"
    >
      <p className={tone === 'error' ? 'max-w-prose text-miss' : 'type-eyebrow text-grey-400'}>
        {children}
      </p>
      {action}
    </div>
  )
}
