import { execFile } from 'node:child_process'

const QUERY_TIMEOUT_MS = 5000

// Below this gap, "last worked on" isn't telling the user anything they don't
// already know (most file opens in a normal day were touched minutes/hours
// ago) — showing it anyway turns a point-of-need signal into status bar noise.
export const LAST_WORKED_ON_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

/** What CLI 2.1+ says about the file itself (`file` in `context --file --json`) — null without saves of it. */
export interface FileDetails {
  path: string
  relativePath: string
  firstSavedAt: string
  lastSavedAt: string
  saveCount: number
  branch: string | null
  commits: { hash: string; subject: string }[]
  editedAlongside: { files: string[]; total: number }
}

export interface SessionContext {
  /** CLI 2.1+ */
  repoName?: string | null
  date: string
  startedAt: string
  endedAt: string
  timeAgo: string
  durationMinutes: number
  branch: string | null
  eventCount: number
  summary: string | null
  /** CLI 2.1+, with --file only */
  file?: FileDetails | null
}

/** A `context --file` answer: a session, nothing recorded for the file, or no usable answer from the CLI. */
export type SessionLookup = { kind: 'found'; session: SessionContext } | { kind: 'none' } | { kind: 'failed' }

/**
 * `workscribe context --file <path> --json` as a request/response subprocess
 * call — unlike spawnCapture, this one needs its output back, so it's a
 * separate interaction pattern (execFile + timeout, not detached spawn).
 * Tells "nothing recorded for this file" (the CLI printed null) apart from
 * "no usable answer" (no CLI, timeout, malformed output), so the Workscribe
 * tab can say which. Never rejects.
 */
export function querySessionForFile(binaryPath: string, filePath: string): Promise<SessionLookup> {
  return new Promise((resolve) => {
    execFile(binaryPath, ['context', '--file', filePath, '--json'], { timeout: QUERY_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        resolve({ kind: 'failed' })
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(parsed === null ? { kind: 'none' } : { kind: 'found', session: parsed as SessionContext })
      } catch {
        resolve({ kind: 'failed' })
      }
    })
  })
}

/**
 * The status bar's view of `querySessionForFile`: the session, or null on any
 * failure. A failure here should never surface to the user — absence of
 * "last worked on" info is a normal, silent outcome.
 */
export async function queryContext(binaryPath: string, filePath: string): Promise<SessionContext | null> {
  const lookup = await querySessionForFile(binaryPath, filePath)
  return lookup.kind === 'found' ? lookup.session : null
}

/**
 * Whether a session's gap since it started is large enough to be worth
 * surfacing in the status bar, rather than noise on every file open.
 */
export function shouldSurface(context: SessionContext, now: number = Date.now()): boolean {
  const gapMs = now - new Date(context.startedAt).getTime()
  return gapMs >= LAST_WORKED_ON_THRESHOLD_MS
}
