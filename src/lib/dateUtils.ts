import { toZonedTime, format } from 'date-fns-tz'
import { format as dateFnsFormat } from 'date-fns'

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
