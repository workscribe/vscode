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
  /** CLI 2.2+: the `context` document's version */
  schemaVersion?: number
  /** CLI 2.2+, once its data is upgraded: the file's own project thread. Null when the CLI answered from sessions */
  thread?: ContextThread | null
  /** CLI 2.2+: the stretch of work the thread is part of */
  block?: ContextBlock | null
  /** CLI 2.2+: the other projects worked in the same stretch, in order */
  alongside?: AlongsideThread[] | null
}

/** The file's own project's work in the stretch, as the CLI names it. Only `activeMinutes` is shown today. */
export interface ContextThread {
  key: string
  projectId: number | null
  activeMinutes: number
}

/** The whole stretch of work, across every project. */
export interface ContextBlock {
  startedAt: string
  endedAt: string
  activeMinutes: number
}

/** Another project worked in the same stretch as the file's own. `repoName` is null for work outside a repo. */
export interface AlongsideThread {
  repoName: string | null
  startedAt: string
  endedAt: string
  eventCount: number
  activeMinutes: number
}

/** The thread view of an answer, once checked: what the tooltip and the tab show beyond a session. */
export interface ThreadView {
  activeMinutes: number
  alongside: AlongsideThread[]
}

function isAlongsideThread(value: unknown): value is AlongsideThread {
  if (typeof value !== 'object' || value === null) return false
  const thread = value as Record<string, unknown>
  return (
    (thread.repoName === null || typeof thread.repoName === 'string') &&
    typeof thread.startedAt === 'string' &&
    typeof thread.endedAt === 'string' &&
    typeof thread.eventCount === 'number' &&
    typeof thread.activeMinutes === 'number'
  )
}

/**
 * The answer's thread, checked before anything shows it: null from a CLI before 2.2, or one that answered from
 * sessions, and then the extension looks exactly as it did. An `alongside` entry that isn't well formed is dropped.
 */
export function threadOf(session: SessionContext): ThreadView | null {
  const activeMinutes = session.thread?.activeMinutes
  if (typeof activeMinutes !== 'number') return null
  const alongside = Array.isArray(session.alongside) ? session.alongside.filter(isAlongsideThread) : []
  return { activeMinutes, alongside }
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
