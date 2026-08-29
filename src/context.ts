import { execFile } from 'node:child_process'

const QUERY_TIMEOUT_MS = 5000

// Below this gap, "last worked on" isn't telling the user anything they don't
// already know (most file opens in a normal day were touched minutes/hours
// ago) — showing it anyway turns a point-of-need signal into status bar noise.
export const LAST_WORKED_ON_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface SessionContext {
  date: string
  startedAt: string
  endedAt: string
  timeAgo: string
  durationMinutes: number
  branch: string | null
  eventCount: number
  summary: string | null
}

/**
 * `workscribe context --file <path> --json` as a request/response subprocess
 * call — unlike spawnCapture, this one needs its output back, so it's a
 * separate interaction pattern (execFile + timeout, not detached spawn).
 * Returns null on any failure: no CLI, timeout, no matching session, or
 * malformed output. A failure here should never surface to the user —
 * absence of "last worked on" info is a normal, silent outcome.
 */
export function queryContext(binaryPath: string, filePath: string): Promise<SessionContext | null> {
  return new Promise((resolve) => {
    execFile(binaryPath, ['context', '--file', filePath, '--json'], { timeout: QUERY_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(parsed === null ? null : (parsed as SessionContext))
      } catch {
        resolve(null)
      }
    })
  })
}

/**
 * Whether a session's gap since it started is large enough to be worth
 * surfacing in the status bar, rather than noise on every file open.
 */
export function shouldSurface(context: SessionContext, now: number = Date.now()): boolean {
  const gapMs = now - new Date(context.startedAt).getTime()
  return gapMs >= LAST_WORKED_ON_THRESHOLD_MS
}
