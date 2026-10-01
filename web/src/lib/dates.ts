import type { Fixture } from './types'

export interface KickoffDay<T> {
  /** Calendar date in the given time zone, "YYYY-MM-DD". */
  key: string
  /** The first kickoff of the day; use it to format the day's heading. */
  date: Date
  /** That day's fixtures in kickoff order. */
  fixtures: T[]
}

const keyFormatters = new Map<string, Intl.DateTimeFormat>()

/** "YYYY-MM-DD" of an instant in a time zone (undefined: the viewer's). */
export function localDayKey(date: Date, timeZone?: string): string {
  const cacheKey = timeZone ?? ''
  let formatter = keyFormatters.get(cacheKey)
  if (!formatter) {
    // en-CA formats dates as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone })
    keyFormatters.set(cacheKey, formatter)
  }
  return formatter.format(date)
}

/**
 * Groups fixtures by the calendar day they kick off on in `timeZone` (the
 * viewer's own when undefined). Days ascend; fixtures within a day are in
 * kickoff order, ties by fixture id.
 */
export function groupByKickoffDay<T extends Pick<Fixture, 'kickoff' | 'fixture_id'>>(
  fixtures: readonly T[],
  timeZone?: string,
): KickoffDay<T>[] {
  const sorted = fixtures.toSorted(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.fixture_id - b.fixture_id,
  )
  const days: KickoffDay<T>[] = []
  for (const fixture of sorted) {
    const date = new Date(fixture.kickoff)
    const key = localDayKey(date, timeZone)
    const last = days.at(-1)
    if (last?.key === key) last.fixtures.push(fixture)
    else days.push({ key, date, fixtures: [fixture] })
  }
  return days
}

/**
 * The span of kickoff dates of a matchweek, formatted for the viewer:
 * "Sat 10 – Mon 12 Oct" in en-GB. Null with no fixtures.
 */
export function formatDateRange(
  fixtures: readonly Pick<Fixture, 'kickoff'>[],
  locale?: string,
  timeZone?: string,
): string | null {
  let first = Infinity
  let last = -Infinity
  for (const { kickoff } of fixtures) {
    const t = Date.parse(kickoff)
    if (Number.isNaN(t)) continue
    if (t < first) first = t
    if (t > last) last = t
  }
  if (first === Infinity) return null
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone })
  return format.formatRange(new Date(first), new Date(last))
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/** Kickoff time in the viewer's locale and time zone: "15:00" / "3:00 PM". */
export function formatKickoffTime(kickoff: string): string {
  return timeFormat.format(new Date(kickoff))
}

/** Day heading in the viewer's locale and time zone: "Saturday 10 October". */
export function formatDayHeading(date: Date): string {
  return dayFormat.format(date)
}
