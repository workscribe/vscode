// How Workscribe shows when things happened. Pure, in the machine's local time zone.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/** "09:41", or "09:41:07" with seconds. */
export function formatClockTime(date: Date, options: { withSeconds?: boolean } = {}): string {
  const parts = options.withSeconds
    ? [date.getHours(), date.getMinutes(), date.getSeconds()]
    : [date.getHours(), date.getMinutes()]
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}

/**
 * "Tue 28 Oct, 09:10–10:40", or both days when a session runs past midnight. Timestamps that don't parse are shown
 * as they came, rather than as "NaN".
 */
export function formatSessionSpan(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt)
  const end = new Date(endedAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startedAt} – ${endedAt}`
  if (formatDayLabel(start) === formatDayLabel(end)) {
    return `${formatDayLabel(start)}, ${formatClockTime(start)}–${formatClockTime(end)}`
  }
  return `${formatDayLabel(start)}, ${formatClockTime(start)} – ${formatDayLabel(end)}, ${formatClockTime(end)}`
}

/** "under a minute", "45m", "2h 14m". */
export function formatSessionDuration(minutes: number): string {
  if (minutes < 1) return 'under a minute'
  const wholeMinutes = Math.round(minutes)
  const hours = Math.floor(wholeMinutes / 60)
  const rest = wholeMinutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
