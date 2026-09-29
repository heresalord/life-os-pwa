import { toZonedTime, format } from 'date-fns-tz'
import { format as dateFnsFormat, differenceInCalendarDays } from 'date-fns'

/**
 * Returns the user's local date as a YYYY-MM-DD string.
 * ALWAYS use this — never use new Date().toISOString().slice(0,10)
 */
export function getUserLocalDate(timezone: string, date: Date = new Date()): string {
  const zoned = toZonedTime(date, timezone)
  return format(zoned, 'yyyy-MM-dd', { timeZone: timezone })
}

/** Display a YYYY-MM-DD string with any date-fns format pattern */
export function displayDate(dateStr: string, formatStr = 'MMM d, yyyy'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return dateFnsFormat(new Date(y, m - 1, d), formatStr)
}

/**
 * Context-aware timestamp for "last edited" labels.
 *
 * - today          → "2:14 PM"
 * - yesterday      → "Yesterday"
 * - within 7 days  → "Tuesday"
 * - older          → "Sep 3"  (appends year when it differs from this year)
 */
export function formatEditedAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = differenceInCalendarDays(now, date)

  if (diff === 0) return dateFnsFormat(date, 'h:mm aa')
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return dateFnsFormat(date, 'EEEE')        // e.g. "Tuesday"
  if (date.getFullYear() === now.getFullYear()) return dateFnsFormat(date, 'MMM d') // e.g. "Sep 3"
  return dateFnsFormat(date, 'MMM d, yyyy')                // e.g. "Sep 3, 2025"
}
