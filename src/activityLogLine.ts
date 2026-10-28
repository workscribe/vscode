// The lines the Workscribe Output channel shows. Pure.
import { formatClockTime } from './sessionTime'

/** The editor events the extension sends to `workscribe _capture --type`. */
export type CaptureEventType = 'code_edit' | 'debug_start' | 'debug_end' | 'task_run'

/** How each event reads in the log. */
const EVENT_LABELS = new Map<CaptureEventType, string>([
  ['code_edit', 'save'],
  ['debug_start', 'debug start'],
  ['debug_end', 'debug end'],
  ['task_run', 'task end'],
])
const LABEL_WIDTH = Math.max(...[...EVENT_LABELS.values()].map((label) => label.length))

/** Whether capture is running in this window, as the log's status line says it. */
export type CaptureStatus = { kind: 'on'; binaryPath: string } | { kind: 'restricted' } | { kind: 'no-cli' }

/**
 * "09:41:12  sent  save         README.md". "sent", not "captured": the CLI can still drop the event (a duplicate
 * save within 30 s, or capture paused), and the extension can't see that.
 */
export function formatLogLine(options: { time: Date; type: CaptureEventType; target: string }): string {
  const label = (EVENT_LABELS.get(options.type) ?? options.type).padEnd(LABEL_WIDTH)
  return `${formatClockTime(options.time, { withSeconds: true })}  sent  ${label}  ${options.target}`
}

export function formatCaptureStatus(status: CaptureStatus): string {
  if (status.kind === 'on') return `Capture on — events go to ${status.binaryPath}`
  if (status.kind === 'restricted') return 'Capture off — this workspace is in Restricted Mode'
  return 'Capture off — Workscribe CLI not found'
}

export const BINARY_PATH_CHANGED_LINE = 'Workscribe CLI path changed — reload the window to use it'
