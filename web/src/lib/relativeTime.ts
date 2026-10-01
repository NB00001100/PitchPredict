const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

/** "just now", "3 min ago", "2 hr ago", "yesterday". */
export function formatUpdated(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute').replace('minutes', 'min').replace('minute', 'min')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour').replace('hours', 'hr').replace('hour', 'hr')
  return relative.format(-Math.round(hours / 24), 'day')
}
